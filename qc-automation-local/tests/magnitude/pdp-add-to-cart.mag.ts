/**
 * tests/magnitude/pdp-add-to-cart.mag.ts — Magnitude AI trial (PDP add to cart)
 *
 * Trial only: the AI finds, clicks or reads; the PASS/FAIL decision is a plain assertion
 * against the existing page object or the network (CLAUDE.md: the AI does not decide the
 * result). One test per file: the Magnitude runner (0.3.13) reuses a closed browser for the
 * second test in a file and fails it with "browser has been closed".
 */

import assert from 'node:assert/strict';
import { test } from 'magnitude-test';
import { merchant, productUrl, openProduct } from './merchant';

// Stops at add-to-cart. No checkout, no order.
test(`MAG03 — AI clicks the main Add to cart and the cart API accepts it [${merchant.slug}]`, { url: productUrl }, async (agent) => {
    await openProduct(agent);

    // Generous timeout: the clock starts before the AI has looked at the page.
    const cartAdd = agent.page.waitForResponse(
        r => r.url().includes('/cart/add') && r.request().method() === 'POST',
        { timeout: 120_000 }
    );
    cartAdd.catch(() => {});   // reported by the await below, not as an unhandled rejection

    await agent.act('Click the main Add to cart button next to the product details (not a sticky bar at the top or bottom). Do not go to checkout.');

    const response = await cartAdd;
    assert.equal(response.status(), 200);
});
