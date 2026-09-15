/**
 * utils/test-data.js — Shared Test Data
 *
 * Centralised test data used across all merchant test specs.
 * Merchant-specific data should live in merchants/<slug>/config.js.
 *
 * This file contains:
 *   - Common search queries
 *   - Generic test addresses (checkout)
 *   - Status codes / thresholds
 */

// ── Search Queries ───────────────────────────────────────────────────────────

const SEARCH_QUERIES = {
    valid:      'serum',
    skincare:   'moisturizer',
    noResults:  'xyznonexistentproduct12345',
};

// ── Test Addresses (for checkout validation only — no real purchases) ─────────

const TEST_ADDRESS = {
    firstName:  'QA',
    lastName:   'Tester',
    address1:   '123 Test Street',
    city:       'New York',
    state:      'NY',
    zip:        '10001',
    country:    'United States',
    phone:      '5555555555',
    email:      'qa-test@suntek.ai',   // Must NOT trigger real order creation
};

// ── Performance Thresholds ───────────────────────────────────────────────────

const PERFORMANCE = {
    // Maximum acceptable page load time in milliseconds
    maxLoadTimeMs:     5000,
    // Maximum acceptable Largest Contentful Paint (LCP)
    maxLCPMs:          4000,
    // Maximum acceptable Total Blocking Time (TBT)
    maxTBTMs:          300,
    // Maximum acceptable Cumulative Layout Shift (CLS)
    maxCLS:            0.1,
};

// ── HTTP Status Expectations ─────────────────────────────────────────────────

const HTTP = {
    success:    [200, 201, 204],
    redirect:   [301, 302],
    clientError: 400,
    serverError: 500,
};

// ── Common Accessibility Rules to Check ──────────────────────────────────────

const A11Y_RULES = {
    // Rules that are always required (WCAG 2.1 AA)
    required: [
        'color-contrast',
        'image-alt',
        'button-name',
        'link-name',
        'label',
    ],
};

module.exports = {
    SEARCH_QUERIES,
    TEST_ADDRESS,
    PERFORMANCE,
    HTTP,
    A11Y_RULES,
};
