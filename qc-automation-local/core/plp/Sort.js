/**
 * core/plp/Sort.js — Collection sort component
 *
 * Two real shapes seen across merchants, both driven from this one class:
 *   - a native <select> (Outset uses name="sort", Koh/Dawn themes use
 *     name="sort_by") — handled with Playwright's own selectOption()
 *   - a custom, JS-driven dropdown with no <select> at all (Abc's
 *     `.sort-by-dropdown`: a toggle + a list of clickable options) — opened
 *     with a click, then the wanted option is clicked by its visible text
 *
 * Either way the result is a `sort_by`/`sort` query param and a reordered
 * grid, so callers just ask for an option by its visible label and don't
 * need to know which shape the merchant uses.
 */

class Sort {

    /**
     * @param {import('@playwright/test').Page} page
     * @param {import('../../locators/LocatorManager')} locators
     */
    constructor(page, locators) {
        this.page     = page;
        this.locators = locators;
    }

    /**
     * The native <select>, if this theme shows one. Visible only: Orion's Horizon theme keeps a
     * hidden, disabled <select name="sort_by"> in the DOM behind its custom dropdown.
     */
    get nativeSelect() {
        return this.page.locator('select[name="sort_by"], select[name="sort"], .collection-sort select').filter({ visible: true }).first();
    }

    /** The custom dropdown's toggle, if this merchant has one (`sortToggle` locator). */
    get customToggle() {
        return this.locators.has('sortToggle') ? this.page.locator(this.locators.get('sortToggle')).first() : null;
    }

    /** Whether any sort control exists on this collection. */
    async isAvailable() {
        if (await this.nativeSelect.count() > 0) return true;
        const toggle = this.customToggle;
        return toggle ? (await toggle.count()) > 0 : false;
    }

    /**
     * Whether a sort option matching `pattern` is offered here — not every merchant's sort
     * control has every option (Outset's has Price/Best Selling only, no alphabetical).
     * @param {RegExp} pattern
     * @returns {Promise<boolean>}
     */
    async hasOption(pattern) {
        const select = this.nativeSelect;
        if (await select.count() > 0) {
            return select.evaluate((el, source) => {
                const pattern = new RegExp(source.body, source.flags);
                return [...el.options].some(o => pattern.test(o.textContent));
            }, { body: pattern.source, flags: pattern.flags });
        }

        const toggle = this.customToggle;
        if (!toggle || await toggle.count() === 0) return false;
        await toggle.click();
        const found = await this.page.getByText(pattern).filter({ visible: true }).count() > 0;
        await toggle.click();   // close it again — this was only a peek, not a real selection
        return found;
    }

    /**
     * Choose a sort option whose visible label matches `pattern` (e.g.
     * /price.*low.*high/i — wording differs per merchant: "Price: Low to
     * High" vs "Price, low to high"). Waits for the resulting
     * navigation/re-render to settle.
     * @param {RegExp} pattern
     */
    async selectByLabel(pattern) {
        const select = this.nativeSelect;
        if (await select.count() > 0) {
            const value = await select.evaluate((el, source) => {
                const pattern = new RegExp(source.body, source.flags);
                const match = [...el.options].find(o => pattern.test(o.textContent));
                return match ? match.value : null;
            }, { body: pattern.source, flags: pattern.flags });
            if (!value) throw new Error(`[Sort] No option matching ${pattern} in the sort <select>.`);

            await select.selectOption(value);
            await this.page.waitForLoadState('domcontentloaded');
            // domcontentloaded only guarantees the initial HTML parsed — on a theme that
            // hydrates/re-sorts the grid client-side after that, reading cards immediately can
            // still catch the pre-sort (or, verified on Koh, a still-empty mid-render) grid.
            await this.page.waitForTimeout(1_500);
            return;
        }

        const toggle = this.customToggle;
        if (!toggle || await toggle.count() === 0) {
            throw new Error('[Sort] No sort control found on this collection.');
        }
        await toggle.click();
        // role=option first: on Orion's Horizon theme the option row intercepts clicks on its inner label <span>.
        const option = this.page.getByRole('option', { name: pattern }).or(this.page.getByText(pattern)).filter({ visible: true }).first();
        await option.waitFor({ state: 'visible', timeout: 5_000 });
        await option.click();

        // Not page.waitForURL(): whether (and under what param name — Abc's is `sort.ss_price`,
        // not `sort_by`/`sort`) a custom dropdown reflects its choice in the URL is app-specific
        // and not worth hard-coding here. The toggle's own "currently selected" label (verified:
        // e.g. `<li class="dropdown-selected">Price: Low to High</li>`) is the one signal every
        // such widget needs to expose to its own user, so it's the reliable thing to wait on.
        // A plain locator poll, not an ElementHandle: a handle can go stale if the option click
        // caused a real navigation, where the toggle briefly doesn't exist mid-reload — a fresh
        // locator re-resolves it once the new document is ready instead of erroring on the gap.
        const deadline = Date.now() + 10_000;
        for (;;) {
            const text = await toggle.textContent().catch(() => '');
            if (pattern.test(text)) break;
            if (Date.now() > deadline) throw new Error(`[Sort] Toggle never showed a selection matching ${pattern} (last saw "${text}").`);
            await this.page.waitForTimeout(200);
        }
        await this.page.waitForLoadState('domcontentloaded');
    }

    /**
     * The sort value currently in the URL, or null. Checks the common `sort_by`/`sort` param
     * names plus any `sort.*` param (Searchspring's convention, e.g. `sort.ss_price=asc`) —
     * whichever this merchant's app actually uses.
     */
    currentUrlValue() {
        const params = new URL(this.page.url()).searchParams;
        const sortParam = [...params.keys()].find(key => key.startsWith('sort.'));
        return params.get('sort_by') || params.get('sort') || (sortParam ? params.get(sortParam) : null);
    }
}

module.exports = Sort;
