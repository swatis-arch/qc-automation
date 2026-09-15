/**
 * core/navigation/Navbar.js — Navbar Component
 *
 * Handles desktop navigation, mega-menu interactions, and mobile menu
 * operations. Shared across all page objects that need navigation.
 *
 * Merchant config is injected via constructor — no hardcoded merchant.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} merchant - Merchant config from merchants/<slug>/config.js
 */

class Navbar {

    constructor(page, merchant) {
        this.page     = page;
        this.merchant = merchant;
    }

    // -- Logo -------------------------------------------------------------------

    /** Click the site logo and return to homepage */
    async clickLogo() {
        await this.page.locator('a.header__heading-link, a[href="/"]').first().click();
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
                .locator(`a[href="${link.href}"]`)
                .filter({ visible: true })
                .first();
            await locator.waitFor({ state: 'visible', timeout: 10_000 });
        }
    }

    /** Click the Best Sellers nav link */
    async clickBestSellers() {
        await this.page.locator('a[href="/collections/best-sellers"]').filter({ visible: true }).first().click();
        await this.page.waitForLoadState('domcontentloaded');
    }

    // -- Mega-menus -------------------------------------------------------------

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
        const submenu = this.page.locator('.menu-item__submenu').first();
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
        const hamburger = this.page.locator(
            'button.hamburger, button[aria-label*="Open navigation"], button[aria-label*="menu" i]'
        ).first();
        await hamburger.waitFor({ state: 'visible', timeout: 10_000 });
        await hamburger.click();
        await this.page.locator(this.merchant.selectors.mobileMenu).waitFor({ state: 'visible', timeout: 10_000 });
    }

    /** Close the mobile hamburger menu */
    async closeMobileMenu() {
        const closeBtn = this.page.locator([
            'button[aria-label*="Close navigation" i]',
            'button[aria-label*="close menu" i]',
            'button[aria-expanded="true"]',
            '.nav__close-btn',
            `${this.merchant.selectors.mobileMenu} button[aria-label*="close" i]`,
        ].join(', ')).first();

        if (await closeBtn.count() > 0) {
            await closeBtn.click();
        } else {
            await this.page.keyboard.press('Escape');
        }
        await this.page.locator(this.merchant.selectors.mobileMenu).waitFor({ state: 'hidden', timeout: 10_000 });
    }
}

module.exports = Navbar;
