/**
 * merchants/index.js — Merchant Registry
 *
 * Single source of truth for which merchants are active in the test suite.
 *
 * -- How to add a new merchant ------------------------------------------------
 *  1. Copy merchants/abc/ to merchants/<your-slug>/
 *  2. Edit merchants/<your-slug>/config.js with the site's real values.
 *  3. Edit merchants/<your-slug>/locators.js with the site's real selectors.
 *  4. Add '<your-slug>' to ACTIVE_MERCHANTS below.
 *  5. Run: npx playwright test --list
 *     -> You should see new projects: <your-slug>-desktop-chromium, etc.
 *
 * -- Filtering to a single merchant -------------------------------------------
 *  Set MERCHANT=<slug> in .env (or CI env) to restrict the run to one site.
 *  Example:   MERCHANT=koh npm test
 *  Or via CLI:  npm test -- --project=koh-desktop-chromium
 */

'use strict';

const LocatorManager = require('../locators/LocatorManager');

// -- Active Merchants ---------------------------------------------------------
//  Add / remove slugs here. Each slug must match a folder under merchants/.
const ACTIVE_MERCHANTS = [
    'revitin',
    'koh',
    'abc',
    'orion',   // Theme-preview URL for now — see merchants/orion/config.js
];

// -- Load & validate configs --------------------------------------------------

/**
 * Load a merchant config by slug.
 * Throws a descriptive error if the config or its locators are missing or
 * malformed.
 *
 * @param {string} slug
 * @returns {object} merchant config, with `.locators` set to a LocatorManager
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
    const required = ['name', 'slug', 'urls', 'pages', 'products', 'features'];
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

    let rawLocators;
    try {
        rawLocators = require(`./${slug}/locators`);
    } catch (err) {
        throw new Error(
            `[merchants/index.js] Cannot load locators for merchant "${slug}".\n` +
            `  Expected file: merchants/${slug}/locators.js\n` +
            `  Original error: ${err.message}`
        );
    }

    config.locators = new LocatorManager(slug, rawLocators);

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
