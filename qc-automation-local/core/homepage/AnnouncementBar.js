/**
 * core/homepage/AnnouncementBar.js — Announcement / promo bar component
 *
 * The bar is a Swiper carousel on the themes that rotate several messages
 * (Outset, ABC) and a single static message on the others (Revitin, KOH), so
 * everything here works off the `promoBar` merchant locator plus Swiper's
 * standard classes, and specs skip the rotation checks when there is only
 * one slide.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('../../locators/LocatorManager')} locators
 */
class AnnouncementBar {

    constructor(page, locators) {
        this.page     = page;
        this.locators = locators;
    }

    /** The visible bar (themes keep off-screen duplicates, so filter before .first()) */
    get root() {
        return this.page.locator(this.locators.get('promoBar')).filter({ visible: true }).first();
    }

    /** Links inside the message that is currently showing */
    get links() {
        return this.root.locator('a[href]').filter({ visible: true });
    }

    get slides() {
        return this.root.locator('.swiper-slide');
    }

    get nextArrow() {
        return this.root.locator('.swiper-button-next').first();
    }

    /** Text of the message currently showing */
    async activeText() {
        const text = await this.root.locator('.swiper-slide-active').first().innerText().catch(() => '');
        return text.trim();
    }
}

module.exports = AnnouncementBar;
