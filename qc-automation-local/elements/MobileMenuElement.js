/**
 * elements/MobileMenuElement.js — Mobile hamburger menu business element
 *
 * The hamburger toggle and slide-out menu behave the same wherever they're
 * driven from (HomePage, Navbar) -- same two locators, same open/close
 * sequence. Both page objects share this instead of each re-declaring it.
 */

class MobileMenuElement {

    /**
     * @param {import('@playwright/test').Page} page
     * @param {import('../locators/LocatorManager')} locators
     */
    constructor(page, locators) {
        this.page = page;
        this.locators = locators;
    }

    /** The hamburger toggle button */
    get hamburger() {
        return this.page.locator(this.locators.get('hamburger')).first();
    }

    /** The slide-out mobile menu panel */
    get menu() {
        return this.page.locator(this.locators.get('mobileMenu'));
    }

    /** Open the mobile menu. */
    async open() {
        await this.hamburger.waitFor({ state: 'visible', timeout: 10_000 });
        await this.hamburger.click();
        await this.menu.waitFor({ state: 'visible', timeout: 10_000 });
    }

    /**
     * Close the mobile menu.
     *
     * The hamburger is a toggle control on every theme seen so far (Dawn's
     * <details>/<summary>, a <button> with aria-expanded, or a <button> with
     * no ARIA state at all) — clicking the same element that opened the menu
     * is the native, unambiguous way to close it, so try that first.
     * force: true — some themes morph the hamburger icon into a visually
     * overlapping close icon (a separate element) at this same position,
     * which would otherwise intercept the click.
     */
    async close() {
        await this.hamburger.click({ force: true });

        const closedViaToggle = await this.menu
            .waitFor({ state: 'hidden', timeout: 3_000 })
            .then(() => true)
            .catch(() => false);
        if (closedViaToggle) return;

        // Fall back to an explicit close button, then Escape, for themes
        // where re-clicking the toggle doesn't close the menu.
        const explicitCloseBtn = this.page.locator([
            'button[aria-label*="Close navigation" i]',
            'button[aria-label*="close menu" i]',
            '.nav__close-btn',
        ].join(', ')).first();

        if (await explicitCloseBtn.count() > 0) {
            await explicitCloseBtn.click();
        } else {
            await this.page.keyboard.press('Escape');
        }
        await this.menu.waitFor({ state: 'hidden', timeout: 10_000 });
    }
}

module.exports = MobileMenuElement;
