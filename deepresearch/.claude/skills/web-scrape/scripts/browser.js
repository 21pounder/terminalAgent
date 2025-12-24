const { chromium } = require('playwright');

(async () => {
    const url = process.argv[2];
    if (!url) {
        console.log('Please provide a URL');
        process.exit(1);
    }
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        const page = await context.newPage();

        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        const content = await page.content();
        console.log(content);

    } catch (error) {
        console.error('Error fetching page', error.message);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();