/**
 * core/navigation/Navbar.js — Navbar Component
 *
 * Handles desktop navigation, mega-menu interactions, and mobile menu
 * operations. Shared across all page objects that need navigation.
 *
 * Merchant config is injected via constructor — no hardcoded merchant.
 * Mobile menu open/close is delegated to the shared MobileMenuElement
 * (same business element HomePage uses).
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} merchant - Merchant config from merchants/<slug>/config.js
 */

const MobileMenuElement = require('../../elements/MobileMenuElement');

class Navbar {

    constructor(page, merchant) {
        this.page       = page;
        this.merchant   = merchant;
        this.locators   = merchant.locators;
        this.mobileMenu = new MobileMenuElement(page, this.locators);
    }

    // -- Logo -------------------------------------------------------------------

    /** Click the site logo and return to homepage */
    async clickLogo() {
        await this.page.locator(this.locators.resolve('logo', 'a[href="/"]')).first().click();
        await this.page.waitForLoadState('domcontentloaded');
    }

    // -- Desktop nav links ------------------------------------------------------

    /**
     * Verify all primary desktop nav links are visible.
     * Links are pulled from the merchant config's navLinks array.
     */
    async verifyAllNavLinksVisible() {
        const navLinks = this.merchant.navLinks || [];
        for (const link of navLinks) {
            const locator = this.page
                .locator(link.selector || `a[href="${link.href}"]`)
                .filter({ visible: true })
                .first();
            await locator.waitFor({ state: 'visible', timeout: 10_000 });
        }
    }

    /** Click a nav link by its href (e.g. one of merchant.navLinks); `selector` overrides the default a[href] lookup */
    async clickNavLink(href, selector) {
        await this.page.locator(selector || `a[href="${href}"]`).filter({ visible: true }).first().click();
        await this.page.waitForLoadState('domcontentloaded');
    }

    // -- Mega-menus -------------------------------------------------------------

    /** The open mega-menu panel (locator key `megaMenu`, defined per merchant) */
    get megaMenu() {
        return this.page.locator(this.locators.get('megaMenu'));
    }

    /** Hover over the Skincare nav item to open its mega-menu */
    async hoverSkincare() {
        const skincareLink = this.page.locator('nav a[href*="skincare"], .nav__item:has-text("Skincare")').first();
        await skincareLink.hover();
        await this.page.waitForTimeout(300); // Allow CSS transition
    }

    /** Hover over the About Us nav item to open its mega-menu */
    async hoverAboutUs() {
        const aboutUsLink = this.page.locator('.nav__item:has-text("About"), nav a:has-text("About Us")').first();
        await aboutUsLink.hover();
        await this.page.waitForTimeout(300);
    }

    /**
     * Verify the Skincare submenu links are visible.
     */
    async verifySkincareSubmenu() {
        await this.hoverSkincare();
        const submenu = this.megaMenu.first();
        await submenu.waitFor({ state: 'visible', timeout: 5_000 });

        const expectedLinks = [
            '/collections/cleansers-exfoliators',
            '/collections/moisturizers-masks',
            '/collections/serums-oils',
        ];

        for (const href of expectedLinks) {
            await submenu.locator(`a[href="${href}"]`).first().waitFor({ state: 'visible', timeout: 3_000 });
        }
    }

    // -- Mobile menu ------------------------------------------------------------

    /** Open the mobile hamburger menu */
    async openMobileMenu() {
        await this.mobileMenu.open();
    }

    /** Close the mobile hamburger menu */
    async closeMobileMenu() {
        await this.mobileMenu.close();
    }
}

module.exports = Navbar;
