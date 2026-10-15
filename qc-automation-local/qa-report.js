/**
 * qa-report.js — Local QA/QC pipeline runner
 *
 * Runs the full local flow from a single VS Code terminal command:
 *   1. Playwright regression suite (for MERCHANT, see .env)
 *   2. Claude failure analysis (mock RCA until CLAUDE_API_KEY or OPENROUTER_API_KEY is set in .env)
 *   3. Consolidated report generation (reports/qa-report.json + .md)
 *   4. Slack notification (SLACK_WEBHOOK_URL in .env)
 *
 * Each step runs even if an earlier one exits non-zero -- a failing test
 * run is the normal case this pipeline exists to report on, not an error
 * that should abort the report.
 *
 * Usage:
 *   npm run qa:report                              (full suite, ~all tests)
 *   npm run qa:report -- --dry-run                  (skips the actual Slack POST)
 *   npm run qa:report -- tests/checkout.spec.js      (just one spec file -- fast)
 *   npm run qa:report -- --grep "@smoke"             (just @smoke-tagged tests)
 * Any arg other than --dry-run is passed straight through to `playwright test`,
 * so anything `npx playwright test` accepts (a spec path, --grep, -g, etc.)
 * works here too -- useful for a quick end-to-end check without waiting on
 * the full run.
 */

const { execSync } = require('child_process');

const args   = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const testArgs = args.filter(a => a !== '--dry-run').join(' ');

function run(cmd) {
    console.log(`\n$ ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch {
        console.warn(`  (step exited non-zero -- continuing to next step)`);
    }
}

run(`npx playwright test ${testArgs}`.trim());
run('node ai/analyze-failure.js');
run('node ai/generate-report.js');
run(`node notifications/slack.js${dryRun ? ' --dry-run' : ''}`);

console.log('\nDone.');
console.log('  Markdown report: reports/qa-report.md');
console.log('  HTML report:     reports/html/index.html  (npm run test:report)');
