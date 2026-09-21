/**
 * scripts/run-suite.js — run a test tier or a single module.
 *
 * Usage:
 *   node scripts/run-suite.js <smoke|regression|full|<module>> [desktop|mobile|all] [...playwright args]
 *   node scripts/run-suite.js --list
 *
 * Watch mode (add --watch): headed browser, slowed actions, a visible cursor + click
 * ripples, and an on-page banner naming the test running. WATCH_SLOWMO=ms (default 350).
 *
 * Examples:
 *   node scripts/run-suite.js regression            # daily tier, desktop + mobile
 *   node scripts/run-suite.js pdp desktop           # only tests/pdp.spec.js, desktop
 *   node scripts/run-suite.js full all --list       # show what would run
 *
 * Merchants: honours MERCHANT (blank = every ACTIVE merchant), exactly like
 * `npx playwright test`. Unlike run-project.js there is no 'outset' default.
 * Tiers and modules are defined in utils/tiers.js.
 */

const { spawnSync } = require('child_process');
require('dotenv').config();
const { MODULES, TIERS } = require('../utils/tiers');

const PROJECT_GLOB = {
    desktop: '*-desktop-chromium',
    mobile:  '*-mobile-chrome',
};
const VIEWPORTS = [...Object.keys(PROJECT_GLOB), 'all'];

function printList() {
    console.log('Tiers:');
    for (const [name, t] of Object.entries(TIERS)) console.log(`  ${name.padEnd(11)} ${t.description}`);
    console.log('\nModules:');
    for (const [name, m] of Object.entries(MODULES)) console.log(`  ${name.padEnd(11)} ${m.description}`);
}

const [name, ...rest] = process.argv.slice(2);

if (!name || name === '--list') {
    printList();
    process.exit(name ? 0 : 1);
}

const tier   = TIERS[name];
const mod    = MODULES[name];
if (!tier && !mod) {
    console.error(`Unknown tier/module "${name}".\n`);
    printList();
    process.exit(1);
}

const viewport = VIEWPORTS.includes(rest[0]) ? rest.shift() : (tier ? tier.defaultViewport : 'all');
const watch    = rest.includes('--watch');
const extra    = rest.filter(a => a !== '--watch');
if (watch) {
    process.env.QC_WATCH = 'true';
    process.env.WATCH_SLOWMO = process.env.WATCH_SLOWMO || '350';
    if (!extra.includes('--headed')) extra.push('--headed');
    if (!extra.some(a => a.startsWith('--retries'))) extra.push('--retries=0');
}
const target   = tier ? tier.args : [mod.file];
const project  = viewport === 'all' ? [] : [`"--project=${PROJECT_GLOB[viewport]}"`];

// shell:true joins args into one string, so quote anything with spaces or a leading '@'.
const quote = a => (/\s|^@/.test(a) ? `"${a}"` : a);
const args  = ['playwright', 'test', ...project, ...[...target, ...extra].map(quote)];
console.log(`$ npx ${args.join(' ')}`);

const result = spawnSync('npx', args, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
