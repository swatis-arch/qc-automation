/**
 * utils/network.js — Network Failure Capture
 *
 * Attaches a response listener to a Playwright page and collects all
 * HTTP 4xx and 5xx responses for inclusion in failure evidence.
 *
 * Usage:
 *   const { captureNetworkFailures } = require('../utils/network');
 *   const network = captureNetworkFailures(page);
 *   await page.goto('/products/example');
 *   console.log(network.getFailures()); // [{ url, status, method }]
 */

/**
 * List of URL patterns to ignore (third-party analytics noise).
 * These commonly return 4xx under normal conditions and are not product bugs.
 */
const IGNORE_PATTERNS = [
    /klaviyo/i,
    /onetrust/i,
    /cookielaw/i,
    /doubleclick/i,
    /google-analytics/i,
    /googletagmanager/i,
    /facebook\.net/i,
    /hotjar/i,
    /segment\.io/i,
];

/**
 * Determines whether a response URL should be filtered out of failure tracking.
 * @param {string} url
 * @returns {boolean}
 */
function shouldIgnore(url) {
    return IGNORE_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Attach a network response listener to a Playwright page.
 * Captures all HTTP 4xx/5xx responses (excluding filtered third-party URLs).
 *
 * @param {import('@playwright/test').Page} page - The Playwright page instance.
 * @returns {{ failures: Array, getFailures: () => Array, hasFailures: () => boolean }}
 */
function captureNetworkFailures(page) {
    const failures = [];

    page.on('response', response => {
        const status = response.status();
        const url    = response.url();

        if (status >= 400 && !shouldIgnore(url)) {
            failures.push({
                url,
                status,
                method:        response.request().method(),
                resourceType:  response.request().resourceType(),
                timestamp:     new Date().toISOString(),
            });
        }
    });

    return {
        /** Live reference to the failures array */
        failures,

        /** Returns a frozen snapshot of failures at the time of calling */
        getFailures: () => [...failures],

        /** True if any network failures were captured */
        hasFailures: () => failures.length > 0,

        /** Returns only failures matching a URL pattern */
        getFailuresFor: (pattern) => failures.filter(f => pattern.test(f.url)),

        /** Returns failures as formatted strings for logging */
        toStrings: () => failures.map(f => `[${f.status}] ${f.method} ${f.url}`),
    };
}

module.exports = { captureNetworkFailures, shouldIgnore };
