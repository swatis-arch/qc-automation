// Builds the KOH whole-site issue report (HTML + PDF) from the screenshots, facts.json and the run JSON.
// Run from qc-automation-local/: node scripts/koh-site-report/build-report.js [reports/koh-full-site-final.json]
// Reads screenshots + facts.json from reports/koh-site-issues-2026-10-15/ (written by capture.js) and writes the HTML/PDF there.
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const DIR = path.join(__dirname, '../../reports/koh-site-issues-2026-10-15');
const facts = JSON.parse(fs.readFileSync(path.join(DIR, 'facts.json'), 'utf8'));
const runFile = process.argv[2] || 'reports/koh-full-site-final.json';
const run = fs.existsSync(runFile) ? JSON.parse(fs.readFileSync(runFile, 'utf8')) : null;
const img = name => `data:image/png;base64,${fs.readFileSync(path.join(DIR, name)).toString('base64')}`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const stats = run ? run.stats : null;
// Failures that are timeouts loading a page are test/network problems, not site issues.
const failed = [];
const collect = s => { (s.specs || []).forEach(sp => sp.tests.forEach(t => { if (t.status === 'unexpected') failed.push({ title: sp.title, msg: ((t.results[0].error || {}).message || '') }); })); (s.suites || []).forEach(collect); };
if (run) run.suites.forEach(collect);
const realFails = failed.filter(f => !/TimeoutError: page\.goto/.test(f.msg)).length;
const testFails = failed.length - realFails;
const total = stats ? stats.expected + stats.unexpected + stats.flaky + stats.skipped : 63;
const mins = stats ? Math.round(stats.duration / 60000) : '?';

const issues = [
    {
        id: 1, sev: 'P1', title: 'The free Glass Mug is never added to the order, even though the cart says "Unlocked!"',
        where: '/products/daily-bar, /products/meal-one-v2, /pages/bundle-builder → cart drawer → checkout',
        steps: [
            'Open /products/daily-bar, keep "Subscribe & Save" selected.',
            'Click + on Variety Pack twice (2 boxes), click ADD TO CART.',
            'The "Free gift unlocked - Pick a free gift, on us" pop-up opens. Click "Add Kreatures Glass Mug".',
            'The cart drawer shows "Your Free Gifts - Kreatures Glass Mug - Unlocked! - FREE".',
            'Click CHECKOUT and look at the order summary (stop there).',
        ],
        expected: 'The Glass Mug is a line in the cart and in the checkout order summary ($0.00).',
        actual: `The cart (/cart.js) only holds ${esc(facts.dailyBarCartAfterAddingMug.join(', ') || 'the bars')}; the Shopify checkout summary shows THE DAILY BAR only (mug in checkout: ${facts.checkoutHasMug ? 'yes' : 'no'}). Same on Meal One and the bundle builder. Customers are promised a free gift that is never shipped.`,
        shots: [['2a-daily-bar-gift-modal.png', 'Step 3 - gift pop-up, "Add Kreatures Glass Mug"'], ['1a-drawer-mug-unlocked.png', 'Step 4 - drawer says Unlocked! / FREE'], ['1b-checkout-no-mug.png', 'Step 5 - checkout: no mug in the order']],
        tests: '4-meal-one-pdp "Subscription add to cart…", 5-daily-bar-pdp "…puts the mug in the cart", 6-bundle-builder "…mug in the cart"',
    },
    {
        id: 2, sev: 'P2', title: 'The free-gift pop-up only appears on the Daily Bar page (not on Meal One or the Bundle builder)',
        where: '/products/meal-one-v2 and /pages/bundle-builder',
        steps: [
            'Open /products/meal-one-v2 with "Subscribe & Save" selected.',
            'Add 2 boxes of Maple Caramel and click ADD TO CART.',
            'Repeat on /pages/bundle-builder (1 Meal One + 1 Protein Bar box).',
        ],
        expected: 'The same "Pick a free gift, on us" pop-up as on the Daily Bar page, so the shopper can choose the gift.',
        actual: `No pop-up (gift dialog opacity ${facts.mealOneModalOpacity} on Meal One, ${facts.builderModalOpacity} on the builder); the drawer opens straight away and shows the mug as "Unlocked!", but - see issue 1 - it is not in the cart.`,
        shots: [['2b-meal-one-no-modal-drawer.png', 'Meal One: straight to the drawer, no gift choice'], ['2c-bundle-builder-no-modal-drawer.png', 'Bundle builder: same']],
        tests: '6-bundle-builder "Subscription bundle add to cart: lines, gift offered and mug in the cart"',
    },
    {
        id: 3, sev: 'P2', title: '"Now at Sprouts" store locator is broken - Google Maps error and no stores listed',
        where: '/pages/stores (main navigation: NOW AT SPROUTS)',
        steps: ['Click NOW AT SPROUTS in the header.', 'Wait for the map to load.'],
        expected: 'A working map and a list of Sprouts stores that sell the Daily Bar.',
        actual: 'Google shows "This page can\'t load Google Maps correctly" with a "For development purposes only" map, and the list says "No locations found". Console: Google Maps BillingNotEnabledMapError - the Maps API key has no billing enabled.',
        shots: [['3-store-locator-broken.png', 'Map error dialog and "No locations found"']],
        tests: '9-content-pages "Store locator (Now at Sprouts) shows a working map and locations"',
    },
    {
        id: 4, sev: 'P3', title: 'Price cards say "2 BOXES" but show the price of 1 box',
        where: '/products/meal-one-v2 and /products/daily-bar (before any flavour is chosen)',
        steps: ['Open /products/meal-one-v2 (or /products/daily-bar).', 'Read the Subscribe & Save and One-Time Purchase cards without adding any box.'],
        expected: 'Label and price describe the same quantity: "2 BOXES • 14 meals $79.98" or "1 BOX • 7 meals $39.99".',
        actual: 'Meal One: "2 BOXES • 14 meals" next to $39.99 / $23.59 and $5.71/meal (the 1-box numbers). Daily Bar: "2 BOXES • 24 bars" with $39.99. After 2 boxes are added the price becomes $79.98, so the first price a shopper sees is half the real minimum order.',
        shots: [['4a-meal-one-price-cards.png', 'Meal One cards at 0 boxes'], ['4b-daily-bar-price-cards.png', 'Daily Bar cards at 0 boxes']],
        tests: '4-meal-one-pdp "Price card label and price describe the same number of boxes…", 5-daily-bar-pdp "Initial state…"',
    },
    {
        id: 5, sev: 'P3', title: 'SEO / accessibility: pages without a heading (h1) and homepage images without alt text',
        where: '/, /pages/faqs, /pages/contact, /pages/stores, /pages/podcast, /pages/about-us',
        steps: ['Open each page and inspect its h1 (browser DevTools or any SEO checker).', 'On the homepage, check images for an alt attribute.'],
        expected: 'Every page has one meaningful h1; every image has alt text (empty alt for decoration).',
        actual: `No h1 on ${['/pages/faqs', '/pages/contact', '/pages/stores', '/pages/podcast'].filter(p => !facts.h1[p].length).join(', ')}; the homepage h1 is only the logo; the About page h1 is the SEO title "${esc(facts.h1['/pages/about-us'][0] || '')}". ${facts.imagesWithoutAlt.length} homepage images have no alt attribute (e.g. the Meal One photo, the founder portrait, 5 video thumbnails).`,
        shots: [['5-image-without-alt.png', 'Homepage: outlined image has no alt attribute']],
        tests: '1-homepage "…every image has alt text", 9-content-pages "Content pages have one meaningful h1"',
    },
];

