/**
 * ai/generate-report.js — Consolidated QA Report Generator
 *
 * Reads:
 *   - reports/results.json (Playwright JSON reporter output)
 *   - reports/rca/*.json   (Claude RCA files from analyze-failure.js)
 *
 * Produces:
 *   - reports/qa-report.json     (Machine-readable consolidated report)
 *   - reports/qa-report.md       (Human-readable Markdown report for Slack/Jira)
 *
 * Usage:
 *   node ai/generate-report.js
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const { groupBySeverity, getSeverity, getCategory, formatRCASummary } = require('./classify-severity');

// ── Paths ─────────────────────────────────────────────────────────────────────

const REPORTS_DIR      = path.join(process.cwd(), 'reports');
const RCA_DIR          = path.join(REPORTS_DIR, 'rca');
const RESULTS_JSON     = path.join(REPORTS_DIR, 'results.json');
const QA_REPORT_JSON   = path.join(REPORTS_DIR, 'qa-report.json');
const QA_REPORT_MD     = path.join(REPORTS_DIR, 'qa-report.md');

// ── Load Playwright Results ───────────────────────────────────────────────────

/**
 * Parse the Playwright JSON results file.
 * @returns {{ total: number, passed: number, failed: number, skipped: number }}
 */
function loadPlaywrightResults() {
    if (!fs.existsSync(RESULTS_JSON)) {
        console.warn('[Report] No results.json found. Run tests first.');
        return { total: 0, passed: 0, failed: 0, skipped: 0, suites: [] };
    }

    const data = JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf-8'));

    let passed  = 0;
    let failed  = 0;
    let skipped = 0;

    function countTests(suite) {
        if (!suite) return;
        for (const spec of (suite.specs || [])) {
            for (const test of (spec.tests || [])) {
                const status = test.results?.[0]?.status;
                if (status === 'passed')  passed++;
                else if (status === 'failed')  failed++;
                else skipped++;
            }
        }
        for (const child of (suite.suites || [])) {
            countTests(child);
        }
    }

    for (const suite of (data.suites || [])) {
        countTests(suite);
    }

    return {
        total:   passed + failed + skipped,
        passed,
        failed,
        skipped,
        suites:  data.suites || [],
    };
}

// ── Load RCA Files ────────────────────────────────────────────────────────────

/**
 * Load all RCA JSON files from reports/rca/.
 * @returns {Array}
 */
function loadRCAResults() {
    if (!fs.existsSync(RCA_DIR)) return [];

    return fs.readdirSync(RCA_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => {
            try {
                return JSON.parse(fs.readFileSync(path.join(RCA_DIR, f), 'utf-8'));
            } catch (e) {
                console.warn(`[Report] Failed to parse RCA file ${f}: ${e.message}`);
                return null;
            }
        })
        .filter(Boolean);
}

// ── Build Consolidated Report ─────────────────────────────────────────────────

/**
 * Build the consolidated QA report object.
 * @returns {Object}
 */
function buildReport() {
    const playwright = loadPlaywrightResults();
    const rcaItems   = loadRCAResults();

    const grouped = groupBySeverity(rcaItems.map(item => ({
        evidence: item,
        rca:      item.rca || {},
    })));

    const report = {
        generated:   new Date().toISOString(),
        merchant:    process.env.MERCHANT || 'outset',
        triggeredBy: process.env.TRIGGERED_BY || null,
        summary: {
            total:    playwright.total,
            passed:   playwright.passed,
            failed:   playwright.failed,
            skipped:  playwright.skipped,
            passRate: playwright.total > 0
                ? `${Math.round((playwright.passed / playwright.total) * 100)}%`
                : '0%',
        },
        severity: {
            P0: grouped.P0.length,
            P1: grouped.P1.length,
            P2: grouped.P2.length,
            P3: grouped.P3.length,
        },
        failures: rcaItems,
    };

    return { report, grouped, playwright };
}

// ── Markdown Report ───────────────────────────────────────────────────────────

/**
 * Generate a human-readable Markdown report.
 * @param {Object} report - From buildReport()
 * @param {Object} grouped - Severity-grouped failures
 * @returns {string}
 */
