/**
 * utils/tiers.js — Test tiers and modules
 *
 * Single source of truth for how the suite is sliced. Consumed by
 * scripts/run-suite.js (and therefore the npm scripts + CI).
 *
 * Tiers (agreed strategy — keeps full runs from tripping Cloudflare 429s):
 *   smoke       ~20-30 tests  Frequent, critical checks  (@smoke-tagged)
 *   regression  ~70-120 tests Daily run, key features     (functional specs + technical)
 *   full        everything    Major releases              (adds visual regression)
 *
 * Modules: one spec file per feature area, so a single area can be run on its
 * own instead of the whole suite (smaller runs, less evidence/tokens for RCA).
 *
 * To add a spec: register it in MODULES; add it to REGRESSION_MODULES if it
 * belongs in the daily run. `full` always includes every module.
 */

const MODULES = {
    homepage:   { file: 'tests/homepage.spec.js',   description: 'Header, hero, promo bar, product cards, nav, search' },
    navigation: { file: 'tests/navigation.spec.js', description: 'Journeys, mobile menu, 404 page' },
    plp:        { file: 'tests/plp.spec.js',        description: 'Collection page, product cards, sort, h1' },
    pdp:        { file: 'tests/pdp.spec.js',        description: 'Product page, gallery, variants, price, Add to Cart, subscriptions, SEO' },
    cart:       { file: 'tests/cart.spec.js',       description: 'Drawer, /cart page, lines, quantity, remove, empty state, persistence, free-shipping bar, upsell, checkout' },
    checkout:   { file: 'tests/checkout.spec.js',   description: 'Shopify checkout page (stops before order)' },
    technical:  { file: 'tests/technical.spec.js',  description: 'Broken images, JS errors, 5xx, SEO, load time' },
    visual:     { file: 'tests/visual.spec.js',     description: 'Screenshot regression vs baselines' },
    visualqa:   { file: 'tests/visual-qa.spec.js',  description: 'Design-QA checks with no design file: fonts, contrast, overflow sweep, layout shift' },
};

// Modules that make up the daily regression run. `technical` holds the shared
// SEO / JS-exception / broken-image checks (they are not repeated in the feature specs).
const REGRESSION_MODULES = ['homepage', 'navigation', 'plp', 'pdp', 'cart', 'checkout', 'technical'];

const TIERS = {
    smoke: {
        description:     '@smoke-tagged critical checks',
        args:            ['--grep', '@smoke'],
        defaultViewport: 'desktop',
    },
    regression: {
        description:     'Daily run: functional modules (' + REGRESSION_MODULES.join(', ') + ')',
        args:            REGRESSION_MODULES.map(m => MODULES[m].file),
        defaultViewport: 'all',
    },
    full: {
        description:     'Everything: regression + visual (major releases)',
        // Every registered module. Not "every spec": tests/seed.spec.ts and unreviewed
        // agent output in tests/generated/ stay out until QA registers them here.
        args:            Object.values(MODULES).map(m => m.file),
        defaultViewport: 'all',
    },
};

module.exports = { MODULES, REGRESSION_MODULES, TIERS };
