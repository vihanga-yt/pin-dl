import axios from 'axios';

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing query. Usage: ?q=cats' });
  }

  try {
    const dataPayload = {
      options: {
        article: null,
        applied_productive_tags: [],
        appliedProductiveTag: null,
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

    const url = `https://www.pinterest.com/resource/BaseSearchResource/get/`;
    
    const response = await axios.get(url, {
      params: {
        source_url: `/search/pins/?q=${encodeURIComponent(q)}`,
        data: JSON.stringify(dataPayload),
        _: Date.now()
      },
      headers: {
        // We set a static User-Agent, so no external library is needed
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.pinterest.com/',
        'Accept': 'application/json'
      }
    });

    const results = response.data?.resource_response?.data?.results || [];
    
    // Filter and map to get clean URLs
    const pins = results
      .filter(pin => pin.images && pin.images['orig'])
      .map(pin => ({
        id: pin.id,
        title: pin.grid_title || pin.description,
        image: pin.images['orig'].url, // HD Image
        width: pin.images['orig'].width,
        height: pin.images['orig'].height
      }));

    res.status(200).json({ count: pins.length, data: pins });

  } catch (error) {
    res.status(500).json({ error: 'Error fetching data', details: error.message });
  }
}
