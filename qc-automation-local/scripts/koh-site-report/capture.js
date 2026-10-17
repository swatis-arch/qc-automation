// Evidence screenshots for the KOH whole-site issue report (2026-10-15). Stops at checkout; never places an order.
// Run from qc-automation-local/: node scripts/koh-site-report/capture.js  (writes PNGs + facts.json to reports/koh-site-issues-2026-10-15/)
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('@playwright/test');

const BASE = 'https://kreaturesofhabit.com';
const OUT = path.join(__dirname, '../../reports/koh-site-issues-2026-10-15');
fs.mkdirSync(OUT, { recursive: true });
const facts = {};
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts });

async function closePopup(page) {
    const close = page.locator('[data-kl-scroll-locking-modal] button[aria-label="Close dialog"], button.klaviyo-close-form');
    if (await close.first().isVisible().catch(() => false)) await close.first().click().catch(() => {});
}
const cart = page => page.evaluate(async () => (await fetch('/cart.js', { cache: 'no-store' })).json());
const clear = page => page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));
const inc = (page, f) => page.getByRole('button', { name: `Increase ${f}`, exact: true });

async function open(page, p) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await closePopup(page);
}

async function addBoxes(page, flavour, n) {
    for (let i = 0; i < n; i++) { await inc(page, flavour).click(); await page.waitForTimeout(500); }
}

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    // Klaviyo popups appear at any time; close them (X only, never the sign-up buttons) whenever they block a click.
    await page.addLocatorHandler(page.locator('[data-kl-scroll-locking-modal]').first(), async () => {
        await page.locator('[data-kl-scroll-locking-modal] button[aria-label="Close dialog"]').first().click({ timeout: 5000 }).catch(() => {});
    }, { noWaitAfter: true });

    // 1 + 2. Daily Bar: gift modal shows; choosing the mug -> drawer "Unlocked!" but cart/checkout has no mug.
    await open(page, '/products/daily-bar');
    await clear(page);
    await addBoxes(page, 'Variety Pack', 2);
    for (let attempt = 0; attempt < 4; attempt++) {
        await page.locator('button.pfp__atc:visible').first().click({ noWaitAfter: true });
        await page.waitForTimeout(3000);
        const opacity = await page.locator('.pfp-gift-modal').evaluate(e => getComputedStyle(e).opacity);
        if (opacity === '1' || (await cart(page)).item_count > 0) break;
    }
    facts.dailyBarModalOpacity = await page.locator('.pfp-gift-modal').evaluate(e => getComputedStyle(e).opacity);
    await shot(page, '2a-daily-bar-gift-modal');
    const addMug = page.locator('.pfp-gift-modal').getByRole('button', { name: /Add Kreatures Glass Mug/i });
    if (await addMug.isVisible().catch(() => false)) await addMug.click();
    await page.waitForTimeout(5000);
    await shot(page, '1a-drawer-mug-unlocked');
    const c1 = await cart(page);
    facts.dailyBarCartAfterAddingMug = c1.items.map(i => `${i.quantity}x ${i.product_title} - ${i.variant_title} $${(i.final_line_price / 100).toFixed(2)}`);
    await page.goto(BASE + '/checkout', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    facts.checkoutUrl = page.url().replace(/\?.*/, '');
    facts.checkoutHasMug = /Glass Mug/i.test(await page.locator('body').innerText());
    await shot(page, '1b-checkout-no-mug');   // STOP: nothing filled, no order

    // 2b. Meal One subscription add: no gift modal at all.
    await open(page, '/products/meal-one-v2');
    await clear(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await closePopup(page);
    await addBoxes(page, 'Maple Caramel', 2);
    await page.locator('button.pfp__atc:visible').first().click({ force: true, noWaitAfter: true });
    await page.waitForTimeout(1500);
    facts.mealOneModalOpacity = await page.locator('.pfp-gift-modal').evaluate(e => getComputedStyle(e).opacity).catch(() => 'absent');
    await page.waitForTimeout(3000);
    await shot(page, '2b-meal-one-no-modal-drawer');
    facts.mealOneCart = (await cart(page)).items.map(i => `${i.quantity}x ${i.product_title} - ${i.variant_title}`);

    // 2c. Bundle builder subscription add: no gift modal.
    await open(page, '/pages/bundle-builder');
    await clear(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await closePopup(page);
    await addBoxes(page, 'Apple Cinnamon', 1);
    await addBoxes(page, 'Variety Pack', 1);
    await page.locator('button.pfp__atc:visible').first().click({ force: true, noWaitAfter: true });
    await page.waitForTimeout(1500);
    facts.builderModalOpacity = await page.locator('.pfp-gift-modal').first().evaluate(e => getComputedStyle(e).opacity).catch(() => 'absent');
    await page.waitForTimeout(3000);
    await shot(page, '2c-bundle-builder-no-modal-drawer');
    facts.builderCart = (await cart(page)).items.map(i => `${i.quantity}x ${i.product_title} - ${i.variant_title}`);
    await clear(page);

    // 3. Store locator.
    await open(page, '/pages/stores');
    await page.waitForTimeout(4000);
    await shot(page, '3-store-locator-broken');
    facts.storesMapError = await page.getByText(/can't load Google Maps correctly/i).first().isVisible().catch(() => false);
    facts.storesNoLocations = await page.getByText(/No locations found/i).first().isVisible().catch(() => false);

    // 4. Price cards at 0 boxes.
    for (const [p, name] of [['/products/meal-one-v2', '4a-meal-one-price-cards'], ['/products/daily-bar', '4b-daily-bar-price-cards']]) {
        await open(page, p);
        const cardBlock = page.locator('.pfp__purchase-card--onetime').first().locator('xpath=..');
        await cardBlock.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        await cardBlock.screenshot({ path: path.join(OUT, `${name}.png`) });
        facts[name] = (await cardBlock.innerText()).replace(/\s+/g, ' ').slice(0, 300);
    }

    // 5. h1 and alt audit.
    facts.h1 = {};
    for (const p of ['/', '/pages/faqs', '/pages/contact', '/pages/stores', '/pages/podcast', '/pages/about-us']) {
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
        facts.h1[p] = await page.locator('h1').evaluateAll(hs => hs.map(h => h.innerText.trim() || `(no text: ${h.innerHTML.slice(0, 60)})`));
    }
    await open(page, '/');
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } });
    facts.imagesWithoutAlt = await page.locator('main img:not([alt])').evaluateAll(is => is.map(i => (i.currentSrc || i.src).replace(/\?.*/, '')));
    const firstNoAlt = page.locator('main img:not([alt])').first();
    await firstNoAlt.scrollIntoViewIfNeeded();
    await firstNoAlt.evaluate(i => { i.style.outline = '6px solid #e11d48'; i.style.outlineOffset = '-6px'; });
    await page.waitForTimeout(600);
    await shot(page, '5-image-without-alt');

    fs.writeFileSync(path.join(OUT, 'facts.json'), JSON.stringify({ capturedAt: new Date().toISOString(), ...facts }, null, 2));
    console.log(JSON.stringify(facts, null, 2));
    await browser.close();
})();
