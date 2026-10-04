/**
 * ai/analyze-failure.js — Claude AI Failure Analysis
 *
 * Sends failed test evidence to Claude for root cause analysis (RCA).
 *
 * Flow:
 *   failure.json (from utils/evidence.js)
 *       ↓
 *   Claude API (claude-sonnet-5-5)
 *       ↓
 *   RCA JSON: { status, severity, category, probableCause, confidence, recommendedAction }
 *
 * IMPORTANT RULES:
 *   - Only FAIL/WARN evidence is sent to Claude — never PASS results.
 *   - Claude does NOT decide whether a test passed or failed.
 *   - Playwright assertions are always the source of truth for PASS/FAIL.
 *   - All RCA output is advisory — QA makes the final decision.
 *
 * Usage:
 *   const { analyzeFailure } = require('./analyze-failure');
 *   const rca = await analyzeFailure(evidenceObject);
 *
 * CLI:
 *   node ai/analyze-failure.js               ← analyzes all evidence in reports/evidence/
 *   node ai/analyze-failure.js --test        ← runs with mock data (no API key needed)
 *   node ai/analyze-failure.js --dry-run     ← shows prompt without calling API
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const { loadAllEvidence } = require('../utils/evidence');

// ── Config ────────────────────────────────────────────────────────────────────

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL   = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

const RCA_DIR = path.join(process.cwd(), 'reports', 'rca');

// ── System Prompt ─────────────────────────────────────────────────────────────
// As specified in Section 22 of the SUNTEK AI QC Implementation Guide.

const SYSTEM_PROMPT = `You are Suntek's ecommerce QA analyst.

Playwright assertions determine PASS or FAIL.

Do not decide whether a deterministic assertion passed.

Analyze the supplied failed automated test and evidence.

Your responsibilities:

1. Explain the failure in plain English.
2. Classify severity:
   P0 - Site down / checkout completely broken
   P1 - Critical commerce flow broken (ATC, checkout, subscription)
   P2 - Feature broken but workaround exists
   P3 - Cosmetic / minor UX issue

3. Classify the failure category:
   functional
   visual
   analytics
   third-party integration
   network
   test automation issue

4. Identify the probable root cause.

5. Provide confidence from 0 to 1.

6. Recommend the next QA investigation step.

If "rateLimited" is true, HTTP 429 responses were seen. That is usually
Cloudflare throttling caused by the test run itself, not a site defect:
say so, use category "network", and recommend re-running at lower load
(e.g. the smoke tier or a single module) before treating it as a real bug.

Do not claim certainty when the evidence is insufficient.

If the evidence suggests the automation itself is broken,
identify that explicitly.

Return JSON only — no markdown, no explanation outside the JSON object.`;

// ── Evidence → Prompt ─────────────────────────────────────────────────────────

/**
 * Build the user message content from a failure evidence object.
 * Only includes fields that are useful for Claude's analysis.
 * Screenshot paths are referenced but not sent as binary (Claude cannot see images via text API).
 *
 * @param {Object} evidence
 * @returns {string}
 */
function buildUserMessage(evidence) {
    const msg = {
        merchant:        evidence.merchant,
        test:            evidence.test,
        browser:         evidence.browser,
        url:             evidence.url,
        expected:        evidence.expected,
        actual:          evidence.actual,
        playwrightError: evidence.playwrightError,
        consoleErrors:   evidence.consoleErrors || [],
        networkErrors:   evidence.networkErrors || [],
        rateLimited:     !!evidence.rateLimited,
        screenshotAvailable: !!evidence.screenshot,
        traceAvailable:      !!evidence.trace,
        timestamp:       evidence.timestamp,
    };

    return `Analyze this failed Playwright test:\n\n${JSON.stringify(msg, null, 2)}`;
}

// ── Claude API Call ───────────────────────────────────────────────────────────

/**
 * Call the Claude API with failure evidence and return structured RCA.
 *
 * @param {Object} evidence - Failure evidence from buildFailureEvidence()
 * @returns {Promise<Object>} RCA JSON: { status, severity, category, probableCause, confidence, recommendedAction }
 */
