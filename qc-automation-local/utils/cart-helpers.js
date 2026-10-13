/**
 * utils/cart-helpers.js — Cart setup and parsing shared by cart.spec.js and checkout.spec.js
 */

const { test } = require('../fixtures/base');

/** Shopify cart JSON amounts are in cents. */
const money = cents => cents / 100;

/**
 * Put the merchant's default product (and optionally its secondary one) in the cart.
 * Skips the test when a product is sold out — that's test data, not a cart bug.
 * @returns {Promise<{ product: object, variant: object }[]>} what went in, in that order
 */
async function seedProducts(cart, merchant, { quantity = 1, both = false } = {}) {
    const picks = [];
    for (const which of both ? ['default', 'secondary'] : ['default']) {
        const { product, variants } = await cart.availableVariants(merchant.products[which].handle);
        test.skip(variants.length === 0, `${product.title} is sold out`);
        picks.push({ product, variant: variants[0] });
    }
    await cart.seed(picks.map(pick => ({ id: pick.variant.id, quantity })));
    return picks;
}

/** Free-shipping progress read from the drawer text: { remaining, threshold, qualified }. */
function freeShippingState(text) {
    const plain = text.replace(/,/g, '');
    const remaining = plain.match(/[$£€]\s?(\d+(?:\.\d+)?)\s*(?:away|left|more)/i);
    const threshold = plain.match(/(?:toward|over|above|orders? of)\s*[$£€]\s?(\d+(?:\.\d+)?)|free (?:shipping|delivery)\s*[$£€]\s?(\d+(?:\.\d+)?)/i);
    return {
        remaining: remaining ? parseFloat(remaining[1]) : null,
        threshold: threshold ? parseFloat(threshold[1] || threshold[2]) : null,
        qualified: /(unlocked|qualif\w+ for free|enjoy free (shipping|delivery)|you('ve| have)( got| earned)? free|free (shipping|delivery) (unlocked|applied))/i.test(text),
    };
}

module.exports = { money, seedProducts, freeShippingState };
