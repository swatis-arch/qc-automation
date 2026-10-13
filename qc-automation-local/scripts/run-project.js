/**
 * scripts/run-project.js — cross-platform wrapper for merchant-scoped
 * Playwright project flags.
 *
 * Project names in playwright.config.js are auto-generated per active
 * merchant: `${merchant.slug}-desktop-chromium` / `${merchant.slug}-mobile-chrome`.
 * A plain npm script can't hardcode the right name (it depends on MERCHANT),
 * and reading env vars portably across cmd.exe / PowerShell / bash inside a
 * package.json script string isn't reliable -- so this resolves MERCHANT
 * (default: the first active merchant) here in Node and builds the real project name before
 * shelling out to `playwright test`.
 *
 * Usage: node scripts/run-project.js <desktop|mobile> [...extra playwright args]
 */

const { spawnSync } = require('child_process');
require('dotenv').config();

const SUFFIX_MAP = {
    desktop: 'desktop-chromium',
    mobile:  'mobile-chrome',
};

const suffix = process.argv[2];
const extra  = process.argv.slice(3);

if (!SUFFIX_MAP[suffix]) {
    console.error('Usage: node scripts/run-project.js <desktop|mobile> [...playwright args]');
    process.exit(1);
}

const { ACTIVE_MERCHANTS } = require('../merchants/index');
const merchant    = process.env.MERCHANT || ACTIVE_MERCHANTS[0];
const projectName = `${merchant}-${SUFFIX_MAP[suffix]}`;

console.log(`$ npx playwright test --project=${projectName} ${extra.join(' ')}`);

const result = spawnSync(
    'npx',
    ['playwright', 'test', `--project=${projectName}`, ...extra],
    { stdio: 'inherit', shell: true }
);

process.exit(result.status ?? 1);
