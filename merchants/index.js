/**
 * merchants/index.js — Merchant Registry
 *
 * Single source of truth for which merchants are active in the test suite.
 *
 * -- How to add a new merchant ------------------------------------------------
 *  1. Copy merchants/abc/ to merchants/<your-slug>/
 *  2. Edit merchants/<your-slug>/config.js with the site's real values.
 *  3. Add '<your-slug>' to ACTIVE_MERCHANTS below.
 *  4. Run: npx playwright test --list
 *     -> You should see new projects: <your-slug>-desktop-chromium, etc.
 *
 * -- Filtering to a single merchant -------------------------------------------
 *  Set MERCHANT=<slug> in .env (or CI env) to restrict the run to one site.
 *  Example:   MERCHANT=outset npm test
 *  Or via CLI:  npm test -- --project=outset-desktop-chromium
 */

'use strict';

// -- Active Merchants ---------------------------------------------------------
//  Add / remove slugs here. Each slug must match a folder under merchants/.
const ACTIVE_MERCHANTS = [
    'outset',
    // 'revitin',   <- fill in merchants/revitin/config.js first
    // 'koh',       <- fill in merchants/koh/config.js first
    // 'abc',       <- rename and fill in merchants/abc/config.js first
];

// -- Load & validate configs --------------------------------------------------

/**
 * Load a merchant config by slug.
 * Throws a descriptive error if the config is missing or malformed.
 *
 * @param {string} slug
 * @returns {object} merchant config
 */
function loadConfig(slug) {
    let config;
    try {
        config = require(`./${slug}/config`);
    } catch (err) {
        throw new Error(
            `[merchants/index.js] Cannot load config for merchant "${slug}".\n` +
            `  Expected file: merchants/${slug}/config.js\n` +
            `  Original error: ${err.message}`
        );
    }

    // Minimal validation — catch common setup mistakes early
    const required = ['name', 'slug', 'urls', 'pages', 'products', 'features', 'selectors'];
    for (const field of required) {
        if (!(field in config)) {
            throw new Error(
                `[merchants/index.js] Merchant config "${slug}" is missing required field: "${field}"`
            );
        }
    }

    if (config.slug !== slug) {
        throw new Error(
            `[merchants/index.js] Merchant "${slug}" has slug mismatch: ` +
            `config.slug is "${config.slug}" but folder name is "${slug}".`
        );
    }

    return config;
}

// -- Build the active merchant list -------------------------------------------

// If MERCHANT env var is set, restrict to that single slug (useful for CI).
const envFilter = process.env.MERCHANT;

const activeSlugs = envFilter
    ? (() => {
        if (!ACTIVE_MERCHANTS.includes(envFilter)) {
            throw new Error(
                `[merchants/index.js] MERCHANT="${envFilter}" is not in ACTIVE_MERCHANTS.\n` +
                `  Available: ${ACTIVE_MERCHANTS.join(', ')}`
            );
        }
        return [envFilter];
    })()
    : ACTIVE_MERCHANTS;

/** @type {object[]} Array of validated merchant config objects */
const merchants = activeSlugs.map(loadConfig);

// -- Exports ------------------------------------------------------------------

module.exports = {
    /** All active & validated merchant configs */
    merchants,

    /** Load a single merchant config by slug (useful inside fixtures) */
    loadConfig,

    /** Raw list of all registered slugs (regardless of MERCHANT filter) */
    ACTIVE_MERCHANTS,
};
