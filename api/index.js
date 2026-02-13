const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

export default async function handler(req, res) {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });

    // 1. Initialize a real Cookie Jar to handle the session handshake
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, withCredentials: true }));

    // This specific User-Agent is less likely to trigger the 403 bot-wall
    const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

    try {
        // STEP 1: THE HANDSHAKE
        // Visit the search page as a "Mobile User" to get a Guest Cookie
        const handshake = await client.get(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`, {
            headers: { 'User-Agent': userAgent }
        });

        // STEP 2: EXTRACT THE CSRF TOKEN
        // Pinterest won't allow API calls without this token synced to the cookie
        const cookies = await jar.getCookies('https://www.pinterest.com/');
        const csrfToken = cookies.find(c => c.key === 'csrftoken')?.value || 'missing';

        // STEP 3: HIT THE INTERNAL RESOURCE API
        // This is the endpoint GitHub scrapers use to get raw JSON
        const searchPayload = {
            options: {
                query: q,
                scope: "pins",
                page_size: 25,
                field_set_key: "unauth_react_main_grid"
            },
            context: {}
        };

        const apiResponse = await client.get('https://www.pinterest.com/resource/BaseSearchResource/get/', {
            params: {
                source_url: `/search/pins/?q=${encodeURIComponent(q)}`,
                data: JSON.stringify(searchPayload),
                _: Date.now()
            },
            headers: {
                'User-Agent': userAgent,
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': csrfToken,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`
            }
        });

        // STEP 4: PARSE DATA
        const results = apiResponse.data?.resource_response?.data?.results || [];

        const pins = results.map(pin => ({
            id: pin.id,
            title: pin.title || pin.grid_title || "Pinterest Image",
            // We force 'orig' (Original) for the best resolution
            image: pin.images?.orig?.url || pin.images?.['736x']?.url,
            pinner: pin.pinner?.username,
            url: `https://www.pinterest.com/pin/${pin.id}/`
        })).filter(p => p.image); // Remove any broken results

        // STEP 5: RETURN JSON
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        
        if (pins.length === 0) {
            return res.status(404).json({ 
                status: "blocked", 
                message: "Pinterest returned 0 results. Vercel IP might be throttled." 
            });
        }

        res.status(200).json({
            status: "success",
            query: q,
            count: pins.length,
            images: pins
        });

    } catch (error) {
        console.error("Scraper Error:", error.message);
        res.status(500).json({
            error: "Pinterest 403 / Blocked",
            message: error.message,
            tip: "GO TO VERCEL SETTINGS -> FUNCTIONS -> REGION. CHANGE TO 'Sydney (syd1)' or 'Frankfurt (fra1)'. Pinterest blocks US-East IPs."
        });
    }
}
