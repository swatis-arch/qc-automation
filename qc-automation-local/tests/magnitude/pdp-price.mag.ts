/**
 * tests/magnitude/pdp-price.mag.ts — Magnitude AI trial (PDP price)
 *
 * Trial only: the AI finds, clicks or reads; the PASS/FAIL decision is a plain assertion
 * against the existing page object or the network (CLAUDE.md: the AI does not decide the
 * result). One test per file: the Magnitude runner (0.3.13) reuses a closed browser for the
 * second test in a file and fails it with "browser has been closed".
 */

import assert from 'node:assert/strict';
import { test } from 'magnitude-test';
import { z } from 'zod';
import { merchant, productUrl, openProduct } from './merchant';

const { parseMoney } = require('../../utils/page-checks');

test(`MAG01 — AI-read price matches the page-object price [${merchant.slug}]`, { url: productUrl }, async (agent) => {
    const pdp = await openProduct(agent);

    const aiPrice  = await agent.extract('the current selling price of the main product, as a number without currency symbol', z.number());
    const domPrice = parseMoney(await pdp.getPrice());

    assert.ok(Math.abs(aiPrice - domPrice) < 0.005, `AI read ${aiPrice}, page object read ${domPrice}`);
});
