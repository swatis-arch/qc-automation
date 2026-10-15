/**
 * merchants/adhoc/config.js
 *
 * A store the suite isn't set up for, taken from a Jira ticket's link by the QC Console.
 * Its URL comes from QC_ADHOC_BASE_URL, set only for that console run (see console/server.js);
 * playwright.config.js then builds adhoc-* projects and nothing else.
 *
 * Not in ACTIVE_MERCHANTS: no tier ever runs it. Only ticket checks on the homepage and on paths
 * named in the ticket run here (utils/ticket-checks.js): no products, cart or checkout, because
 * those need a real merchant config and verified locators.
 */

const base = process.env.QC_ADHOC_BASE_URL || 'https://example.com';

module.exports = {
    name:     process.env.QC_ADHOC_NAME || new URL(base).hostname,
    slug:     'adhoc',
    adhoc:    true,
    urls:     { production: base, staging: base },
    pages:    { homepage: '/' },
    products: {},
    features: { popup: false },
};
