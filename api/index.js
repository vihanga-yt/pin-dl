const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

export default async function handler(req, res) {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Search query 'q' required" });

    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, withCredentials: true }));

    // Use a very specific Mobile User-Agent
    const userAgent = 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';

    try {
        // STEP 1: Handshake - Visit Pinterest home to generate a Guest Session
        // This generates the necessary cookies in our 'jar'
        const home = await client.get('https://www.pinterest.com/', {
            headers: { 'User-Agent': userAgent }
        });

        // STEP 2: Extract CSRF Token from cookies
        const cookies = await jar.getCookies('https://www.pinterest.com/');
        const csrfToken = cookies.find(c => c.key === 'csrftoken')?.value || 'missing-token';

        // STEP 3: The Internal API Call
        const searchPayload = {
            options: {
                query: q,
                scope: "pins",
                page_size: 20,
                field_set_key: "unauth_react"
            },
            context: {}
        };

        const response = await client.get('https://www.pinterest.com/resource/BaseSearchResource/get/', {
            params: {
                source_url: `/search/pins/?q=${encodeURIComponent(q)}`,
                data: JSON.stringify(searchPayload),
                _: Date.now()
            },
            headers: {
                'User-Agent': userAgent,
                'X-CSRFToken': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://www.pinterest.com/',
                'Accept': 'application/json'
            }
        });

        const results = response.data?.resource_response?.data?.results || [];

        const pins = results.map(pin => ({
            id: pin.id,
            image: pin.images?.orig?.url || pin.images?.['736x']?.url,
            title: pin.title || pin.grid_title || "Pin"
        })).filter(p => p.image); // Filter out items with no image

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.status(200).json({
            status: pins.length > 0 ? "success" : "blocked",
            count: pins.length,
            images: pins
        });

    } catch (error) {
        res.status(500).json({
            error: "Pinterest Blocked Vercel",
            message: error.message,
            tip: "Pinterest blocks Data Center IPs. Go to Vercel Settings -> Functions -> Region and change to 'syd1' (Sydney) or 'fra1' (Frankfurt) and redeploy."
        });
    }
}
