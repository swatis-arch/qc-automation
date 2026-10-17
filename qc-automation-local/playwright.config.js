/**
 * playwright.config.js -- SUNTEK AI QC
 *
 * Multi-merchant Shopify regression suite.
 *
 * Projects  : Auto-generated from merchants/index.js
 *             -> <slug>-desktop-chromium  (Desktop Chrome)
 *             -> <slug>-mobile-chrome     (Pixel 7)
 * Reporters : HTML + JSON + list
 * Evidence  : Screenshot + video + trace on failure
 * Auth      : None (guest checkout only; no real production purchases)
 *
 * -- Running tests ------------------------------------------------------------
 *   npm test                                   Full regression (all merchants)
 *   npm run test:smoke                         @smoke subset, desktop, $MERCHANT (default: first active merchant)
 *   npm run test:desktop                       Desktop Chromium, $MERCHANT (default: first active merchant)
 *   npm run test:mobile                        Mobile Chrome, $MERCHANT (default: first active merchant)
 *   npm run test:headed                        Headed (debug) mode
 *   MERCHANT=koh npm test                      Env-var filter (CI)
 *   USE_STAGING=true npm test                  Run against staging URLs
 *   npx playwright test --project=koh-desktop-chromium   One merchant + browser
 *
 * -- Adding a new merchant ----------------------------------------------------
 *   1. Copy merchants/abc/ to merchants/<your-slug>/
 *   2. Fill in merchants/<your-slug>/config.js and locators.js
 *   3. Add '<your-slug>' to ACTIVE_MERCHANTS in merchants/index.js
 *   4. Run: npx playwright test --list   (verify new projects appear)
 */

// @ts-check

/**
 * @typedef {Object} MerchantUrls
 * @property {string} production
 * @property {string} staging
 */

/**
 * @typedef {Object} MerchantConfig
 * @property {string}       name
 * @property {string}       slug
 * @property {MerchantUrls} urls
 * @property {Object}       pages
 * @property {Object}       products
 * @property {Object}       features
 * @property {Object}       selectors
 */

// -- FIX 1: Load .env FIRST, before any require() reads process.env ----------
// merchants/index.js uses process.env.MERCHANT to filter active merchants.
// Previously dotenv was loaded AFTER the merchants require, so the MERCHANT
// env filter in .env was silently ignored. This fixes that ordering bug.
// From this file's folder, not the working directory: the Playwright Test Agents start Playwright at
// the repo root (`-c qc-automation-local`), where there is no .env (storefront passwords went missing).
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { defineConfig, devices } = require('@playwright/test');

// Inline JSDoc cast: equivalent to TypeScript's `as MerchantConfig[]`.
// A line-level @type annotation won't work here because TypeScript sees
// require().merchants as object[] and refuses the assignment.
// Wrapping the expression in /** @type {T} */ (...) forces the cast.
const merchants = /** @type {MerchantConfig[]} */ (require('./merchants/index').merchants);

// -- Build one Playwright project per merchant x browser ----------------------

// -- FIX 2: Staging / Production switch via USE_STAGING env-var ---------------
// Local:  USE_STAGING=true npm test   -> hits each merchant's staging URL
// CI:     Set USE_STAGING=true in GitHub Secrets for pre-production runs
const useStaging = process.env.USE_STAGING === 'true';

// QC Console ticket checks on a store from a Jira link (merchants/adhoc/config.js): that store only.
const runMerchants = process.env.QC_ADHOC_BASE_URL
    ? [require('./merchants/index').loadConfig('adhoc')]
    : merchants;

const projects = runMerchants.flatMap(merchant => {
    const baseURL = useStaging
        ? merchant.urls.staging       // staging  <-- USE_STAGING=true
        : merchant.urls.production;   // production (default)

    return [
        {
            name: `${merchant.slug}-desktop-chromium`,
            use: {
                ...devices['Desktop Chrome'],
                baseURL,
                merchantSlug: merchant.slug,
            },
        },
        {
            name: `${merchant.slug}-mobile-chrome`,
            use: {
                ...devices['Pixel 7'],
                baseURL,
                merchantSlug: merchant.slug,
            },
        },
    ];
});

module.exports = defineConfig({

    testDir: './tests',
    // Retired hand-written specs (see tests/_archive/README.md). Only agent-generated tests run.
    testIgnore: '**/_archive/**',

    // -- FIX 5: Organized artifact output directory ---------------------------
    // Screenshots, videos and traces now land in test-results/artifacts/
    // instead of being scattered across the default test-results/ root.
    outputDir: 'test-results/artifacts',

    // -- Timeouts -------------------------------------------------------------
    timeout: 60 * 1000,       // 60 s per test
    expect: { timeout: 10 * 1000 },

    // -- FIX 3: workers: 1 locally to prevent cart state corruption -----------
    // fullyParallel: false only prevents parallelism WITHIN a describe block.
    // With workers: 2, Playwright still runs two spec files simultaneously
    // (e.g. cart.spec.js + pdp.spec.js). Both fixture chains call addToCart
    // which mutates shared browser storage -- causing cart count corruption.
    // Setting workers: 1 runs all specs sequentially, matching CI behaviour.
    fullyParallel: false,
    workers: 1,

    // -- FIX 4: 1 retry locally to absorb transient network flakiness ---------
    // Shopify CDN, Klaviyo script blocking, and cart API responses are
    // network-dependent. With 0 retries, any transient hiccup permanently
    // fails a test. 1 local retry catches these without hiding real bugs.
    retries: process.env.CI ? 2 : 1,

    // -- CI: fail on test.only() ----------------------------------------------
    forbidOnly: !!process.env.CI,

    // -- Reporters ------------------------------------------------------------
    // `--list` runs nothing, but the json reporter would still overwrite
    // reports/results.json with every test marked skipped (and the html report
    // with an empty one), which the RCA/report scripts then read as a real run.
    reporter: process.argv.includes('--list') ? [['list']] : [
        ['html', { open: 'never', outputFolder: 'reports/html' }],
        ['json', { outputFile: 'reports/results.json' }],
        ['list'],
    ],

    // -- Shared settings (no baseURL here -- each project sets its own) -------
    use: {
        screenshot: 'only-on-failure',
        video:      'retain-on-failure',
        trace:      'retain-on-failure',

        headless:          true,
        // Watch mode (`--watch`): slow every action so a headed run is followable.
        launchOptions:     { slowMo: Number(process.env.WATCH_SLOWMO) || 0 },
        actionTimeout:     15 * 1000,
        navigationTimeout: 30 * 1000,
    },

    // -- Projects (auto-generated -- one per merchant x browser) --------------
    projects,
});
