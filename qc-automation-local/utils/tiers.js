/**
 * utils/tiers.js — Test tiers and modules
 *
 * Single source of truth for how the suite is sliced. Consumed by
 * scripts/run-suite.js (and therefore the npm scripts + CI) and the QC Console.
 *
 * Only tests written by the Playwright Test Agents run (since 2026-10-14). The hand-written specs
 * are in tests/_archive/ (not run; see its README).
 *
 * Modules: one per folder in tests/generated/ (e.g. koh-bundle-builder), found automatically.
 * Its description is the title of the matching plan in specs/<folder>.md. A new generated suite
 * therefore runs in regression/full as soon as its folder exists.
 *
 * Tiers:
 *   smoke       tests tagged @smoke ({ tag: '@smoke' }): the critical path per merchant (homepage, add to cart,
 *               checkout hand-off). Tag 1–3 tests in each new suite.
 *   regression  every generated module
 *   full        every generated module (same as regression until visual suites are generated)
 *
 * All tiers default to the desktop projects: generated suites cover mobile in their own *-mobile.spec.ts files
 * (390x844 via test.use), and the desktop-written tests are not built for the Pixel 7 project.
 */

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const GENERATED_DIR = path.join(ROOT, 'tests', 'generated');

/** Title of specs/<name>.md ("# KOH bundle builder test plan" → "KOH bundle builder test plan"). */
function planTitle(name) {
    const file = path.join(ROOT, 'specs', `${name}.md`);
    if (!fs.existsSync(file)) return `Generated tests in tests/generated/${name}`;
    const heading = fs.readFileSync(file, 'utf8').split('\n').find(l => /^#\s/.test(l));
    return heading ? heading.replace(/^#\s+/, '').trim() : name;
}

const MODULES = Object.fromEntries(
    (fs.existsSync(GENERATED_DIR) ? fs.readdirSync(GENERATED_DIR, { withFileTypes: true }) : [])
        .filter(d => d.isDirectory() && /^[a-z0-9-]+$/.test(d.name))
        .map(d => [d.name, { file: `tests/generated/${d.name}/`, description: planTitle(d.name) }]),
);

const REGRESSION_MODULES = Object.keys(MODULES);

const TIERS = {
    smoke: {
        description:     'Critical path, tests tagged @smoke (homepage, add to cart, checkout hand-off)',
        args:            ['--grep', '@smoke'],
        defaultViewport: 'desktop',
    },
    regression: {
        description:     'Daily run: every generated module (' + REGRESSION_MODULES.join(', ') + ')',
        args:            REGRESSION_MODULES.map(m => MODULES[m].file),
        defaultViewport: 'desktop',
    },
    full: {
        description:     'Everything generated (same as regression for now)',
        args:            Object.values(MODULES).map(m => m.file),
        defaultViewport: 'desktop',
    },
};

// Checks the QC Console derives from a Jira ticket (QC_TICKET_CHECKS). Runnable as `run-suite.js ticket`,
// but not a module. If the spec is moved out of tests/, the console stops planning ticket checks.
const TICKET = { file: 'tests/ticket-checks.spec.js', description: 'Checks derived from a Jira ticket (QC Console only)' };
TICKET.available = () => fs.existsSync(path.join(ROOT, TICKET.file));

// Regression on a store the suite isn't set up for (QC_ADHOC_BASE_URL). Runnable as `run-suite.js store`,
// but not a module: it skips itself on configured merchants.
const STORE = { file: 'tests/store-regression.spec.js', description: 'Regression on a Shopify store not set up in the suite (QC Console only)' };

module.exports = { MODULES, REGRESSION_MODULES, TIERS, TICKET, STORE };
