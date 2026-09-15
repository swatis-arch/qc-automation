/**
 * utils/console.js — Console Error Capture
 *
 * Attaches listeners to a Playwright page and collects all browser
 * console errors and unhandled JavaScript exceptions.
 *
 * Usage:
 *   const { captureConsoleErrors } = require('../utils/console');
 *   const errors = captureConsoleErrors(page);
 *   await page.goto('/');
 *   // errors[] now contains any console errors emitted during navigation
 */

/**
 * Attach console error and pageerror listeners to a Playwright page.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page instance.
 * @returns {{ errors: string[], getErrors: () => string[] }}
 *   An object containing the live errors array and a snapshot getter.
 */
function captureConsoleErrors(page) {
    const errors = [];

    // Capture browser console error messages (console.error, console.warn)
    page.on('console', message => {
        if (message.type() === 'error') {
            errors.push({
                type:    'console.error',
                message: message.text(),
                url:     page.url(),
            });
        }
    });

    // Capture uncaught JavaScript exceptions (unhandled errors / promise rejections)
    page.on('pageerror', error => {
        errors.push({
            type:    'pageerror',
            message: error.message,
            stack:   error.stack,
            url:     page.url(),
        });
    });

    return {
        /** Live reference to the errors array */
        errors,

        /** Returns a frozen snapshot of errors at the time of calling */
        getErrors: () => [...errors],

        /** True if any errors were captured */
        hasErrors: () => errors.length > 0,

        /** Returns errors as formatted strings for logging */
        toStrings: () => errors.map(e => `[${e.type}] ${e.message}`),
    };
}

module.exports = { captureConsoleErrors };
