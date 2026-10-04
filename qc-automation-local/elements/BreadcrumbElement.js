/**
 * elements/BreadcrumbElement.js — Breadcrumb trail business element
 *
 * Same trail, same root-link rule on collection and product pages -- PLPPage
 * and PDPPage share this instead of each re-declaring the locator chain.
 */

class BreadcrumbElement {

    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    /** The breadcrumb trail, if the theme renders one */
    get locator() {
        return this.page.locator('.breadcrumb, nav[aria-label*="breadcrumb" i], [class*="breadcrumb"]').filter({ visible: true }).first();
    }

    /**
     * The trail's root-level link. Its label isn't always literally "Home" — Abc's reads
     * "Shop" — so this is just the first link in the trail, which is always the site root.
     */
    get homeLink() {
        return this.locator.getByRole('link').first();
    }
}

module.exports = BreadcrumbElement;
