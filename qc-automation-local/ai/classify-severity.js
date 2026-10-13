/**
 * ai/classify-severity.js — Severity Classification Helpers
 *
 * Maps severity codes to descriptions and provides utilities
 * for sorting, filtering, and displaying severity information.
 */

// ── Severity Definitions ──────────────────────────────────────────────────────

const SEVERITY_MAP = {
    P0: {
        code:        'P0',
        label:       'Critical',
        description: 'Site down or checkout completely broken. Immediate escalation required.',
        emoji:       '🔴',
        priority:    0,
    },
    P1: {
        code:        'P1',
        label:       'High',
        description: 'Critical commerce flow broken (Add to Cart, checkout, subscription). Urgent fix required.',
        emoji:       '🟠',
        priority:    1,
    },
    P2: {
        code:        'P2',
        label:       'Medium',
        description: 'Feature broken but a workaround exists. Fix within sprint.',
        emoji:       '🟡',
        priority:    2,
    },
    P3: {
        code:        'P3',
        label:       'Low',
        description: 'Cosmetic or minor UX issue. Fix when time allows.',
        emoji:       '🟢',
        priority:    3,
    },
};

// ── Category Definitions ──────────────────────────────────────────────────────

const CATEGORY_MAP = {
    functional:              { label: 'Functional',              emoji: '⚙️' },
    visual:                  { label: 'Visual',                  emoji: '👁️' },
    analytics:               { label: 'Analytics',               emoji: '📊' },
    'third-party integration': { label: 'Third-party Integration', emoji: '🔌' },
    network:                 { label: 'Network',                 emoji: '🌐' },
    'test automation issue': { label: 'Test Automation Issue',   emoji: '🤖' },
    unknown:                 { label: 'Unknown',                 emoji: '❓' },
};

// ── Classification Reference ──────────────────────────────────────────────────

const FAILURE_CLASSES = [
    'REAL_BUG',
    'AUTOMATION_BUG',
    'FLAKY_TEST',
    'BAD_TEST_DATA',
    'EXPECTED_DIFFERENCE',
    'MERCHANT_CUSTOMIZATION',
    'THIRD_PARTY_FAILURE',
];

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Get the severity info object for a given severity code.
 * @param {string} code - P0 | P1 | P2 | P3
 * @returns {Object}
 */
function getSeverity(code) {
    return SEVERITY_MAP[code] || SEVERITY_MAP['P3'];
}

/**
 * Get the category info object for a given category string.
 * @param {string} category
 * @returns {Object}
 */
function getCategory(category) {
    return CATEGORY_MAP[category] || CATEGORY_MAP['unknown'];
}

/**
 * Sort an array of RCA results by severity (P0 first).
 * @param {Array} results - Array of objects with an `rca.severity` field
 * @returns {Array}
 */
function sortBySeverity(results) {
    return [...results].sort((a, b) => {
        const aPriority = getSeverity(a.rca?.severity).priority ?? 99;
        const bPriority = getSeverity(b.rca?.severity).priority ?? 99;
        return aPriority - bPriority;
    });
}

/**
 * Group RCA results by severity code.
 * @param {Array} results
 * @returns {Object} { P0: [], P1: [], P2: [], P3: [] }
 */
function groupBySeverity(results) {
    return results.reduce((acc, item) => {
        const sev = item.rca?.severity || 'P3';
        if (!acc[sev]) acc[sev] = [];
        acc[sev].push(item);
        return acc;
    }, { P0: [], P1: [], P2: [], P3: [] });
}

/**
 * Group RCA results by merchant name, sorted by most-affected merchant first.
 * @param {Array} results - Array of { evidence, rca } (or raw evidence+rca merged objects)
 * @returns {Array<{ merchant: string, failures: Array }>}
 */
function groupByMerchant(results) {
    const byMerchant = {};

    for (const item of results) {
        const merchant = item.evidence?.merchant || item.merchant || 'Unknown';
        if (!byMerchant[merchant]) byMerchant[merchant] = [];
        byMerchant[merchant].push(item);
    }

    return Object.entries(byMerchant)
        .map(([merchant, failures]) => ({ merchant, failures: sortBySeverity(failures) }))
        .sort((a, b) => b.failures.length - a.failures.length || a.merchant.localeCompare(b.merchant));
}

/**
 * Format an RCA item as a human-readable summary string.
 * @param {Object} rca - Claude RCA output
 * @param {Object} [evidence] - Original failure evidence
 * @returns {string}
 */
function formatRCASummary(rca, evidence = {}) {
    const sev = getSeverity(rca.severity);
    const cat = getCategory(rca.category);
    const confidencePct = Math.round((rca.confidence || 0) * 100);

    return [
        `${sev.emoji} ${sev.code} — ${evidence.test || 'Unknown test'}`,
        `  Merchant:  ${evidence.merchant || 'Unknown'}`,
        `  Category:  ${cat.emoji} ${cat.label}`,
        `  Cause:     ${rca.probableCause}`,
        `  Confidence: ${confidencePct}%`,
        `  Action:    ${rca.recommendedAction}`,
    ].join('\n');
}

module.exports = {
    SEVERITY_MAP,
    CATEGORY_MAP,
    FAILURE_CLASSES,
    getSeverity,
    getCategory,
    sortBySeverity,
    groupBySeverity,
    groupByMerchant,
    formatRCASummary,
};
