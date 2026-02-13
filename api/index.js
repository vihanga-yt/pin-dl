const axios = require('axios');

export default async function handler(req, res) {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });

    try {
        // STEP 1: Mimic the Pinterest Android App
        // The Android API is significantly less restricted than the Web API
        const response = await axios.get('https://www.pinterest.com/resource/BaseSearchResource/get/', {
            params: {
                source_url: `/search/pins/?q=${encodeURIComponent(q)}`,
                data: JSON.stringify({
                    options: {
                        query: q,
                        scope: "pins",
                        page_size: 25,
                        field_set_key: "unauth_react_main_grid"
                    },
                    context: {}
                }),
                _: Date.now()
            },
            headers: {
                // This specific User-Agent is the key to bypassing the 403
                'User-Agent': 'Pinterest/Android 11.23.0 (Pixel 6; 13)',
                'Accept': 'application/json',
                'X-Pinterest-AppState': 'active',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        // STEP 2: Extract Pins using a "Safe Navigator"
        const results = response.data?.resource_response?.data?.results || [];
        
        if (results.length === 0) {
            // If the API returns 0, it's a soft-block. 
            // We return a specific error to tell you to change the Vercel Region.
            return res.status(403).json({
                error: "Pinterest Soft-Block",
                message: "API returned 0 results. Vercel's IP is currently being throttled.",
                tip: "Change Vercel region to 'hnd1' (Tokyo) or 'syd1' (Sydney) in settings."
            });
        }

        // STEP 3: Map results to HD Image URLs
        const pins = results.map(pin => {
            const highRes = pin.images?.orig?.url || 
                            pin.images?.['736x']?.url || 
                            pin.images?.['564x']?.url;
            
            return {
                id: pin.id,
                title: pin.title || pin.grid_title || "Pinterest Pin",
                image: highRes,
                pinner: pin.pinner?.username,
                link: `https://www.pinterest.com/pin/${pin.id}/`
            };
        }).filter(p => p.image);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json({
            status: "success",
            query: q,
            count: pins.length,
            data: pins
        });

    } catch (error) {
        // STEP 4: Fallback Logic
        // If the API throws a 403, it means the IP is hard-blocked.
        res.status(500).json({
            error: "403 Forbidden",
            message: "Vercel IP is hard-blocked by Pinterest.",
            solution: "You MUST change the Vercel Function Region to bypass this."
        });
    }
}
