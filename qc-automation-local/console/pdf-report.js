/**
 * console/pdf-report.js — the report for one QC Console run, as PDF (report.pdf) and web page (report.html).
 *
 * Laid out like a QA regression report for a merchant: a one-line verdict, results by suite, the site
 * issues found in plain words (severity, where, failing tests), the evidence for each with its screenshot,
 * failures QA should check first, other observations and next steps. An appendix keeps the technical
 * detail (Playwright errors, AI root-cause guesses) and every test with its status.
 *
 * The words come from console/run-report.js (summary.json, written by Claude from the Playwright results).
 * Reads reports/console/runs/<id>/: results.json, qa-report.json, summary.json, shots/*.png.
 * Rendered with Playwright's Chromium, so no extra dependency.
 *
 * CLI (rebuild a run's report):  node console/pdf-report.js <runId> [--rewrite]   (--rewrite: new AI summary)
 */

const fs   = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { buildSummary, allTests, rcaIndex, viewportOf } = require('./run-report');

const RUNS_DIR = path.join(__dirname, '..', 'reports', 'console', 'runs');

const esc   = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMs = ms => ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s`;
const LABEL = { expected: 'PASS', unexpected: 'FAIL', flaky: 'FLAKY', skipped: 'SKIP' };
const SEV_TEXT = { P0: 'site down / checkout broken', P1: 'core buying flow broken', P2: 'feature broken, workaround exists', P3: 'cosmetic / minor' };

function imgTag(file, alt) {
    if (!file || !fs.existsSync(file)) return '';
    return `<img class="shot" alt="${esc(alt)}" src="data:image/png;base64,${fs.readFileSync(file).toString('base64')}">`;
}

/** The report's title: the ticket, the store regression, or the suite on the merchant. */
function titleOf(run, summary) {
    const date = new Date(run.started || run.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const store = summary.facts.store;
    const what = run.ticket ? `${run.ticket.key} Test Report`
        : run.plan.target === 'store' ? `${store} Regression Report`
        : run.plan.target === 'ticket' ? `${store} Check Report`
        : `${store.toUpperCase()} ${run.plan.target} Report`;
    return `${what} – ${date}`;
}

function buildHtml(run, results, qaReport, runDir, summary) {
    const tests   = allTests(results);
    const rca     = rcaIndex(qaReport);
    const failing = summary.failing || [];
    const byRef   = new Map(failing.map(f => [f.ref, f]));
    const shotOf  = ref => {
        const f = byRef.get(ref);
        const shot = f && (run.failures || []).find(x => x.title === f.title && x.project === f.project);
        return shot && shot.screenshot ? path.join(runDir, shot.screenshot) : null;
    };
    const testsCell = refs => refs.map(r => byRef.get(r)).filter(Boolean)
        .map(f => `${esc(f.title.replace(/^@\w+\s+/, ''))} <span class="muted">(${viewportOf(f.project)})</span>`).join('<br>');
    const s = summary.facts;

    // Results by suite (the Area column only when the run spans several)
    const oneArea = new Set(summary.suites.map(r => r.area)).size === 1;
    const areaTd  = r => (oneArea ? '' : `<td>${esc(r.area)}</td>`);
    const suiteRows = summary.suites.map(r => `<tr>${areaTd(r)}<td>${esc(r.suite)}</td><td class="num">${r.tests}</td>` +
        `<td class="num">${r.passed}</td><td class="num ${r.failed ? 'bad' : ''}">${r.failed}</td><td class="num">${r.flaky}</td></tr>`).join('');
    const tot = summary.suites.reduce((a, r) => ({ tests: a.tests + r.tests, passed: a.passed + r.passed, failed: a.failed + r.failed, flaky: a.flaky + r.flaky }), { tests: 0, passed: 0, failed: 0, flaky: 0 });

    // Issues
    const issueRows = summary.issues.map((i, n) => `<tr><td class="num">${n + 1}</td><td>${esc(i.title)}</td><td><span class="sev ${i.severity}">${i.severity}</span></td>` +
        `<td>${esc(i.where)}</td><td>${testsCell(i.refs)}</td></tr>`).join('');
    const worst = summary.issues[0];
    const issuesLead = summary.issues.length
        ? `${summary.issues.length} issue${summary.issues.length > 1 ? 's' : ''} found on the site${worst ? `; the most serious: ${esc(worst.title.replace(/\.$/, ''))} (${worst.severity}).` : '.'} ` +
          'Severities are proposals for QA to confirm before anything is sent to the merchant (P0 site down, P1 core buying flow broken, P2 feature broken with a workaround, P3 cosmetic).'
        : 'No problems on the site were found in this run.';

    const evidence = summary.issues.map((i, n) => {
        const ref  = i.refs.find(r => shotOf(r)) || i.refs[0];
        return `<section class="evidence"><h3>${n + 1}. ${esc(i.title)} <span class="sev ${i.severity}">${i.severity}</span></h3>
          <p>${esc(i.evidence)}</p>${imgTag(shotOf(ref), i.title) || '<p class="muted">No screenshot was captured for this check.</p>'}</section>`;
    }).join('');

    const qaRows = summary.qaChecks.map((q, n) => `<tr><td class="num">${n + 1}</td><td>${esc(q.title)}<br><span class="muted">${testsCell(q.refs)}</span></td><td>${esc(q.why)}</td></tr>`).join('');
    const observations = summary.observations.map(o => `<li><b>${esc(o.label)}:</b> ${esc(o.text)}</li>`).join('');
    const nextSteps = summary.nextSteps.map(x => `<li>${esc(x)}</li>`).join('');

    // Appendix: technical detail per failing test, then every test.
    const technical = failing.map(f => {
        const t = tests.find(x => x.title === f.title && x.project === f.project) || {};
        const r = rca.get(`${f.title}|${f.project}`);
        return `<div class="tech"><b>${esc(f.ref)} · ${esc(f.title)}</b> <span class="muted">${esc(f.project)} · ${esc(f.area)} › ${esc(f.suite)}${f.status === 'flaky' ? ' · flaky (passed on retry)' : ''}</span>
          ${r && r.url ? `<div class="muted">URL: ${esc(r.url)}</div>` : ''}
          <pre>${esc((t.error || '(no error message)').split('\n').filter(l => !/^\s+at /.test(l)).slice(0, 14).join('\n'))}</pre>
          ${r ? `<div class="muted">AI root-cause guess (${esc(r.severity || '-')}, ${esc(r.category || '-')}, confidence ${typeof r.confidence === 'number' ? r.confidence.toFixed(2) : '-'}${r.rateLimited ? ', HTTP 429 seen' : ''}): ${esc(r.probableCause || '-')}</div>` : ''}</div>`;
    }).join('');
    const allRows = tests.map(t => `<tr class="${esc(t.status)}"><td class="st">${LABEL[t.status] || esc(t.status)}</td><td>${esc(t.title)}</td><td>${esc(t.suite)}</td><td>${esc(viewportOf(t.project))}</td><td class="num">${t.status === 'skipped' ? '' : fmtMs(t.duration)}</td></tr>`).join('');

    const started = new Date(run.started || run.created);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(titleOf(run, summary))}</title><style>
      @page { size: A4; margin: 16mm 14mm; }
      body { font: 11px/1.55 "Segoe UI", Arial, sans-serif; color: #1f2328; max-width: 860px; margin: 0 auto; padding: 0 16px; background: #fff; }
      h1 { font-size: 23px; margin: 18px 0 4px; } h2 { font-size: 16px; margin: 26px 0 8px; }
      h3 { font-size: 12.5px; margin: 18px 0 4px; } p { margin: 6px 0; }
      .byline { color: #59636e; margin: 0 0 12px; } .lead { font-size: 12.5px; margin: 10px 0 4px; }
      .muted { color: #59636e; } .bad { color: #c62f2f; font-weight: 600; }
      table { border-collapse: collapse; width: 100%; margin: 8px 0; }
      th, td { border-bottom: 1px solid #e3e6ea; padding: 5px 7px; text-align: left; vertical-align: top; }
      th { background: #f6f8fa; font-weight: 600; } tr { break-inside: avoid; } thead { display: table-header-group; }
      .num { text-align: right; white-space: nowrap; } tr.total td { font-weight: 700; border-top: 1.5px solid #1f2328; }
      .sev { display: inline-block; font-weight: 700; font-size: 10px; padding: 1px 6px; border-radius: 10px; white-space: nowrap; }
      .P0, .P1 { background: #fde8e8; color: #b42318; } .P2 { background: #fff4e0; color: #9a5b00; } .P3 { background: #eef2f6; color: #4a5562; }
      .evidence { break-inside: avoid-page; } .shot { display: block; max-width: 100%; max-height: 120mm; object-fit: contain; object-position: top left; border: 1px solid #d9dee5; border-radius: 4px; margin: 6px 0 4px; }
      ul.obs { padding-left: 18px; } ul.steps { list-style: none; padding-left: 2px; } ul.steps li::before { content: "☐  "; }
      .note { color: #59636e; font-size: 10.5px; border-top: 1px solid #e3e6ea; margin-top: 22px; padding-top: 8px; }
      .tech { margin: 0 0 12px; break-inside: avoid; } pre { background: #f6f8fa; border: 1px solid #e3e6ea; border-radius: 4px; padding: 6px 8px; white-space: pre-wrap; word-break: break-word; font-size: 9px; margin: 4px 0; }
      table.all { font-size: 9.5px; } .st { font-weight: 700; width: 38px; }
      tr.expected .st { color: #1f8a4c; } tr.unexpected .st { color: #c62f2f; } tr.flaky .st { color: #b7791f; } tr.skipped .st { color: #8a94a3; }
      .pb { break-before: page; }
    </style></head><body>
      <h1>${esc(titleOf(run, summary))}</h1>
      <p class="byline">${esc(started.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))} · run by ${esc(run.user)} via QC Console · “${esc(run.command)}”${run.ticket ? ` · Jira <a href="${esc(run.ticket.url)}">${esc(run.ticket.key)}</a>` : ''}</p>
      <p class="lead">${esc(summary.lead)}</p>

      <h2>Results by suite${oneArea ? ` · ${esc(summary.suites[0] ? summary.suites[0].area : '')}` : ''}</h2>
      <table><thead><tr>${oneArea ? '' : '<th>Area</th>'}<th>Suite</th><th class="num">Tests</th><th class="num">Passed</th><th class="num">Failed</th><th class="num">Flaky</th></tr></thead>
        <tbody>${suiteRows}<tr class="total"><td>Total</td>${oneArea ? '' : '<td></td>'}<td class="num">${tot.tests}</td><td class="num">${tot.passed}</td><td class="num">${tot.failed}</td><td class="num">${tot.flaky}</td></tr></tbody></table>
      <p class="muted">Flaky = failed once, passed on the automatic retry (counted as passed). Tests: one per check per viewport (${esc(s.viewports.join(' and '))}). The run checks the live site read-only: no form is submitted and no order is placed (checkout tests stop on the checkout page).</p>

      <h2>Site issues found</h2>
      <p>${issuesLead}</p>
      ${summary.issues.length ? `<table><thead><tr><th class="num">#</th><th>Issue</th><th>Severity</th><th>Where</th><th>Failing test</th></tr></thead><tbody>${issueRows}</tbody></table>` : ''}

      ${summary.qaChecks.length ? `<h2>Needs a QA check first</h2>
      <p>These failures may come from the test rather than the site (slow loading, throttling, a popup in the way). They are not counted as site issues until QA confirms.</p>
      <table><thead><tr><th class="num">#</th><th>What failed</th><th>What to check</th></tr></thead><tbody>${qaRows}</tbody></table>` : ''}

      ${summary.issues.length ? `<h2>Failure evidence</h2><p class="muted">The screenshot taken when each check failed.</p>${evidence}` : ''}

      ${observations ? `<h2>Other observations</h2><p>Recorded during the run without failing a test.</p><ul class="obs">${observations}</ul>` : ''}
      ${nextSteps ? `<h2>Next steps</h2><ul class="steps">${nextSteps}</ul>` : ''}

      <p class="note">Playwright decides PASS/FAIL. The issue wording, severities and next steps are written by AI from the test results and screenshots${summary.source === 'claude' ? '' : ' (here without AI: one line per failing test)'}; QA makes the final call.
      ${summary.aiError ? `<br>AI summary unavailable: ${esc(summary.aiError)}` : ''}<br>Run ${esc(run.id)} · ${esc(run.label)}${s.minutes != null ? ` · ${s.minutes} min` : ''}</p>

      <h2 class="pb">Appendix A · Technical detail for QA (${failing.length})</h2>
      ${technical || '<p class="muted">No failing or flaky tests.</p>'}
      <h2 class="pb">Appendix B · All tests (${tests.length})</h2>
      <table class="all"><thead><tr><th>Status</th><th>Test</th><th>Suite</th><th>Viewport</th><th class="num">Time</th></tr></thead><tbody>${allRows}</tbody></table>
    </body></html>`;
}

/**
 * Write report.html and report.pdf for a run (and summary.json, unless one exists and !rewrite).
 * @returns {Promise<string>} path of the written PDF
 */
async function buildPdf(run, runDir, { rewrite = true } = {}) {
    const results  = JSON.parse(fs.readFileSync(path.join(runDir, 'results.json'), 'utf8'));
    const qaFile   = path.join(runDir, 'qa-report.json');
    const qaReport = fs.existsSync(qaFile) ? JSON.parse(fs.readFileSync(qaFile, 'utf8')) : null;
    const sumFile  = path.join(runDir, 'summary.json');
    const summary  = !rewrite && fs.existsSync(sumFile) ? JSON.parse(fs.readFileSync(sumFile, 'utf8')) : await buildSummary(run, runDir);
    const html     = buildHtml(run, results, qaReport, runDir, summary);
    fs.writeFileSync(path.join(runDir, 'report.html'), html);
    const out      = path.join(runDir, 'report.pdf');

    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        await page.pdf({
            path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate: `<div style="font-size:8px;color:#8a94a3;width:100%;padding:0 14mm;display:flex;justify-content:space-between">
              <span>SUNTEK AI QC · ${esc(titleOf(run, summary))}</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
            margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
        });
    } finally {
        await browser.close();
    }
    return out;
}

module.exports = { buildPdf, buildHtml };

if (require.main === module) {
    const id = process.argv[2];
    const runs = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, '..', 'runs.json'), 'utf8'));
    const run  = runs.find(r => r.id === id);
    if (!run) { console.error(`No run "${id}" in reports/console/runs.json`); process.exit(1); }
    buildPdf(run, path.join(RUNS_DIR, id), { rewrite: process.argv.includes('--rewrite') })
        .then(p => console.log(`PDF: ${p}\nHTML: ${p.replace(/\.pdf$/, '.html')}`), e => { console.error(e); process.exit(1); });
}
