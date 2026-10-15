// spec: specs/revitin-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { ONLY_REVITIN, endsWith, headStatus, load, note, sel } from './helpers';

test.describe('Revitin core storefront — 2. Footer and contact', () => {
    test('Footer columns, policy links and every internal link responds', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);
        test.setTimeout(120_000);
        const { pages } = merchant;

        await load(page, pages.homepage);
        const footer = page.locator(sel(merchant, 'footer'));
        await footer.scrollIntoViewIfNeeded();
        await expect(footer.getByText(/^The world.s first prebiotic toothpaste\. Try it today!$/)).toBeVisible();
        for (const label of ['Shop', 'Orders', 'Newsletter']) await expect(footer.getByText(label, { exact: true }).first(), `column ${label}`).toBeAttached();

        const links: Array<[string, string]> = [
            ['Revitin Toothpaste', pages.product], ['About Us', pages.about], ['Ingredients', pages.ingredients],
            ['Meet Dr. Gerry', `${pages.about}/#meet-dr-gerry`], ['The Science', pages.blog], ['Made in the USA', pages.ingredients],
            ['Press', pages.press], ['Reviews', pages.reviews], ['FAQ', pages.faq],
            ['Shipping Policy', pages.policies.shipping], ['Return & Refund Policy', pages.policies.refund],
            ['Contact Us', pages.contact], ['Wholesale', pages.wholesale], ['Professional Partnerships', pages.partners],
            ['Account', pages.account], ['Privacy Policy', pages.policies.privacy], ['Terms of Service', pages.policies.terms],
        ];
        for (const [name, path] of links) {
            await expect(footer.getByRole('link', { name, exact: true }).first(), `footer link ${name}`).toHaveAttribute('href', endsWith(path));
        }
        await expect(footer.getByRole('link', { name: 'Affiliates', exact: true })).toHaveAttribute('href', /^https:\/\/ui\.awin\.com\//);   // external, not fetched
        await expect(footer.getByText(/©\s*\d{4}, Revitin/)).toBeVisible();
        note('O9', 'Footer "Made in the USA" and "Ingredients" both go to /pages/ingredients; "Meet Dr. Gerry" uses /pages/about/#meet-dr-gerry');

        // Every internal footer page responds 200; /account is the only redirect (to login).
        const failures: string[] = [];
        for (const path of [...new Set(links.map(([, p]) => p.split('#')[0].replace(/\/$/, '')))]) {
            const r = await headStatus(page, path);
            const ok = path === pages.account ? r.status === 302 && r.location.includes(pages.accountLogin) : r.status === 200;
            if (!ok) failures.push(`${path} -> ${r.status} ${r.location}`);
        }
        expect(failures, 'internal footer links that fail').toEqual([]);
    });

    test('Footer newsletter field is present (never submitted); no social or contact links', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);

        await load(page, merchant.pages.homepage);
        const footer = page.locator(sel(merchant, 'footer'));
        await footer.scrollIntoViewIfNeeded();
        await expect(footer.getByText('Receive special offers and first look at new products!')).toBeVisible();
        const email = page.locator(sel(merchant, 'newsletterEmail'));
        await expect(email).toBeVisible();
        await expect(email).toBeEnabled();
        // The submit input is visually hidden (the form submits on Enter); it only has to exist.
        const submit = page.locator(sel(merchant, 'newsletterSubmit'));
        await expect(submit).toBeAttached();
        await expect(page.locator(sel(merchant, 'newsletterMessages')).filter({ visible: true })).toHaveCount(0);

        const social = await footer.locator('a[href]').evaluateAll(as => as.map(a => a.getAttribute('href')!)
            .filter(h => /facebook|instagram|twitter|x\.com|tiktok|youtube|pinterest|linkedin/i.test(h)));
        const contact = await footer.locator('a[href^="mailto:"], a[href^="tel:"]').count();
        // Placeholder social links would be a real defect; none at all is recorded (O10).
        expect(social.filter(h => /^(#|\/?)$|example\.com/.test(h)), 'placeholder social links').toEqual([]);
        if (!social.length || !contact) note('O10', `Footer has ${social.length} social link(s) and ${contact} mailto/tel link(s)`);
    });

    test('Contact page shows the email, phone and form (form is never filled)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);

        expect(await load(page, merchant.pages.contact)).toBe(200);
        await expect(page.getByRole('heading', { level: 1, name: 'Contact Revitin' })).toBeVisible();
        await expect(page.getByText(merchant.contact.email).first()).toBeVisible();
        await expect(page.locator(`a[href="${merchant.contact.tel}"]`).first()).toHaveText(merchant.contact.phone);
        if (!(await page.locator(`a[href^="mailto:${merchant.contact.email}"]`).count())) note('O10', 'Contact email is plain text, not a mailto: link');

        const form = page.locator(sel(merchant, 'contactForm')).first();
        await expect(form).toBeAttached();
        for (const name of ['contact[name]', 'contact[email]', 'contact[message]']) {
            await expect(form.locator(`[name="${name}"]`), `field ${name}`).toBeAttached();
        }
    });
});
