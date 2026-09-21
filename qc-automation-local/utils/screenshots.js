/**
 * utils/screenshots.js — Screenshot Helpers
 *
 * Provides named screenshot capture beyond the built-in Playwright
 * "only-on-failure" mode. Useful for capturing mid-test state for
 * inclusion in failure evidence bundles sent to Claude.
 *
 * Usage:
 *   const { takeScreenshot } = require('../utils/screenshots');
 *   const path = await takeScreenshot(page, 'cart-after-add', testInfo);
 */

const fs   = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(process.cwd(), 'reports', 'screenshots');

/**
 * Ensure the screenshots output directory exists.
 */
function ensureDir() {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
}

/**
 * Take a named screenshot and save it to reports/screenshots/.
 *
 * @param {import('@playwright/test').Page} page - Playwright page instance.
 * @param {string} name - Descriptive name for the screenshot (no extension).
 * @param {import('@playwright/test').TestInfo} [testInfo] - Playwright TestInfo for attaching to report.
 * @param {{ fullPage?: boolean }} [options] - Screenshot options.
 * @returns {Promise<string>} Absolute path to the saved screenshot.
 */
async function takeScreenshot(page, name, testInfo = null, options = {}) {
    ensureDir();

    const sanitized  = name.replace(/[^a-zA-Z0-9-_]/g, '-');
    const timestamp  = Date.now();
    const filename   = `${sanitized}-${timestamp}.png`;
    const outputPath = path.join(SCREENSHOTS_DIR, filename);

    await page.screenshot({
        path:     outputPath,
        fullPage: options.fullPage ?? false,
        ...options,
    });

    // Attach to Playwright HTML report if TestInfo is available
    if (testInfo) {
        await testInfo.attach(sanitized, {
            path:      outputPath,
            contentType: 'image/png',
        });
    }

    return outputPath;
}

/**
 * Take a full-page screenshot.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {import('@playwright/test').TestInfo} [testInfo]
 * @returns {Promise<string>}
 */
async function takeFullPageScreenshot(page, name, testInfo = null) {
    return takeScreenshot(page, name, testInfo, { fullPage: true });
}

module.exports = { takeScreenshot, takeFullPageScreenshot, SCREENSHOTS_DIR };
