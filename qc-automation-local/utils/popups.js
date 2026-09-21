/**
 * utils/popups.js — Close marketing popups first, then run the test
 *
 * Merchants show newsletter / "15% off" popups (KOH, Revitin: the Alia popup
 * vendor) that cover the page and swallow clicks. They are only served to
 * headed browsers, ~5-8 s after load. This module closes them so every test
 * starts from a clean page, on every merchant:
 *
 *   1. installPopupGuard()  auto `popupGuard` fixture, before any navigation:
 *        - a Playwright locator handler: whenever the close control is visible
 *          while an action/assertion runs, it is clicked first
 *        - a background closer on every page load (covers raw page.goto())
 *   2. dismissPopups()      called by the page objects right after they
 *        navigate, so the popup is gone BEFORE the test proceeds. On merchants
 *        with `features.popup` and in headed runs it waits (up to POPUP_WAIT_MS)
 *        for a delayed popup to appear, once per test.
 *
 * Close control: generic Alia selector below + optional merchant
 * `popupClose` locator (merchants/<slug>/locators.js). Cookie/consent bars are
 * NOT touched -- accepting cookies is a consent choice, not a test step.
 *
 * Env: POPUP_WAIT_MS (default 12000; 0 = never wait for a popup to appear)
 */

// Alia popups (KOH, Revitin). Playwright CSS pierces open shadow roots, so this
// also matches when the popup lives inside a shadow DOM (Revitin).
const GENERIC_CLOSE = '[aria-label="Close popup"]';

const WAIT_MS = (() => {
    const n = Number(process.env.POPUP_WAIT_MS);
    return Number.isFinite(n) && n >= 0 ? n : 12_000;
})();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** page -> { headed: boolean, closed: boolean, pending?: Promise } */
const state = new WeakMap();

function closeLocator(page, merchant) {
    const selector = merchant && merchant.locators
        ? merchant.locators.resolve('popupClose', GENERIC_CLOSE)
        : GENERIC_CLOSE;
    return page.locator(selector).filter({ visible: true }).first();
}

/**
 * Close a visible popup; optionally wait for a delayed one to appear first.
 * Never throws -- popup handling must not break a test.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [merchant] - merchant config (locators + features.popup)
 * @param {{ waitMs?: number }} [options] - override how long to wait for a popup to appear
 * @returns {Promise<boolean>} true if a popup was closed
 */
async function dismissPopups(page, merchant, options = {}) {
    const st = state.get(page) || { headed: false, closed: false };
    state.set(page, st);
    // A dismissal already running on this page (e.g. the background closer) is shared, not duplicated.
    if (st.pending) return st.pending;
    st.pending = closeWhenVisible(page, merchant, st, options).finally(() => { st.pending = null; });
    return st.pending;
}

async function closeWhenVisible(page, merchant, st, { waitMs } = {}) {
    try {
        const expected = !!(merchant && merchant.features && merchant.features.popup);
        // Only wait for a not-yet-visible popup when we expect one, it can appear
        // (headed), and we haven't already closed one on this page.
        const budget = waitMs ?? (expected && st.headed && !st.closed ? WAIT_MS : 0);

        const close = closeLocator(page, merchant);
        const deadline = Date.now() + budget;

        for (;;) {
            if (page.isClosed()) return false;
            if (await close.isVisible().catch(() => false)) {
                await close.click({ timeout: 5_000 }).catch(() => {});
                await close.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
                st.closed = true;
                console.log(`[popup] closed a popup on ${merchant ? merchant.slug : 'page'} (${page.url().split('?')[0]})`);
                return true;
            }
            if (Date.now() >= deadline) return false;
            await sleep(250);
        }
    } catch {
        return false;
    }
}

/**
 * Install the popup guard on a page. Call once per test, before navigating.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} merchant
 * @param {{ headed: boolean }} options
 */
async function installPopupGuard(page, merchant, { headed }) {
    state.set(page, { headed: !!headed, closed: false, pending: null });

    const close = closeLocator(page, merchant);
    // noWaitAfter + times: some widgets (e.g. ABC's "Mystery Offer" tab) don't disappear when their
    // X is clicked; without these, Playwright would wait for it to vanish and block the test action.
    await page.addLocatorHandler(close, async () => {
        await close.click({ timeout: 5_000 }).catch(() => {});   // may already be gone
        const st = state.get(page);
        if (st) st.closed = true;
    }, { noWaitAfter: true, times: 3 });

    // Cover navigations the page objects don't drive (tests calling page.goto directly).
    page.on('domcontentloaded', () => { dismissPopups(page, merchant).catch(() => {}); });
}

module.exports = { dismissPopups, installPopupGuard, GENERIC_CLOSE };
