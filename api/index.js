const axios = require('axios');
const cheerio = require('cheerio');

export default async function handler(req, res) {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });

    try {
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
        
        // STEP 1: Handshake - Get cookies
        const handshake = await axios.get('https://www.pinterest.com/', {
            headers: { 'User-Agent': userAgent }
        });
        
        const cookies = handshake.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
        const $ = cheerio.load(handshake.data);
        
        // Extract CSRF Token from the page data
        const jsData = $('#__PWS_DATA__').html();
        const parsedJsData = JSON.parse(jsData);
        const csrfToken = parsedJsData.context.config.csrf_token || "no-token";

        // STEP 2: The Actual Search Request
        // This is the internal API Pinterest uses for its search page
        const options = {
            options: {
                article: null,
                applied_productive_tags: [],
                auto_correction_disabled: false,
                corpus: null,
                customized_rerank_type: null,
                filters: null,
                query: q,
                scope: "pins",
                source_id: null
            },
            context: {}
        };

        const searchUrl = `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(`/search/pins/?q=${q}`)}&data=${encodeURIComponent(JSON.stringify(options))}&_=${Date.now()}`;

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': userAgent,
                'Cookie': cookies,
                'x-requested-with': 'XMLHttpRequest',
                'x-csrftoken': csrfToken,
                'referer': `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`
            }
        });

        // STEP 3: Clean the Data
        const items = response.data.resource_response.data.results || [];
        
        const pins = items.map(pin => ({
            id: pin.id,
            title: pin.title || pin.grid_title || "No Title",
            link: `https://www.pinterest.com/pin/${pin.id}/`,
            // Always prefer 'orig' for max resolution
            image: pin.images?.orig?.url || pin.images?.['736x']?.url,
            pinner: pin.pinner?.username,
            created_at: pin.created_at
        }));

        // STEP 4: Send Response
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json({
            status: "success",
            query: q,
            count: pins.length,
            data: pins
        });

    } catch (error) {
        console.error("Scraper Error:", error.message);
        res.status(500).json({ 
            error: "Failed to fetch from Pinterest", 
            message: error.message,
            tip: "Pinterest might be rate-limiting the Vercel IP. Try again in a minute."
        });
    }
}
