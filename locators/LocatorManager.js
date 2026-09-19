/**
 * locators/LocatorManager.js — Locator Manager
 *
 * Central resolver for merchant-specific locators. Each merchant defines
 * its raw selector strings in merchants/<slug>/locators.js; page objects
 * and business elements never read that raw object directly -- they go
 * through a LocatorManager instance instead (wired in as `merchant.locators`
 * by merchants/index.js).
 *
 * Three ways to read a locator:
 *  - get(key)                - the merchant's verified selector, or throws
 *                               if the merchant hasn't defined one for `key`.
 *                               Use this for locators every merchant must define.
 *  - resolve(key, fallback)  - the merchant's selector (if defined) OR'd
 *                               together with a broad cross-theme fallback
 *                               chain. Use this for optional, theme-variable
 *                               locators where the merchant's selector and
 *                               the fallback are both safe to match at once.
 *  - preferred(key, fallback) - the merchant's selector if defined, else the
 *                               fallback chain -- never both. Use this when a
 *                               verified merchant selector deliberately
 *                               excludes a decoy element (e.g. a duplicate
 *                               "sticky bar" button elsewhere on the page);
 *                               OR-ing in the generic fallback would
 *                               reintroduce the exact ambiguity the merchant
 *                               selector exists to avoid.
 */

class LocatorManager {

    /**
     * @param {string} merchantSlug
     * @param {object} rawLocators - the object exported by merchants/<slug>/locators.js
     */
    constructor(merchantSlug, rawLocators) {
        this.merchantSlug = merchantSlug;
        this.raw = rawLocators || {};
    }

    /**
     * Returns the merchant's verified selector for `key`.
     * Throws if not defined -- a missing locator should fail loudly at the
     * point of use, not silently resolve to `undefined` inside page.locator().
     * @param {string} key
     * @returns {string}
     */
    get(key) {
        const selector = this.raw[key];
        if (!selector) {
            throw new Error(
                `[LocatorManager:${this.merchantSlug}] No locator defined for "${key}". ` +
                `Add it to merchants/${this.merchantSlug}/locators.js.`
            );
        }
        return selector;
    }

    /**
     * Returns the merchant's selector for `key` (if defined) combined with
     * a broad cross-theme fallback chain, comma-joined for Playwright's
     * selector-list syntax.
     * @param {string} key
     * @param {string} fallbackChain
     * @returns {string}
     */
    resolve(key, fallbackChain) {
        const selector = this.raw[key];
        return selector ? `${selector}, ${fallbackChain}` : fallbackChain;
    }

    /**
     * Returns the merchant's selector for `key` if defined, otherwise the
     * fallback chain -- never both combined. See class docs for when to
     * prefer this over resolve().
     * @param {string} key
     * @param {string} fallbackChain
     * @returns {string}
     */
    preferred(key, fallbackChain) {
        return this.has(key) ? this.raw[key] : fallbackChain;
    }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return Boolean(this.raw[key]);
    }
}

module.exports = LocatorManager;
