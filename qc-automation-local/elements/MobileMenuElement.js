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
            '.menu-drawer__close-button:visible',   // Horizon (Orion)
        ].join(', ')).first();

        if (await explicitCloseBtn.count() > 0) {
            await explicitCloseBtn.click();
        } else {
            await this.page.keyboard.press('Escape');
        }
        await this.menu.waitFor({ state: 'hidden', timeout: 10_000 });
    }

    /**
     * Whether the page behind the menu is scroll-locked (html/body overflow: hidden).
     * Compare before opening and after closing to check the menu gives scrolling back
     * (some pages, like ABC's full-page hero slideshow, are always locked).
     */
    isPageScrollLocked() {
        // `body` can momentarily be absent right after the close animation swaps content
        // in some themes — filter to real elements before calling getComputedStyle on them.
        return this.page.evaluate(() => [document.documentElement, document.body]
            .filter(el => el instanceof Element)
            .some(el => getComputedStyle(el).overflowY === 'hidden'));
    }

    /**
     * Scroll the open menu to its end and report whether every item was reachable.
     * `scrollable` is false when the menu fits on screen (nothing to scroll).
     *
     * @returns {Promise<{ scrollable: boolean, lastLinkInView: boolean, pageScrolled: boolean }>}
     */
    scrollToEnd() {
        return this.menu.first().evaluate(async menu => {
            const scroller = [menu, ...menu.querySelectorAll('*')].find(el =>
                el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY));
            if (!scroller) return { scrollable: false, lastLinkInView: true, pageScrolled: false };

            const pageYBefore = window.scrollY;
            scroller.scrollTop = scroller.scrollHeight;
            await new Promise(resolve => requestAnimationFrame(() => resolve()));

            const links = [...menu.querySelectorAll('a[href]')].filter(a => a.getBoundingClientRect().height > 0);
            const last  = links[links.length - 1]?.getBoundingClientRect();
            return {
                scrollable:     true,
                lastLinkInView: !!last && last.top >= 0 && last.bottom <= window.innerHeight + 1,
                pageScrolled:   window.scrollY !== pageYBefore,
            };
        });
    }
}

module.exports = MobileMenuElement;
