/**
 * tests/magnitude/pdp-variant.mag.ts — Magnitude AI trial (PDP variant)
 *
 * Trial only: the AI finds, clicks or reads; the PASS/FAIL decision is a plain assertion
 * against the existing page object or the network (CLAUDE.md: the AI does not decide the
 * result). One test per file: the Magnitude runner (0.3.13) reuses a closed browser for the
 * second test in a file and fails it with "browser has been closed".
 */

import { test } from 'magnitude-test';
import { merchant, productUrl, openProduct } from './merchant';

test(`MAG02 — AI can select a different variant [${merchant.slug}]`, { url: productUrl }, async (agent) => {
    const pdp = await openProduct(agent);
    if (await pdp.variantOptions.count() < 2) {
        // The Magnitude runner has no skip; this shows as passed, so say why nothing was checked.
        console.log(`[MAG02] SKIPPED — ${merchant.name}'s default product has a single variant`);
        return;
    }

    const urlBefore = agent.page.url();
    await agent.act('Select one product variant option (size, flavour or pack) that is not currently selected');

    await agent.page.waitForURL(url => url.toString() !== urlBefore, { timeout: 10_000 });
});