function generateMarkdown(report, grouped) {
    const { summary, severity } = report;
    const now = new Date(report.generated).toLocaleString('en-US', { timeZone: 'UTC' });

    const lines = [
        `# SUNTEK AI QC — QA Report`,
        `**Generated:** ${now} UTC`,
        `**Merchant:** ${report.merchant}`,
        ``,
        `## Summary`,
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Total Tests | ${summary.total} |`,
        `| ✅ Passed | ${summary.passed} |`,
        `| ❌ Failed | ${summary.failed} |`,
        `| ⏭️ Skipped | ${summary.skipped} |`,
        `| Pass Rate | ${summary.passRate} |`,
        ``,
        `## Severity Breakdown`,
        `| Severity | Count |`,
        `|----------|-------|`,
        `| 🔴 P0 Critical | ${severity.P0} |`,
        `| 🟠 P1 High | ${severity.P1} |`,
        `| 🟡 P2 Medium | ${severity.P2} |`,
        `| 🟢 P3 Low | ${severity.P3} |`,
        ``,
    ];

    if (report.failures.length === 0) {
        lines.push(`## ✅ All Tests Passed`);
        lines.push(`No failures detected in this run.`);
    } else {
        lines.push(`## Failures`);

        for (const sev of ['P0', 'P1', 'P2', 'P3']) {
            const items = grouped[sev];
            if (items.length === 0) continue;

            const sevInfo = getSeverity(sev);
            lines.push(``, `### ${sevInfo.emoji} ${sev} — ${sevInfo.label} (${items.length})`);

            for (const { evidence, rca } of items) {
                const cat         = getCategory(rca.category);
                const confidence  = Math.round((rca.confidence || 0) * 100);

                lines.push(``, `#### ${evidence.test || 'Unknown test'}`);
                lines.push(`- **Merchant:** ${evidence.merchant || 'Unknown'}`);
                lines.push(`- **Browser:** ${evidence.browser || 'Unknown'}`);
                lines.push(`- **URL:** \`${evidence.url || '/'}\``);
                lines.push(`- **Category:** ${cat.emoji} ${cat.label}`);
                lines.push(`- **Probable Cause:** ${rca.probableCause}`);
                lines.push(`- **Confidence:** ${confidence}%`);
                lines.push(`- **Recommended Action:** ${rca.recommendedAction}`);

                if (evidence.networkErrors?.length > 0) {
                    lines.push(`- **Network Errors:**`);
                    for (const ne of evidence.networkErrors.slice(0, 3)) {
                        lines.push(`  - \`[${ne.status}] ${ne.method || ''} ${ne.url}\``);
                    }
                }
            }
        }
    }

    lines.push(``, `---`, `*Report generated by SUNTEK AI QC — Playwright + Claude*`);
    return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

function generateReport() {
    console.log('[Report] Generating consolidated QA report...');

    const { report, grouped } = buildReport();

    // Ensure reports directory exists
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }

    // Save JSON report
    fs.writeFileSync(QA_REPORT_JSON, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`[Report] JSON saved: ${QA_REPORT_JSON}`);

    // Save Markdown report
    const markdown = generateMarkdown(report, grouped);
    fs.writeFileSync(QA_REPORT_MD, markdown, 'utf-8');
    console.log(`[Report] Markdown saved: ${QA_REPORT_MD}`);

    // Print summary
    const { summary, severity } = report;
    console.log(`\n── QA Summary ─────────────────────────────`);
    console.log(`Total:   ${summary.total} | Pass: ${summary.passed} | Fail: ${summary.failed} | Skip: ${summary.skipped}`);
    console.log(`Pass Rate: ${summary.passRate}`);
    console.log(`Severity: P0=${severity.P0}  P1=${severity.P1}  P2=${severity.P2}  P3=${severity.P3}`);
    console.log(`───────────────────────────────────────────`);

    return { report, grouped };
}

if (require.main === module) {
    generateReport();
}

module.exports = { generateReport, buildReport, generateMarkdown };
