/**
 * Dynamic Page Fetcher - 使用 Playwright 获取 JavaScript 渲染的页面
 *
 * 用法: node browser.js <url>
 * 输出: 完整的 HTML 内容（包括 JS 渲染后的内容）
 */

// 绕过系统代理设置
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.http_proxy;
delete process.env.https_proxy;
delete process.env.ALL_PROXY;
delete process.env.all_proxy;

import { chromium } from 'playwright';

(async () => {
    const url = process.argv[2];
    if (!url) {
        console.error('Usage: node browser.js <url>');
        process.exit(1);
    }

    let browser;
    try {
        // 启动浏览器，绕过代理
        browser = await chromium.launch({
            headless: true,
            proxy: undefined  // 明确不使用代理
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            bypassCSP: true,
        });

        const page = await context.newPage();

        // 等待页面加载完成
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        // 额外等待一下，确保动态内容加载
        await page.waitForTimeout(2000);

        const content = await page.content();
        console.log(content);

    } catch (error) {
        console.error('Error fetching page:', error.message);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
