/**
 * utils/evidence.js — Failure Evidence Assembler
 *
 * Builds the structured JSON failure evidence bundle that is sent to
 * Claude for root cause analysis.
 *
 * Schema matches Section 20 of the SUNTEK AI QC implementation guide:
 * {
 *   merchant, test, status, browser, url,
 *   expected, actual, playwrightError,
 *   consoleErrors, networkErrors,
 *   screenshot, video, trace,
 *   timestamp
 * }
 *
 * Usage:
 *   const { buildFailureEvidence, saveEvidenceFile } = require('../utils/evidence');
 *
 *   const evidence = buildFailureEvidence({
 *     merchant:       'The Outset',
 *     testName:       'Add to Cart',
 *     browser:        'desktop-chromium',
 *     url:            '/products/example',
 *     expected:       'Product added to cart',
 *     actual:         'Cart request rejected with 400',
 *     playwrightError: error.message,
 *     consoleErrors:  consoleCapture.getErrors(),
 *     networkErrors:  networkCapture.getFailures(),
 *     testInfo,
 *   });
 */

const fs   = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.join(process.cwd(), 'reports', 'evidence');

/**
 * Ensure the evidence output directory exists.
 */
function ensureDir() {
    if (!fs.existsSync(EVIDENCE_DIR)) {
        fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
}

/**
 * Build a structured failure evidence object.
 *
 * @param {Object} params
 * @param {string} params.merchant          - Merchant name (e.g. 'The Outset')
 * @param {string} params.testName          - Test title
 * @param {string} params.browser           - Project name (e.g. 'desktop-chromium')
 * @param {string} params.url               - Current page URL when failure occurred
 * @param {string} params.expected          - What the test expected to happen
 * @param {string} params.actual            - What actually happened
 * @param {string} [params.playwrightError] - Playwright assertion/error message
 * @param {Array}  [params.consoleErrors]   - Array from captureConsoleErrors()
 * @param {Array}  [params.networkErrors]   - Array from captureNetworkFailures()
 * @param {import('@playwright/test').TestInfo} [params.testInfo] - Playwright TestInfo
 * @returns {Object} Structured evidence JSON object
 */
function buildFailureEvidence(params) {
    const {
        merchant,
        testName,
        browser,
        url,
        expected,
        actual,
        playwrightError = '',
        consoleErrors   = [],
        networkErrors   = [],
        testInfo        = null,
    } = params;

    // Extract artifact paths from TestInfo if available
    let screenshotPath = null;
    let videoPath      = null;
    let tracePath      = null;

    if (testInfo) {
        const attachments = testInfo.attachments || [];
        const screenshot  = attachments.find(a => a.contentType === 'image/png');
        const video       = attachments.find(a => a.name === 'video');
        const trace       = attachments.find(a => a.name === 'trace');

        if (screenshot) screenshotPath = screenshot.path;
        if (video)      videoPath      = video.path;
        if (trace)      tracePath      = trace.path;
    }

    return {
        merchant,
        test:           testName,
        status:         'FAIL',
        browser,
        url,
        expected,
        actual,
        playwrightError,
        // True when any HTTP 429 was seen (checked before the cap below) — usually
        // Cloudflare throttling caused by the run itself, not a site defect.
        rateLimited:    networkErrors.some(e => e.status === 429),
        consoleErrors:  consoleErrors.slice(0, 10),   // Cap at 10 for Claude context
        networkErrors:  networkErrors.slice(0, 20),   // Cap at 20 for Claude context
        screenshot:     screenshotPath,
        video:          videoPath,
        trace:          tracePath,
        timestamp:      new Date().toISOString(),
    };
}

/**
 * Save a failure evidence object to disk as a JSON file.
 *
 * @param {Object} evidence - Failure evidence from buildFailureEvidence()
 * @param {string} [name]   - Optional file name prefix
 * @returns {string} Absolute path to the saved evidence file
 */
function saveEvidenceFile(evidence, name = null) {
    ensureDir();

    const slug      = (name || evidence.test || 'failure')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');
    const timestamp = Date.now();
    const filename  = `${slug}-${timestamp}.json`;
    const filepath  = path.join(EVIDENCE_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(evidence, null, 2), 'utf-8');

    return filepath;
}

/**
 * Load all evidence JSON files from the evidence directory.
 * Used by the AI analysis pipeline after a test run.
 *
 * @returns {Array<{ path: string, evidence: Object }>}
 */
function loadAllEvidence() {
    ensureDir();

    const files = fs.readdirSync(EVIDENCE_DIR)
        .filter(f => f.endsWith('.json'));

    return files.map(file => {
        const filepath = path.join(EVIDENCE_DIR, file);
        try {
            const evidence = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
            return { path: filepath, evidence };
        } catch (e) {
            console.warn(`[evidence] Failed to parse ${file}: ${e.message}`);
            return null;
        }
    }).filter(Boolean);
}

module.exports = { buildFailureEvidence, saveEvidenceFile, loadAllEvidence, EVIDENCE_DIR };
