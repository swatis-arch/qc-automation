/**
 * utils/scroll.js — scroll a page from top to bottom in viewport-sized steps
 *
 * Shared by HomePage and PLPPage: triggering lazy-loaded images/sections the
 * way a visitor's scroll would, rather than an instant jump that some
 * lazy-loaders (IntersectionObserver-based or not) don't react to the same way.
 */

/**
 * @param {import('@playwright/test').Page} page
 */
async function scrollThroughPage(page) {
    const viewportHeight = page.viewportSize().height;
    for (;;) {
        const { y, max } = await page.evaluate(() => ({
            y:   window.scrollY,
            max: document.documentElement.scrollHeight - window.innerHeight,
        }));
        if (y >= max) break;
        await page.mouse.wheel(0, viewportHeight * 0.8);
        await page.waitForTimeout(150);   // give the lazy-loader time to react between steps
    }
    await page.evaluate(() => window.scrollTo(0, 0));
}

module.exports = { scrollThroughPage };