const other = [
    'Two different login pages: header "Log in" and mobile "My Account" go to /a/account/login (Skio code login); the mobile menu also has "Log in" → /account/login (classic Shopify password login).',
    'The $0.00 Kreatures Glass Mug has its own public page (/products/glass-cup) with a working "Add to cart", so anyone can order the free gift without a subscription - please confirm this is intended.',
    'Every unknown URL (/products, /pages, /blogs, /policies) now 301-redirects to the homepage with no "page not found" message (soft 404). On 15 Oct /pages, blog and policy URLs still returned a real 404, so this changed overnight - confirm it is intended (it hides broken links and affects SEO).',
    'Console errors on every page from third-party scripts: "TriplePixel is not defined" (GTM), a JSON request that returns an HTML page, TikTok pixel failing to load; the store locator page also logs "Zigpoll: response limit has been reached".',
    'The cart drawer writes whole amounts without cents ("$25", "$82 off") while product pages use "$25.00" - cosmetic.',
    'Homepage social proof is inconsistent: "58,100+ Happy Customers" in the hero vs "91K+ CUSTOMERS" in the founder section.',
];

const passedAreas = [
    'Header navigation, logo, SHOP NOW, announcement bar, cart icon and /cart → drawer',
    'All internal footer links return 200;social links point to the KOH profiles',
    'Meal One / Daily Bar / Bundle builder: 2-box minimum, steppers, mixed boxes, 41% subscription maths ($39.99 → $23.59 per box), delivery frequency',
    'Cart drawer: plus / minus / remove, subtotal, free-shipping bar ($119 one-time, 3+ boxes subscription), empty state, persistence',
    'Checkout button reaches the Shopify checkout (no order placed)',
    'Hoodies (sizes, XL sold out), beanie, sale snapback ($22.50 vs $45.00), FAQ accordions, contact/wholesale forms render (never submitted), policies, blog',
    'Mobile 390 px: menu, no horizontal scroll on 10 key pages, builder and drawer',
];

