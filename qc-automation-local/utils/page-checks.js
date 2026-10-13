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
 *
 * Takes the SMALLEST number found, not the first: a card/price element showing
 * both the current and compare-at price puts them in different orders across
 * themes — current-then-compare ("$105 $122", Outset) and compare-then-current
 * ("$11,955$8,966", Abc) both appear in this codebase. The compare-at price is
 * always >= the actual price by definition, so the minimum is always the real
 * one, and with a single plain price this is just that price.
 * @param {string} text
 * @returns {number}
 */
function parseMoney(text) {
    const numbers = [...String(text).replace(/,/g, '').matchAll(/\d+(\.\d+)?/g)].map(m => parseFloat(m[0]));
    return numbers.length ? Math.min(...numbers) : NaN;
}

/**
 * Stable identity of a Shopify image URL, so the same file can be matched across its
 * resized/cropped CDN variants ("x_600x.jpg?v=1" and "//cdn/.../x.jpg" -> "x").
 * @param {string} src
 * @returns {string}
 */
function imageKey(src) {
    const file = String(src || '').split('?')[0].split('/').pop();
    return file.replace(/\.(jpe?g|png|webp|gif|avif)$/i, '')
        .replace(/_(\d+x\d*|x\d+|small|medium|large|grande|master)(_crop_\w+)?$/i, '')
        .toLowerCase();
}

// Leftover template/demo text: lorem ipsum, Shopify's default section copy ("Talk about your
// brand", "Example product title"), unrendered Liquid/JS values.
const PLACEHOLDER_TEXT = /lorem ipsum|dolor sit amet|your (text|heading|title|content) here|example product( title)?\b|talk about your brand|\{\{[^}]*\}\}|\[object Object\]/i;
const BROKEN_TEMPLATE  = /\bundefined\b|\bNaN\b/;

module.exports = { expectPageFound, getMetaDescription, canonicalLink, horizontalOverflow, parseMoney, imageKey, NOT_FOUND, PLACEHOLDER_TEXT, BROKEN_TEMPLATE };
