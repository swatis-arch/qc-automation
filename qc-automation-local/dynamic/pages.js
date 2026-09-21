/**
 * dynamic/pages.js -- Page pool
 *
 * Opens each (page type x viewport) combination once and hands the same
 * live page to the scraper and the resolver, so a full onboard loads every
 * page a single time. Viewports mirror the Playwright projects the suite
 * runs: 'desktop' = Desktop Chrome, 'mobile' = Pixel 7.
 */

'use strict';

const { chromium, devices } = require('@playwright/test');

const DEVICES = { desktop: devices['Desktop Chrome'], mobile: devices['Pixel 7'] };

// Same third-party noise the fixtures block (fixtures/base.js setupPage).
const BLOCKED = ['**/*klaviyo*', '**/*onetrust*', '**/*cookielaw*', '**/*usercentrics*', '**/*cookiehub*'];

/** Page type -> path, from a merchant config. */
function pagePaths(merchant) {
    return {
        home:       merchant.pages.homepage   || '/',
        collection: merchant.pages.collection || '/collections/all',
        product:    merchant.products?.default?.path || merchant.pages.product || '/',
        cart:       merchant.pages.cart       || '/cart',
    };
}

class PagePool {

    /**
     * @param {object} merchant - merchant config (urls, pages, products)
     */
    constructor(merchant) {
        this.merchant = merchant;
        this.baseURL  = process.env.USE_STAGING === 'true' ? merchant.urls.staging : merchant.urls.production;
        this.paths    = pagePaths(merchant);
        this.browser  = null;
        this.contexts = {};
        this.pages    = new Map();
    }

    async open() {
        this.browser = await chromium.launch({ headless: true });
        return this;
    }

    async _context(viewport) {
        if (!this.contexts[viewport]) {
            const ctx = await this.browser.newContext({ ...DEVICES[viewport], baseURL: this.baseURL });
            for (const pattern of BLOCKED) await ctx.route(pattern, route => route.abort());
            this.contexts[viewport] = ctx;
        }
        return this.contexts[viewport];
    }

    /** Navigate and let lazy content (cards, images) render. */
    async _load(page, pageType) {
        await page.goto(this.paths[pageType], { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await page.evaluate(async () => {
            const max = Math.min(document.documentElement.scrollHeight, 4000);
            for (let y = 0; y < max; y += 800) {
                window.scrollTo(0, y);
                await new Promise(r => setTimeout(r, 120));
            }
            window.scrollTo(0, 0);
        }).catch(() => {});
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(400);
    }

    /** Cached, loaded page for (pageType, viewport). */
    async get(pageType, viewport) {
        const key = `${pageType}|${viewport}`;
        if (!this.pages.has(key)) {
            const page = await (await this._context(viewport)).newPage();
            await this._load(page, pageType);
            this.pages.set(key, page);
        }
        return this.pages.get(key);
    }

    /** A brand-new loaded page (for behavioural checks that click things). Caller closes it. */
    async fresh(pageType, viewport) {
        const page = await (await this._context(viewport)).newPage();
        await this._load(page, pageType);
        return page;
    }

    async close() {
        await this.browser?.close();
    }
}

module.exports = { PagePool, pagePaths };
