/**
 * core/homepage/HomePage.js — Homepage Page Object
 *
 * Encapsulates all interactions with a merchant's homepage.
 * Merchant config is injected via the constructor — no hardcoded merchant.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} merchant - Merchant config from merchants/<slug>/config.js
 */

class HomePage {

    constructor(page, merchant) {
        this.page      = page;
        this.merchant  = merchant;
        this.selectors = merchant.selectors;
    }

    // -- Navigation -------------------------------------------------------------

    /**
     * Navigate to the homepage and wait for DOM to be ready.
     */
    async navigate() {
        await this.page.goto(this.merchant.pages.homepage, { waitUntil: 'domcontentloaded' });
    }

    // -- Header -----------------------------------------------------------------

    /** Returns the main site header locator */
    get header() {
        return this.page.locator(this.selectors.header).first();
    }

    /** Returns the logo image locator */
    get logo() {
        return this.page.locator(this.selectors.logo);
    }

    // -- Promo bar --------------------------------------------------------------

    /** Returns the promo / announcement bar locator */
    get promoBar() {
        return this.page.locator(this.selectors.promoBar).first();
    }

    // -- Hero -------------------------------------------------------------------

    /** Returns the hero section locator */
    get hero() {
        return this.page.locator(this.selectors.hero).first();
    }

    // -- Product cards ----------------------------------------------------------

    /** Returns a locator for all product cards on the homepage */
    get productCards() {
        return this.page.locator(this.selectors.productCard);
    }

    /** Returns the first visible product card */
    get firstProductCard() {
        return this.productCards.first();
    }

    /**
     * Hover over the first product card to reveal the quick-add button.
     */
    async hoverFirstProductCard() {
        await this.firstProductCard.waitFor({ state: 'visible', timeout: 15_000 });
        await this.firstProductCard.hover();
    }

    /**
     * Quick-add the first product and wait for the /cart/add.js response.
     */
    async quickAddFirstProduct() {
        await this.hoverFirstProductCard();
        const qab = this.firstProductCard.locator('button.quick-add-to-cart__button').first();
        await qab.waitFor({ state: 'visible', timeout: 5_000 });

        await Promise.all([
            this.page.waitForResponse(
                r => r.url().includes('/cart/add.js') && r.request().method() === 'POST',
                { timeout: 10_000 }
            ),
            qab.click(),
        ]);
    }

    // -- Cart badge -------------------------------------------------------------

    /** Returns the cart item count badge locator */
    get cartBadge() {
        return this.page.locator(this.selectors.cartBadge).first();
    }

    /**
     * Returns the current cart count as an integer.
     * @returns {Promise<number>}
     */
    async getCartCount() {
        const text = await this.cartBadge.innerText().catch(() => '0');
        return parseInt(text, 10) || 0;
    }

    // -- Search -----------------------------------------------------------------

    /**
     * Click the search icon, type a query, and submit.
     * @param {string} query
     */
    async searchFor(query) {
        const searchBtn = this.page.locator(this.selectors.searchButton).first();
        await searchBtn.waitFor({ state: 'visible', timeout: 10_000 });
        await searchBtn.click({ force: true });

        const searchInput = this.page.locator(
            'input[name="q"], input[type="search"], .nav__search-input'
        ).first();
        await searchInput.waitFor({ state: 'visible', timeout: 5_000 });
        await searchInput.fill(query);
        await searchInput.press('Enter');
        await this.page.waitForLoadState('domcontentloaded');
    }

    // -- Mobile menu ------------------------------------------------------------

    /**
     * Open the mobile hamburger navigation menu.
     */
    async openMobileMenu() {
        const hamburger = this.page.locator(
            'button.hamburger, button[aria-label*="menu" i], button[aria-label*="navigation" i]'
        ).first();
        await hamburger.waitFor({ state: 'visible', timeout: 10_000 });
        await hamburger.click();
        await this.page.locator(this.selectors.mobileMenu).waitFor({ state: 'visible', timeout: 10_000 });
    }

    /**
     * Close the mobile navigation menu.
     */
    async closeMobileMenu() {
        const closeBtn = this.page.locator(
            'button[aria-label*="close" i], button.hamburger.is-active, button[aria-expanded="true"]'
        ).first();
        if (await closeBtn.count() > 0) {
            await closeBtn.click();
        }
    }

    // -- SEO / Meta -------------------------------------------------------------

    /**
     * Returns the meta description content.
     * @returns {Promise<string|null>}
     */
    async getMetaDescription() {
        return this.page.locator('meta[name="description"]').getAttribute('content');
    }

    /**
     * Returns the canonical URL.
     * @returns {Promise<string|null>}
     */
    async getCanonicalUrl() {
        return this.page.locator('link[rel="canonical"]').first().getAttribute('href');
    }
}

module.exports = HomePage;
