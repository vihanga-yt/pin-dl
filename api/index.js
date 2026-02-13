const axios = require('axios');

export default async function handler(req, res) {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });

    try {
        // 1. Construct the internal Pinterest Search Resource URL
        // This is the specific endpoint used by Pinterest's internal engine
        const searchOptions = {
            options: {
                query: q,
                scope: "pins",
                page_size: 25, // Number of results
                filters: null
            },
            context: {}
        };

        const baseUrl = "https://www.pinterest.com/resource/BaseSearchResource/get/";
        const params = new URLSearchParams({
            source_url: `/search/pins/?q=${encodeURIComponent(q)}`,
            data: JSON.stringify(searchOptions),
            _: Date.now()
        });

        // 2. Add Mobile-Style Headers
        // These headers make Pinterest think the request is coming from their own frontend
        const response = await axios.get(`${baseUrl}?${params.toString()}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`,
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        });

        // 3. Extract Pins from the Resource Response
        const results = response.data?.resource_response?.data?.results || [];

        if (results.length === 0) {
            return res.status(404).json({ 
                status: "error", 
                message: "Pinterest returned no data for this IP. They are likely rate-limiting Vercel.",
                raw: response.data // To help you debug what they sent back
            });
        }

        const pins = results.map(pin => {
            // Get the highest resolution possible
            const img = pin.images?.orig?.url || 
                        pin.images?.['736x']?.url || 
                        pin.images?.['564x']?.url;
            
            return {
                id: pin.id,
                title: pin.title || pin.grid_title || "Pinterest Pin",
                image: img,
                source: `https://www.pinterest.com/pin/${pin.id}/`
            };
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json({
            status: "success",
            query: q,
            count: pins.length,
            images: pins
        });

    } catch (error) {
        console.error("Scraper Error:", error.message);
        res.status(500).json({ 
            error: "Request Failed", 
            message: error.message,
            tip: "If you get 403, Pinterest has blacklisted this Vercel deployment region. Try changing Vercel Region to 'London' or 'Singapore' in settings."
        });
    }
}
