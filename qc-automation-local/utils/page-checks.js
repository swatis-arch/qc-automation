/**
 * utils/page-checks.js — shared page-level assertions
 */

const { expect } = require('@playwright/test');

const NOT_FOUND = /\b404\b|page not found|not found/i;

/**
 * Assert the current page is NOT a 404 / "page not found" page.
 *
 * Judges by what identifies a 404 -- its <title>, its headline, or Shopify's
 * `template-404` body class -- rather than searching the whole body text for
 * "404", which false-positives on prices, phone numbers and financing amounts
 * (e.g. ABC's "Interest (15% APR) $404.80").
 *
 * @param {import('@playwright/test').Page} page
 */
async function expectPageFound(page) {
    expect(await page.title(), 'page title looks like a 404 / not-found page').not.toMatch(NOT_FOUND);
    await expect(
        page.locator('h1').filter({ hasText: NOT_FOUND }),
        'page headline looks like a 404 / not-found page'
    ).toHaveCount(0);
    await expect(
        page.locator('body.template-404, body[class*="template-404"]'),
        'page uses the 404 template'
    ).toHaveCount(0);
}

/** Content of the first <meta name="description">, or null. */
function getMetaDescription(page) {
    return page.locator('meta[name="description"]').first().getAttribute('content');
}

/** Locator for <link rel="canonical">. */
function canonicalLink(page) {
    return page.locator('link[rel="canonical"]');
}

/**
 * How many px the page is wider than the viewport (0 = no horizontal scroll).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
function horizontalOverflow(page) {
    return page.evaluate(() => {
        const root = document.documentElement;
        return Math.max(0, root.scrollWidth - root.clientWidth);
    });
}

/**
 * Numeric value of a price string ("$1,105.00" -> 1105). NaN when there is none.
 * Reads the FIRST number, so "$105 $122" (price + compare-at) gives 105.
 * @param {string} text
 * @returns {number}
 */
function parseMoney(text) {
    const match = String(text).replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : NaN;
}

module.exports = { expectPageFound, getMetaDescription, canonicalLink, horizontalOverflow, parseMoney, NOT_FOUND };
