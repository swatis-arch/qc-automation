/**
 * core/homepage/Footer.js — Site footer component
 *
 * Every read here goes through the DOM (hrefs, text) rather than visibility:
 * on ABC the footer lives in the last slide of a locked full-page hero
 * slideshow, so it is attached but never "visible" without scrolling that
 * slideshow. Merchants override the footer element with the `footer` locator
 * when the first <footer> on the page is not the site footer (ABC's is the
 * side cart's footer).
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('../../locators/LocatorManager')} locators
 */

const { collectLinks, internalPageUrls } = require('../../utils/link-check');

// Footer icons that link to a brand profile. LinkedIn is left out on purpose:
// on these stores it is a "Careers" text link, not a social icon.
const SOCIAL_HOST = /(^|\.)(facebook|instagram|tiktok|twitter|x|pinterest|youtube|snapchat)\.com$/i;

class Footer {

    constructor(page, locators) {
        this.page     = page;
        this.locators = locators;
    }

    get root() {
        return this.page.locator(this.locators.preferred('footer', 'footer')).first();
    }

    /** @returns {Promise<{ text: string, href: string, rawHref: string, target: string }[]>} */
    links() {
        return collectLinks(this.root);
    }

    /** Unique same-site page URLs linked from the footer */
    async internalUrls() {
        return internalPageUrls(await this.links(), new URL(this.page.url()).hostname);
    }

    /** Footer links pointing at a social network profile */
    async socialLinks() {
        const links = await this.links();
        return links.filter(({ href }) => {
            try { return SOCIAL_HOST.test(new URL(href).hostname); } catch { return false; }
        });
    }

    /** First footer link whose text or URL matches `pattern`, or undefined */
    async findLink(pattern) {
        const links = await this.links();
        return links.find(({ text, href }) => pattern.test(text) || pattern.test(href));
    }

    /** All footer text, whitespace-collapsed */
    async text() {
        return (await this.root.evaluate(el => el.textContent)).replace(/\s+/g, ' ').trim();
    }

    /** Shopify Markets country/currency form, if the store has one */
    get localizationForm() {
        return this.root.locator('form[action$="/localization"]').first();
    }
}

module.exports = Footer;
