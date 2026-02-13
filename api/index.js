import axios from 'axios';

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing query. Usage: ?q=cats' });
  }

  try {
    // 1. Construct the internal API payload
    // This mimics the "data" parameter Pinterest sends when you search
    const dataPayload = {
      options: {
        article: null,
        applied_productive_tags: [],
        appliedProductiveTag: null,
        auto_correction_disabled: false,
        corpus: null,
        customized_rerank_type: null,
        filters: null,
        query: q, // Your search term
        scope: "pins",
        source_id: null
      },
      context: {}
    };

    // 2. Make the Request
    // We hit the 'BaseSearchResource' endpoint which returns JSON directly
    const url = `https://www.pinterest.com/resource/BaseSearchResource/get/`;
    
    const response = await axios.get(url, {
      params: {
        source_url: `/search/pins/?q=${encodeURIComponent(q)}`,
        data: JSON.stringify(dataPayload),
        _: Date.now()
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.pinterest.com/',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      }
    });

    // 3. Extract the Pins
    const results = response.data?.resource_response?.data?.results || [];
    
    // 4. Format the Output (Get High-Res Images)
    const pins = results
      .filter(pin => pin.images && pin.images['orig']) // Ensure image exists
      .map(pin => ({
        id: pin.id,
        title: pin.grid_title || pin.description,
        image_url: pin.images['orig'].url, // The Original HD Image
        width: pin.images['orig'].width,
        height: pin.images['orig'].height,
        pinner: pin.pinner?.username
      }));

    res.status(200).json({
      search_term: q,
      count: pins.length,
      data: pins
    });

  } catch (error) {
    console.error("API Error:", error.message);
    res.status(500).json({ 
      error: 'Failed to fetch data from Pinterest', 
      details: error.response?.data || error.message 
    });
  }
}
