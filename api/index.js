const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing query. Usage: ?q=cats' });
  }

  let browser = null;

  try {
    // OPTIONAL: If running locally on Windows/Mac, use local chrome path
    // const localExe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless, // Uses correct mode for sparticuz
    });

    const page = await browser.newPage();

    // 1. Stealth: Fake a real User Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

    // 2. Go to Pinterest
    await page.goto(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}&rs=typed`, { 
      waitUntil: 'domcontentloaded', // Faster than networkidle2
      timeout: 15000 
    });

    // 3. Scrape
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .map(img => img.src)
        .filter(src => src.includes('236x') || src.includes('474x') || src.includes('564x'))
        .map(src => src.replace(/\/236x\/|\/474x\/|\/564x\//, '/originals/'));
    });

    // 4. Unique results
    const uniqueImages = [...new Set(images)];

    res.status(200).json({
      search_term: q,
      count: uniqueImages.length,
      images: uniqueImages
    });

  } catch (error) {
    console.error("Scrape Error:", error);
    res.status(500).json({ error: 'Failed to scrape', details: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
