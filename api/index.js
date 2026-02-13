import chromium from '@sparticuz/chromium';
import playwright from 'playwright-core';

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing query. Usage: ?q=cats' });
  }

  let browser = null;

  try {
    // 1. Setup Browser for Vercel
    // Playwright requires pointing specifically to the chromium binary
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    browser = await playwright.chromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    // 2. Open Page
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // 3. Go to Pinterest
    await page.goto(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}&rs=typed`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });

    // 4. Scrape (Logic is identical to Puppeteer)
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .map(img => img.src)
        .filter(src => src.includes('236x') || src.includes('474x') || src.includes('564x'))
        .map(src => src.replace(/\/236x\/|\/474x\/|\/564x\//, '/originals/'));
    });

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
