const axios = require('axios');
const cheerio = require('cheerio');

export default async function handler(req, res) {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Search query 'q' required" });

    try {
        // STEP 1: Spoof Googlebot
        // Pinterest allows Googlebot to see content to maintain their SEO rankings.
        const response = await axios.get(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': 'https://www.google.com/'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        let images = [];

        // METHOD A: Scrape the JSON state (Hidden in script tags)
        const scriptData = $('#__PWS_DATA__').html();
        if (scriptData) {
            try {
                const json = JSON.parse(scriptData);
                // Deep search for pins in the JSON tree
                const pins = findInObject(json, 'pins');
                if (pins) {
                    Object.values(pins).forEach(pin => {
                        if (pin.images?.orig?.url) images.push(pin.images.orig.url);
                    });
                }
            } catch (e) { /* ignore parse errors */ }
        }

        // METHOD B: Direct Image Extraction (Regex fallback)
        if (images.length === 0) {
            const html = response.data;
            // Look for Pinterest original image patterns
            const regex = /https:\/\/i\.pinimg\.com\/originals\/[a-z0-9\/]+\.(jpg|png|gif|webp)/g;
            const matches = html.match(regex);
            if (matches) images = [...new Set(matches)];
        }

        // Clean up and convert to high-res
        const cleanImages = images
            .map(img => img.replace(/\/(236x|474x|564x|736x)\//, '/originals/'))
            .filter(img => img.includes('i.pinimg.com'));

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json({
            status: cleanImages.length > 0 ? "success" : "limited",
            count: cleanImages.length,
            images: cleanImages,
            note: cleanImages.length === 0 ? "Pinterest is heavily throttling this IP. Try changing Vercel region." : null
        });

    } catch (error) {
        res.status(500).json({
            error: "Pinterest 403 Bypass Failed",
            message: error.message,
            tip: "Change Vercel Region to 'syd1' (Sydney) or 'hnd1' (Tokyo) in Project Settings -> Functions."
        });
    }
}

// Helper to find a key anywhere in a deep JSON object
function findInObject(obj, key) {
    if (obj && typeof obj === 'object') {
        if (obj[key]) return obj[key];
        for (const k in obj) {
            const result = findInObject(obj[k], key);
            if (result) return result;
        }
    }
    return null;
}
