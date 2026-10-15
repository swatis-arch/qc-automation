/**
 * tests/ticket-checks.spec.js — runs the checks the QC Console derived from a Jira ticket.
 *
 * The console writes the checks to a JSON file and passes its path in QC_TICKET_CHECKS:
 *   { "key": "KOH-68", "summary": "...", "checks": [ { title, type, page, text, percent, tolerance, product } ] }
 * Each check becomes one test, so the report shows pass/fail per acceptance criterion.
 * The checks are validated again here (utils/ticket-checks.js); this spec never runs ticket text as code.
 *
 * Without QC_TICKET_CHECKS this file defines no tests, so it is inert in tier runs.
 * Not registered in utils/tiers.js: only the console runs it (scripts/run-suite.js ticket ...).
 */

const fs = require('fs');
const { test, expect, setupPage } = require('../fixtures/base');
const { validateChecks, runCheck }  = require('../utils/ticket-checks');

const file = process.env.QC_TICKET_CHECKS;
const data = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;

if (data) {
    const checks = validateChecks(data.checks, { adhoc: Boolean(process.env.QC_ADHOC_BASE_URL) });

    test.describe(`${data.key} — ${data.summary || 'ticket checks'}`, () => {
        checks.forEach((check, i) => {
            test(`${data.key} #${i + 1} ${check.title}`, async ({ page, merchant }, testInfo) => {
                // Cart and checkout checks add a product first (KOH's bundle builder alone takes ~40 s).
                if (check.page === 'cart' || check.page === 'checkout') test.setTimeout(150_000);
                await setupPage(page);
                await runCheck(check, { page, merchant, expect, testInfo });
            });
        });
    });
}
