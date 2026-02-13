const axios = require('axios');

export default async function handler(req, res) {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });

    try {
        // 1. Define the Pinterest Mobile API URL
        const pinterestUrl = `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(`/search/pins/?q=${q}`)}&data=${encodeURIComponent(JSON.stringify({
            options: {
                query: q,
                scope: "pins",
                page_size: 25,
                field_set_key: "unauth_react_main_grid"
            },
            context: {}
        }))}`;

        // 2. Wrap it in a FREE Proxy (AllOrigins)
        // This hides Vercel's IP and uses AllOrigins' IP instead
const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(pinterestUrl)}`;

        const response = await axios.get(proxyUrl);
        
        // AllOrigins returns the data as a string inside a 'contents' field
        const rawData = JSON.parse(response.data.contents);
        const results = rawData?.resource_response?.data?.results || [];

        if (results.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Proxy succeeded but Pinterest returned no results. Try a different search term.",
                debug: rawData
            });
        }

        // 3. Extract high-res images
        const pins = results.map(pin => ({
            id: pin.id,
            title: pin.title || pin.grid_title || "Pinterest Image",
            image: pin.images?.orig?.url || pin.images?.['736x']?.url,
            link: `https://www.pinterest.com/pin/${pin.id}/`
        })).filter(p => p.image);

        // 4. Return Data
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json({
            status: "success",
            query: q,
            count: pins.length,
            images: pins
        });

    } catch (error) {
        res.status(500).json({
            error: "Proxy Scrape Failed",
            message: error.message,
            tip: "If this fails, the free proxy is down. You can try 'https://corsproxy.io/?' as an alternative."
        });
    }
}