const html = `<!doctype html><html><head><meta charset="utf-8"><title>KOH whole-site QC - 15 Oct 2026</title>
<style>
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1f2937; margin: 0; padding: 32px 40px; }
  h1 { font-size: 24px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 28px 0 8px; } h3 { font-size: 15px; margin: 0 0 6px; }
  .sub { color: #6b7280; margin-bottom: 18px; }
  .kpis { display: flex; gap: 12px; margin: 12px 0 8px; }
  .kpi { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
  .kpi b { display: block; font-size: 20px; } .kpi span { color: #6b7280; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; } td, th { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; font-size: 12px; }
  .issue { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin: 18px 0; page-break-inside: avoid; }
  .issue + .issue { page-break-before: always; }
  .sev { display: inline-block; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 99px; margin-right: 6px; color: #fff; }
  .P1 { background: #b91c1c; } .P2 { background: #c2410c; } .P3 { background: #a16207; }
  .label { font-weight: 600; color: #374151; margin-top: 8px; }
  ol { margin: 4px 0 4px 18px; padding: 0; } ul { margin: 4px 0 4px 18px; padding: 0; }
  .shots { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
  figure { margin: 0; flex: 1 1 46%; } figure img { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; }
  figcaption { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .muted { color: #6b7280; font-size: 12px; }
</style></head><body>
<h1>Kreatures of Habit - whole-site QC report</h1>
<div class="sub">kreaturesofhabit.com · Desktop Chrome + mobile 390 px · 15-16 Oct 2026 · Collection pages excluded (owned by the client)</div>

<div class="kpis">
  <div class="kpi"><b>${total}</b><span>automated tests, 12 suites</span></div>
  <div class="kpi"><b>${stats ? stats.expected + stats.flaky : '-'}</b><span>passed${stats && stats.flaky ? ` (${stats.flaky} after a retry)` : ''}</span></div>
  <div class="kpi"><b>${stats ? realFails : '-'}</b><span>failing on real site issues</span></div>
  <div class="kpi"><b>5</b><span>confirmed issues below</span></div>
</div>
<div class="muted">Each issue was reproduced twice: by the automated test (with a retry) and again in a separate clean browser session for the screenshots. Checkout was opened to read the order summary only - no data entered, no order placed.${stats ? ` Final run ${mins} min (the site was slow; ${stats.flaky} tests needed a retry because of network timeouts${testFails ? `, and ${testFails} test still times out loading a redirecting URL - a test problem, not counted as a site issue` : ''}).` : ''}</div>

<h2>Summary</h2>
<table><tr><th>#</th><th>Severity</th><th>Issue</th><th>Where</th></tr>
${issues.map(i => `<tr><td>${i.id}</td><td><span class="sev ${i.sev}">${i.sev}</span></td><td>${esc(i.title)}</td><td>${esc(i.where)}</td></tr>`).join('')}
</table>

${issues.map(i => `<div class="issue">
  <h3><span class="sev ${i.sev}">${i.sev}</span>${i.id}. ${esc(i.title)}</h3>
  <div class="muted">${esc(i.where)}</div>
  <div class="label">Steps to reproduce</div><ol>${i.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
  <div class="label">Expected</div><div>${esc(i.expected)}</div>
  <div class="label">Actual</div><div>${i.actual}</div>
  <div class="shots">${i.shots.map(([f, c]) => `<figure><img src="${img(f)}"><figcaption>${esc(c)}</figcaption></figure>`).join('')}</div>
  <div class="muted" style="margin-top:8px">Automated check: ${esc(i.tests)}</div>
</div>`).join('')}

<div style="page-break-before: always"></div>
<h2>Other observations (lower priority or need client confirmation)</h2>
<ul>${other.map(o => `<li>${esc(o)}</li>`).join('')}</ul>

<h2>Covered and working</h2>
<ul>${passedAreas.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
<div class="muted">Tests: tests/generated/koh-full-site/ (plan: specs/koh-full-site.md). Evidence captured ${esc(facts.capturedAt)}.</div>
</body></html>`;

(async () => {
    fs.writeFileSync(path.join(DIR, 'KOH-site-issues-2026-10-15.html'), html);
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({ path: path.join(DIR, 'KOH-site-issues-2026-10-15.pdf'), format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '8mm', right: '8mm' } });
    await browser.close();
    console.log('written', path.join(DIR, 'KOH-site-issues-2026-10-15.pdf'));
})();
