const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Force local chromium for testing if not on Vercel (Optional)
// const localExecutablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"; 

export default async function handler(req, res) {
  // 1. Get query from URL (e.g., ?q=cats)
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Please provide a search term. Example: ?q=cyberpunk' });
  }

  let browser = null;

  try {
    // 2. Setup Browser (Vercel optimized)
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // 3. Set User-Agent to look like a real PC (Critical for Pinterest)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

    // 4. Go to Pinterest Search
    // We append &rs=typed to mimic real typing
    const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}&rs=typed`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });

    // 5. Scrape Images
    const images = await page.evaluate(() => {
      // Select all images on the page
      const imgElements = Array.from(document.querySelectorAll('img'));
      
      return imgElements
        .map(img => img.src)
        // Filter: Keep only actual pin images (usually contain '236x', '474x', or '564x')
        .filter(src => src.includes('236x') || src.includes('474x') || src.includes('564x'))
        // Transform: Change low-res URL to High-Res ('originals')
        .map(src => src.replace(/\/236x\/|\/474x\/|\/564x\//, '/originals/'));
    });

    // Remove duplicates
    const uniqueImages = [...new Set(images)];

    // 6. Return Response
    res.status(200).json({
      search_term: q,
      count: uniqueImages.length,
      images: uniqueImages
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to scrape data', details: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
