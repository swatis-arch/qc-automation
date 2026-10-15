/**
 * console/pdf-report.js — PDF report for one QC Console run.
 *
 * Page 1: run details and totals. Then one section per failed/flaky test with the
 * Playwright error, Claude's RCA (advisory) and the failure screenshot. Last: every
 * test with its status and duration.
 *
 * Reads reports/console/runs/<id>/: results.json, qa-report.json, shots/*.png.
 * Rendered with Playwright's Chromium, so no extra dependency.
 *
 * CLI (rebuild a run's PDF):  node console/pdf-report.js <runId>
 */

const fs   = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const RUNS_DIR = path.join(__dirname, '..', 'reports', 'console', 'runs');

const esc   = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ansi  = s => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '');
const fmtMs = ms => ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s`;

/** Every test in results.json, flattened. */
function allTests(results) {
    const out = [];
    const walk = (suite, file) => {
        for (const spec of suite.specs || []) {
            for (const t of spec.tests || []) {
                const last = (t.results || []).slice(-1)[0] || {};
                out.push({
                    title:    spec.title,
                    file:     spec.file || file,
                    project:  t.projectName,
                    status:   t.status,                     // expected | unexpected | flaky | skipped
                    duration: (t.results || []).reduce((n, r) => n + (r.duration || 0), 0),
                    error:    ansi((last.error && (last.error.message || last.error.value)) || ''),
                    attachments: last.attachments || [],
                });
            }
        }
        (suite.suites || []).forEach(s => walk(s, suite.file || file));
    };
    (results.suites || []).forEach(s => walk(s, s.file));
    return out;
}

/** RCA entries from qa-report.json, keyed by "<test title>|<project>". */
function rcaIndex(qaReport) {
    const map = new Map();
    for (const group of (qaReport && qaReport.merchantBreakdown) || []) {
        for (const { evidence = {}, rca = {} } of group.failures || []) {
            map.set(`${evidence.test}|${evidence.browser}`, { ...rca, url: evidence.url, rateLimited: evidence.rateLimited });
        }
    }
    return map;
}

function imgTag(file) {
    if (!file || !fs.existsSync(file)) return '<p class="muted">No screenshot captured.</p>';
    const b64 = fs.readFileSync(file).toString('base64');
    return `<img class="shot" src="data:image/png;base64,${b64}">`;
}

const LABEL = { expected: 'PASS', unexpected: 'FAIL', flaky: 'FLAKY', skipped: 'SKIP' };

function buildHtml(run, results, qaReport, runDir) {
    const tests    = allTests(results);
    const rca      = rcaIndex(qaReport);
    const failures = tests.filter(t => t.status === 'unexpected' || t.status === 'flaky');
    const s        = run.summary || {};
    const total    = tests.length;
    const ran      = total - (s.skipped || 0);
    const passRate = ran ? Math.round(((s.passed || 0) / ran) * 100) : 0;
    const sev      = (qaReport && qaReport.severity) || {};
    const mock     = failures.some(f => /\[MOCK\]/.test(JSON.stringify(rca.get(`${f.title}|${f.project}`) || {})));

    const failureHtml = failures.map((f, i) => {
        const r    = rca.get(`${f.title}|${f.project}`);
        const shot = (run.failures || []).find(x => x.title === f.title && x.project === f.project);
        const shotFile = shot && shot.screenshot ? path.join(runDir, shot.screenshot) : null;
        const lowConf  = r && typeof r.confidence === 'number' && r.confidence < 0.7;
        return `
        <section class="failure">
          <h3>${i + 1}. ${esc(f.title)}</h3>
          <p class="muted">${esc(f.project)} · ${esc(f.file)} · ${fmtMs(f.duration)}${f.status === 'flaky' ? ' · <b>flaky</b> (passed on retry)' : ''}</p>
          ${r && r.url ? `<p class="muted">URL: ${esc(r.url)}</p>` : ''}
          <h4>Playwright error</h4>
          <pre>${esc(f.error.split('\n').slice(0, 25).join('\n') || '(no error message)')}</pre>
          ${r ? `
          <h4>Probable cause (AI, advisory)</h4>
          <table class="kv">
            <tr><th>Severity</th><td>${esc(r.severity || '-')}</td><th>Category</th><td>${esc(r.category || '-')}</td></tr>
            <tr><th>Confidence</th><td colspan="3">${typeof r.confidence === 'number' ? r.confidence.toFixed(2) : '-'}${lowConf ? ' (below 0.7: insufficient evidence, investigate manually)' : ''}${r.rateLimited ? ' · HTTP 429 seen, re-run at lower load first' : ''}</td></tr>
            <tr><th>Cause</th><td colspan="3">${esc(r.probableCause || '-')}</td></tr>
            <tr><th>Next step</th><td colspan="3">${esc(r.recommendedAction || '-')}</td></tr>
          </table>` : ''}
          <h4>Screenshot at failure</h4>
          ${imgTag(shotFile)}
        </section>`;
    }).join('');

    const rows = tests.map(t => `
        <tr class="${esc(t.status)}"><td class="st">${LABEL[t.status] || esc(t.status)}</td><td>${esc(t.title)}</td><td>${esc(t.project)}</td><td class="num">${t.status === 'skipped' ? '' : fmtMs(t.duration)}</td></tr>`).join('');

    return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: A4; margin: 14mm 12mm; }
      body { font: 10.5px/1.45 "Segoe UI", Arial, sans-serif; color: #1b1f24; }
      h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 22px 0 8px; border-bottom: 2px solid #1b1f24; padding-bottom: 3px; }
      h3 { font-size: 12.5px; margin: 0 0 2px; } h4 { font-size: 10.5px; margin: 10px 0 4px; text-transform: uppercase; letter-spacing: .03em; color: #5f6b7a; }
      .muted { color: #5f6b7a; margin: 2px 0; }
      .meta td { padding: 2px 14px 2px 0; } .meta th { text-align: left; color: #5f6b7a; font-weight: 500; padding-right: 10px; }
      .cards { display: flex; gap: 10px; margin: 14px 0; }
      .card { flex: 1; border: 1px solid #d9dee5; border-radius: 6px; padding: 8px 10px; }
      .card b { display: block; font-size: 20px; }
      .pass b { color: #1f8a4c; } .fail b { color: #c62f2f; } .flaky b { color: #b7791f; }
      .note { background: #fff7e6; border: 1px solid #f0d9a8; border-radius: 6px; padding: 8px 10px; margin: 10px 0; }
      .failure { border: 1px solid #d9dee5; border-left: 4px solid #c62f2f; border-radius: 6px; padding: 10px 12px; margin: 0 0 14px; break-inside: avoid-page; }
      pre { background: #f3f5f8; border: 1px solid #e2e6eb; border-radius: 4px; padding: 6px 8px; white-space: pre-wrap; word-break: break-word; font-size: 9px; margin: 0; }
      .kv { border-collapse: collapse; width: 100%; } .kv th { text-align: left; color: #5f6b7a; font-weight: 500; width: 80px; vertical-align: top; padding: 2px 6px 2px 0; } .kv td { padding: 2px 10px 2px 0; vertical-align: top; }
      .shot { display: block; max-width: 100%; max-height: 165mm; object-fit: contain; object-position: top left; border: 1px solid #d9dee5; }
      table.all { border-collapse: collapse; width: 100%; font-size: 9.5px; } table.all th, table.all td { border-bottom: 1px solid #e8ebef; padding: 3px 5px; text-align: left; vertical-align: top; }
      table.all thead { display: table-header-group; } table.all tr { break-inside: avoid; }
      table.all td:nth-child(3) { white-space: nowrap; color: #5f6b7a; }
      .st { font-weight: 700; width: 40px; } .num { text-align: right; white-space: nowrap; }
      tr.expected .st { color: #1f8a4c; } tr.unexpected .st { color: #c62f2f; } tr.flaky .st { color: #b7791f; } tr.skipped .st { color: #8a94a3; }
      .pb { break-before: page; }
    </style></head><body>
      <h1>SUNTEK AI QC — Test Report</h1>
      <p class="muted">${esc(run.label)}</p>
      <table class="meta">
        <tr><th>Merchant</th><td>${esc(run.plan.merchant)}</td><th>Viewport</th><td>${esc(run.plan.viewport)}</td></tr>
        <tr><th>Suite</th><td>${esc(run.plan.target)}${run.plan.grep ? ` (filter "${esc(run.plan.grep)}")` : ''}</td><th>Triggered by</th><td>${esc(run.user)} via QC Console</td></tr>
        <tr><th>Started</th><td>${esc(new Date(run.started).toLocaleString('en-GB'))}</td><th>Duration</th><td>${s.durationMin ?? '-'} min</td></tr>
        <tr><th>Command</th><td colspan="3">“${esc(run.command)}”</td></tr>
      </table>
      <div class="cards">
        <div class="card"><b>${total}</b>tests</div>
        <div class="card pass"><b>${s.passed || 0}</b>passed</div>
        <div class="card fail"><b>${s.failed || 0}</b>failed</div>
        <div class="card flaky"><b>${s.flaky || 0}</b>flaky</div>
        <div class="card"><b>${s.skipped || 0}</b>skipped</div>
        <div class="card"><b>${passRate}%</b>pass rate (of tests run)</div>
      </div>
      ${failures.length ? `<p>Severity of failures (AI estimate): P0 ${sev.P0 || 0} · P1 ${sev.P1 || 0} · P2 ${sev.P2 || 0} · P3 ${sev.P3 || 0}</p>` : '<p><b>All tests that ran passed.</b></p>'}
      <div class="note">Playwright decides PASS/FAIL. The “probable cause” for each failure is Claude's advisory analysis; QA makes the final call.
      ${mock ? '<br><b>This run used mock RCA</b> (no CLAUDE_API_KEY or OPENROUTER_API_KEY set), so the causes below are placeholders.' : ''}</div>

      ${failures.length ? `<h2 class="pb">Failures (${failures.length})</h2>${failureHtml}` : ''}

      <h2 class="pb">All tests (${total})</h2>
      <table class="all"><thead><tr><th>Status</th><th>Test</th><th>Project</th><th class="num">Time</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
}

/**
 * @returns {Promise<string>} path of the written PDF
 */
async function buildPdf(run, runDir) {
    const results  = JSON.parse(fs.readFileSync(path.join(runDir, 'results.json'), 'utf8'));
    const qaFile   = path.join(runDir, 'qa-report.json');
    const qaReport = fs.existsSync(qaFile) ? JSON.parse(fs.readFileSync(qaFile, 'utf8')) : null;
    const html     = buildHtml(run, results, qaReport, runDir);
    const out      = path.join(runDir, 'report.pdf');

    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        await page.pdf({
            path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate: `<div style="font-size:8px;color:#8a94a3;width:100%;padding:0 12mm;display:flex;justify-content:space-between">
              <span>SUNTEK AI QC · ${esc(run.label)}</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
            margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
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
    buildPdf(run, path.join(RUNS_DIR, id)).then(p => console.log(`PDF: ${p}`), e => { console.error(e); process.exit(1); });
}
