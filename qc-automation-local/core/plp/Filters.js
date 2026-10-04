/**
 * core/plp/Filters.js — Collection filter panel component
 *
 * Only merchants with `features.filters` (a collection-filtering app —
 * Shopify's native Search & Discovery, Searchspring, etc.) define the
 * locators this reads (`filterToggle`, `filterOption`, ...); specs gate on
 * that flag before touching this, the same way homepage gates on
 * `features.search`. There is no cross-theme fallback chain here on
 * purpose — an app-driven filter panel's markup is entirely app-specific,
 * unlike a plain Dawn header/hero that many merchants share.
 */

class Filters {

    /**
     * @param {import('@playwright/test').Page} page
     * @param {import('../../locators/LocatorManager')} locators
     */
    constructor(page, locators) {
        this.page     = page;
        this.locators = locators;
    }

    /** The button/toggle that reveals the filter panel. */
    get toggle() {
        return this.page.locator(this.locators.get('filterToggle')).first();
    }

    /** Every filter option control (checkboxes/radios) once the panel is open. */
    get options() {
        return this.page.locator(this.locators.get('filterOption')).filter({ visible: true });
    }

    /** Filter options that share one group (e.g. all "brand" values), by their `name` attribute. */
    optionsInGroup(name) {
        return this.page.locator(`${this.locators.get('filterOption')}[name="${name}"]`).filter({ visible: true });
    }

    /**
     * A snapshot of every option's identity (id/name/checked), captured once. Apps like
     * Searchspring re-sort filter values by live result count after each apply, so "index N"
     * can refer to a different value the next time the panel opens — capturing ids upfront and
     * applying by id (see `applyById`) is stable against that reordering; re-deriving "the
     * current index" after each interaction is not.
     * @returns {Promise<{ id: string, name: string, checked: boolean }[]>}
     */
    async listOptions() {
        return this.options.evaluateAll(els => els.map(el => ({ id: el.id, name: el.name, checked: el.checked })));
    }

    /**
     * Apply a specific option by its `id` (from `listOptions()`), regardless of where it now
     * sorts in the panel. Opens the panel first if needed.
     * @param {string} id
     */
    async applyById(id) {
        await this.open();
        const label = this.page.locator(`label[for="${id}"]`).filter({ visible: true }).first();
        const option = this.page.locator(`[id="${id}"]`);   // not `#id` — avoids needing to escape CSS-special characters some app-generated ids contain
        const target = await label.count() > 0 ? label : option;
        const chipsBefore = await this.activeChips.count();

        await Promise.all([
            this.page.waitForFunction(() => location.search.includes('filter.'), null, { timeout: 10_000 }),
            target.click({ force: true }),
        ]);
        await this.page.waitForLoadState('domcontentloaded');
        // Orion's Horizon theme filters without a reload: the URL updates (pushState) before the
        // re-rendered chips land, so wait for the new chip rather than reading a stale panel.
        const deadline = Date.now() + 10_000;
        while (await this.activeChips.count() <= chipsBefore && Date.now() < deadline) {
            await this.page.waitForTimeout(200);
        }
    }

    /** Chips shown for each currently-applied filter. */
    get activeChips() {
        return this.page.locator(this.locators.get('activeFilterChip')).filter({ visible: true });
    }

    /** The "clear all" / "reset" control, if the merchant has one configured. */
    get clearAllButton() {
        return this.locators.has('clearFiltersBtn') ? this.page.locator(this.locators.get('clearFiltersBtn')).first() : null;
    }

    /** Open the filter panel (no-op if it's already open / always visible). */
    async open() {
        if (await this.options.count() > 0) return;   // already open
        await this.toggle.click({ force: true });
        await this.options.first().waitFor({ state: 'visible', timeout: 10_000 });
    }

    /**
     * Apply the filter option at `index` (its own label is clicked, not the
     * checkbox directly — some apps render the real input off-screen and
     * rely on the label for the click target) and wait for the results to
     * reflect it via a `filter.` URL param.
     * @param {number} [index]
     */
    async applyOption(index = 0) {
        const option = this.options.nth(index);
        const id = await option.getAttribute('id');
        // This app duplicates its filter markup for desktop/mobile with the SAME ids on both
        // copies, so `label[for=id]` matches two elements — `.first()` in DOM order can land on
        // the hidden one. Filtering to the currently-visible label picks the real one regardless
        // of which breakpoint is active, and the input itself is deliberately off-screen (not
        // just hidden), so it's the label that must be clicked either way.
        const label = id ? this.page.locator(`label[for="${id}"]`).filter({ visible: true }).first() : null;
        const target = label && await label.count() > 0 ? label : option;

        // Not page.waitForURL(): it waits on a 'load' event, and on this app a slow/hung
        // third-party script can keep that from ever firing even though the URL (and the
        // results) already updated. A plain DOM check of location.search isn't tied to 'load'.
        await Promise.all([
            this.page.waitForFunction(() => location.search.includes('filter.'), null, { timeout: 10_000 }),
            target.click({ force: true }),
        ]);
        await this.page.waitForLoadState('domcontentloaded');
    }

    /** Click the "clear all" control and wait for the `filter.` params to leave the URL. */
    async clearAll() {
        const clearAll = this.clearAllButton;
        if (!clearAll || await clearAll.count() === 0) {
            throw new Error('[Filters] No clear-all control configured for this merchant.');
        }
        await clearAll.click({ force: true });
        await this.page.waitForFunction(() => !location.search.includes('filter.'), null, { timeout: 10_000 });
        await this.page.waitForLoadState('domcontentloaded');
    }
}

module.exports = Filters;