async function analyzeFailure(evidence) {
    if (!CLAUDE_API_KEY || CLAUDE_API_KEY === 'your_claude_api_key_here') {
        console.warn('[Claude] No API key configured — returning mock RCA.');
        return getMockRCA(evidence);
    }

    const userMessage = buildUserMessage(evidence);

    const payload = {
        model:      CLAUDE_MODEL,
        max_tokens: 16000,   // thinking tokens count toward this, so leave room for the JSON
        system:     SYSTEM_PROMPT,
        messages: [
            { role: 'user', content: userMessage },
        ],
    };

    try {
        const response = await fetch(CLAUDE_API_URL, {
            method:  'POST',
            headers: {
                'Content-Type':      'application/json',
                'x-api-key':         CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Claude API error ${response.status}: ${error}`);
        }

        const data    = await response.json();
        // Thinking is on by default on current Sonnet models, so content[0] may be a
        // thinking block — take the text block instead.
        const content = (data.content || []).find(b => b.type === 'text')?.text || '';

        // Parse Claude's JSON response
        try {
            return JSON.parse(content);
        } catch {
            // If Claude returned text with embedded JSON, try to extract it
            const match = content.match(/\{[\s\S]+\}/);
            if (match) return JSON.parse(match[0]);
            throw new Error(`Claude returned non-JSON content: ${content}`);
        }

    } catch (error) {
        console.error(`[Claude] Analysis failed: ${error.message}`);
        return {
            status:              'FAIL',
            severity:            'P2',
            category:            'unknown',
            probableCause:       `Claude analysis failed: ${error.message}`,
            confidence:          0,
            recommendedAction:   'Investigate failure manually. Claude was unavailable.',
        };
    }
}

// ── Mock RCA (no API key) ─────────────────────────────────────────────────────

/**
 * Returns a mock RCA response for development/testing without a real API key.
 * @param {Object} evidence
 * @returns {Object}
 */
function getMockRCA(evidence) {
    return {
        status:            'FAIL',
        severity:          'P2',
        category:          'functional',
        probableCause:     `[MOCK] Test "${evidence.test}" failed. Real Claude analysis requires CLAUDE_API_KEY.`,
        confidence:        0.5,
        recommendedAction: 'Configure CLAUDE_API_KEY in .env to enable real AI analysis.',
        mock:              true,
    };
}

// ── Batch Analysis ────────────────────────────────────────────────────────────

/**
 * Analyze all failure evidence files in reports/evidence/.
 * Saves RCA JSON files alongside evidence files in reports/rca/.
 *
 * @returns {Promise<Array>} Array of { evidence, rca } objects
 */
async function analyzeAllFailures() {
    const evidenceItems = loadAllEvidence();

    if (evidenceItems.length === 0) {
        console.log('[Claude] No failure evidence found. All tests passed or no evidence was saved.');
        return [];
    }

    // Ensure RCA output directory exists
    if (!fs.existsSync(RCA_DIR)) {
        fs.mkdirSync(RCA_DIR, { recursive: true });
    }

    console.log(`[Claude] Analyzing ${evidenceItems.length} failure(s)...`);

    const results = [];

    for (const { path: evidencePath, evidence } of evidenceItems) {
        console.log(`  → Analyzing: ${evidence.test} (${evidence.merchant})`);

        const rca = await analyzeFailure(evidence);

        // Save RCA alongside evidence
        const rcaFilename = path.basename(evidencePath).replace('.json', '-rca.json');
        const rcaPath     = path.join(RCA_DIR, rcaFilename);
        const rcaOutput   = { ...evidence, rca };

        fs.writeFileSync(rcaPath, JSON.stringify(rcaOutput, null, 2), 'utf-8');
        console.log(`     Severity: ${rca.severity} | Confidence: ${rca.confidence} | Category: ${rca.category}`);
        console.log(`     Probable Cause: ${rca.probableCause}`);

        results.push({ evidence, rca, rcaPath });
    }

    return results;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--test')) {
        // Run with mock evidence for testing
        const mockEvidence = {
            merchant:        'The Outset',
            test:            'Subscription Add To Cart',
            status:          'FAIL',
            browser:         'mobile-chrome',
            url:             '/products/firming-vegan-collagen-prep-serum',
            expected:        'Product added with selected selling plan',
            actual:          'Cart request rejected',
            playwrightError: 'Expected response status 200 but received 400',
            consoleErrors:   [],
            networkErrors:   [{ url: '/cart/add.js', status: 400, method: 'POST' }],
            timestamp:       new Date().toISOString(),
        };

        console.log('[Claude] Running with mock evidence...');
        analyzeFailure(mockEvidence).then(rca => {
            console.log('\n[RCA Output]');
            console.log(JSON.stringify(rca, null, 2));
        });
    } else if (args.includes('--dry-run')) {
        const mockEvidence = { merchant: 'Test', test: 'Example', browser: 'chromium', url: '/', expected: 'Pass', actual: 'Fail', playwrightError: 'Assertion failed' };
        console.log('[Dry Run] System Prompt:\n', SYSTEM_PROMPT);
        console.log('\n[Dry Run] User Message:\n', buildUserMessage(mockEvidence));
    } else {
        analyzeAllFailures().then(results => {
            console.log(`\n[Claude] Analysis complete. ${results.length} failure(s) analyzed.`);
            if (results.length > 0) {
                console.log(`RCA files saved to: ${RCA_DIR}`);
            }
        });
    }
}

module.exports = { analyzeFailure, analyzeAllFailures, getMockRCA };
