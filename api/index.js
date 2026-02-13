const axios = require('axios');
const cheerio = require('cheerio');

export default async function handler(req, res) {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });

    try {
        const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`;
        
        // We use a high-quality User-Agent to avoid being flagged as a basic bot
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'DNT': '1',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        let images = [];

        // METHOD 1: Parse the JSON data block (The standard way)
        const scriptData = $('#__PWS_DATA__').html();
        if (scriptData) {
            try {
                const json = JSON.parse(scriptData);
                
                // We use a recursive search to find the 'pins' object anywhere in the JSON
                const findPins = (obj) => {
                    if (!obj || typeof obj !== 'object') return null;
                    if (obj.pins && typeof obj.pins === 'object') return obj.pins;
                    for (const key in obj) {
                        const found = findPins(obj[key]);
                        if (found) return found;
                    }
                    return null;
                };

                const pins = findPins(json);
                if (pins) {
                    Object.values(pins).forEach(pin => {
                        if (pin.images && pin.images.orig) {
                            images.push(pin.images.orig.url);
                        }
                    });
                }
            } catch (e) {
                console.log("JSON Parse failed, trying Regex fallback...");
            }
        }

        // METHOD 2: Regex Fallback (If Pinterest obfuscates the JSON)
        // This looks for anything matching the high-res Pinterest image URL pattern
        if (images.length === 0) {
            const html = response.data;
            const regex = /https:\/\/i\.pinimg\.com\/originals\/[a-z0-9\/]+\.(jpg|png|gif|webp)/g;
            const matches = html.match(regex);
            if (matches) {
                images = [...new Set(matches)]; // Remove duplicates
            }
        }

        // Final Filter: Convert 236x or 474x links to originals if any were caught
        const finalImages = images.map(img => img.replace(/\/(236x|474x|564x|736x)\//, '/originals/'));

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json({
            status: finalImages.length > 0 ? "success" : "no_results",
            query: q,
            count: finalImages.length,
            images: finalImages
        });

    } catch (error) {
        res.status(500).json({ 
            error: "Pinterest Blocked Connection", 
            details: error.message,
            tip: "Vercel IPs are sometimes pre-blocked. Try redeploying to a different Vercel region (e.g. Europe) in project settings."
        });
    }
}
