const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  let browser = null;

  try {
    // 1. Setup Chromium for Vercel Node 20
    chromium.setHeadlessMode = true; // Use new headless mode
    chromium.setGraphicsMode = false; // Required for performance

    browser = await puppeteer.launch({
      args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // 2. Set Fake User-Agent (Critical for bypassing 403)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

    // 3. Navigate
    await page.goto(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`, {
      waitUntil: 'domcontentloaded', // Faster
      timeout: 15000 // 15s timeout
    });

    // 4. Scrape Data
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .map(img => img.src)
        .filter(src => src.includes('236x') || src.includes('564x') || src.includes('474x'))
        .map(src => src.replace(/\/236x\/|\/474x\/|\/564x\//, '/originals/'));
    });

    const uniqueImages = [...new Set(images)];

    res.status(200).json({
      count: uniqueImages.length,
      images: uniqueImages
    });

  } catch (error) {
    console.error("Puppeteer Error:", error);
    res.status(500).json({ error: 'Failed to scrape', details: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
