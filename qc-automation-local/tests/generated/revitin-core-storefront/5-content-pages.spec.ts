// spec: specs/revitin-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { ONLY_REVITIN, load, note, sel } from './helpers';

test.describe('Revitin core storefront — 5. Content and policy pages', () => {
    test('Content pages return 200 with header, footer and their headings', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);
        test.setTimeout(150_000);
        const { pages } = merchant;

        const visit = async (path: string) => {
            await page.waitForTimeout(1_500);
            expect(await load(page, path), `${path} status`).toBe(200);
            await expect(page.locator(sel(merchant, 'siteHeader')), `${path} header`).toBeVisible();
            await expect(page.locator(sel(merchant, 'footer')), `${path} footer`).toBeAttached();
            await expect(page).not.toHaveTitle(/404/);
        };

        await visit(pages.about);
        await expect(page).toHaveTitle('About Revitin® | Meet Dr. Gerry Curatola, Our Founder');
        for (const h of ['Microbes are necessary for oral health', 'Harsh chemicals do more harm than good', 'Natural ingredients work very, very hard']) {
            await expect(page.getByRole('heading', { name: h }).first(), `About heading ${h}`).toBeAttached();
        }
        const aboutH1 = await page.locator('h1').allInnerTexts();
        note('O2', `/pages/about has ${aboutH1.length} H1(s): ${aboutH1.map(t => `"${t.replace(/\s+/g, ' ').trim().slice(0, 40)}"`).join(', ')}`);

        await visit(pages.ingredients);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Revitin Ingredients');
        await expect(page.getByRole('heading', { name: /^Meet Citrus/ }).first()).toBeAttached();
        await expect(page.getByRole('heading', { name: /^Meet Mint/ }).first()).toBeAttached();

        await visit(pages.faq);
        await expect(page).toHaveTitle('Revitin | FAQS');
        await expect(page.getByText('How can we help?').first()).toBeVisible();
        for (const h of ['Ingredients', 'Product', 'Subscriptions']) await expect(page.getByRole('heading', { name: h, exact: true }).first(), `FAQ section ${h}`).toBeAttached();
        const faqH1 = await page.locator('h1').count();
        if (!faqH1) note('O3', '/pages/faqs has no H1');

        await visit(pages.contact);
        await expect(page.getByRole('heading', { level: 1, name: 'Contact Revitin' })).toBeVisible();

        for (const path of [pages.press, pages.reviews, pages.wholesale, pages.partners, pages.blog]) {
            await visit(path);
            const h1 = (await page.locator('h1').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim().slice(0, 40));
            note('page', `${path}: "${await page.title()}", H1 ${JSON.stringify(h1)}`);
            expect((await page.locator('main').innerText()).length, `${path} has content`).toBeGreaterThan(100);
        }
    });

    test('Policy pages (footer /pages/ versions and Shopify /policies/ defaults) load with headings', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);
        test.setTimeout(120_000);
        const { policies, shopifyPolicies } = merchant.pages;

        const footerPolicies: Array<[string, string, string | null]> = [
            [policies.shipping, 'Revitin Shipping Policy and Delivery Information', 'Most orders are shipped within 48 hours'],
            [policies.refund, 'Revitin Return and Refund Policy', 'Our policy allows returns within 30 days of purchase'],
            [policies.privacy, 'Revitin Privacy Policy', null],
            [policies.terms, 'Revitin Terms of Use', null],
        ];
        for (const [path, h1, text] of footerPolicies) {
            await page.waitForTimeout(1_500);
            expect(await load(page, path), `${path} status`).toBe(200);
            await expect(page.getByRole('heading', { level: 1 }).first(), `${path} H1`).toHaveText(h1);
            await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${merchant.urls.production}${path}`);
            if (text) await expect(page.getByText(text).first()).toBeAttached();
        }

        const defaults: Array<[string, RegExp]> = [
            [shopifyPolicies.privacy, /^Privacy policy$/i], [shopifyPolicies.refund, /^Refund policy$/i],
            [shopifyPolicies.shipping, /^Shipping policy$/i], [shopifyPolicies.terms, /^Terms of service$/i],
        ];
        for (const [path, h1] of defaults) {
            await page.waitForTimeout(1_500);
            expect(await load(page, path), `${path} status`).toBe(200);
            await expect(page.getByRole('heading', { level: 1 }).first(), `${path} H1`).toHaveText(h1);
            expect((await page.locator('body').innerText()).length, `${path} has content`).toBeGreaterThan(300);
        }
        note('O12', 'Shopify /policies/* pages duplicate the footer /pages/ policies with different titles and H1s');
    });
});
