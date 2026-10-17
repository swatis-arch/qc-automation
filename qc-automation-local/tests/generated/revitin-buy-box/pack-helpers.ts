// Helpers for the Revitin pack / price-maths specs (spec: specs/revitin-buy-box.md, suite 2).
// Kept next to helpers.ts (which is shared with suite 1 and is not changed).
import { expect } from '../../../fixtures/base';
import type { Locator, Page } from '@playwright/test';

// ---- Number parsing -------------------------------------------------------------------------------------------

/** "$1,350" -> 1350. Throws when the text has no price so a missing element fails loudly. */
export function dollars(text: string): number {
    const m = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    if (!m) throw new Error(`No price found in "${text}"`);
    return Number(m[1].replace(/,/g, ''));
}

/** "Save 18%" -> 18. */
export function savePercent(text: string): number {
    const m = text.match(/Save\s+(\d+)\s*%/i);
    if (!m) throw new Error(`No "Save N%" found in "${text}"`);
    return Number(m[1]);
}

/** Percentage off computed from the two displayed prices, e.g. (51, 42) -> 17.647... */
export const percentOff = (struck: number, price: number) => (100 * (struck - price)) / struck;

/**
 * The displayed "Save N%" must equal the saving implied by the displayed prices, rounded, within one point
 * (the plan allows +/-1 for rounding). The failure message prints all three numbers.
 */
export function expectSavingMatches(label: string, price: number, struck: number, shown: number) {
    const implied = percentOff(struck, price);
    expect(
        Math.abs(shown - Math.round(implied)),
        `${label}: shows Save ${shown}% but $${price} vs $${struck} is ${implied.toFixed(2)}% off`,
    ).toBeLessThanOrEqual(1);
}

// ---- Active state ---------------------------------------------------------------------------------------------

/** First line of every visible pack control (subscription card or one-time pack) that carries class `active`. */
export function activePacks(page: Page): Promise<string[]> {
    return page.locator('button.variant-price-btn').evaluateAll(els =>
        els.filter(e => (e as HTMLElement).offsetWidth > 0 && /\bactive\b/.test(e.className))
            .map(e => (e as HTMLElement).innerText.trim().split('\n')[0].trim()));
}

/** Exactly one pack control is active overall, and its name matches. */
export async function expectOnlyActivePack(page: Page, name: RegExp) {
    await expect.poll(() => activePacks(page), { message: `only one active pack, matching ${name}` })
        .toEqual([expect.stringMatching(name)]);
}

// ---- Locators -------------------------------------------------------------------------------------------------

export type OneTimePack = 'Single Tube' | '3 Tubes' | '5 Tubes' | '25 Tubes';
/** One-time pack buttons. Anchored: /5 Tubes/ alone would also match "Family pack - 5 tubes" and "25 Tubes". */
export const oneTimePack = (page: Page, pack: OneTimePack) => page.getByRole('button', { name: new RegExp(`^${pack}`) });

/** The visible One-Time card (price / struck price / saving of the selected one-time pack live inside it). */
export const oneTimeContainer = (page: Page) => page.locator('.one_time_container').filter({ visible: true });

// Subscription card parts
export const cardPrice = (card: Locator) => card.locator('.subscription_original');
export const cardStruck = (card: Locator) => card.locator('.line-through');
export const cardSaving = (card: Locator) => card.locator('.save__amount');
export const cardFrequency = (card: Locator) => card.getByRole('combobox').locator('option:checked');

/** Price, struck price and saving as displayed on a subscription card. */
export async function readSubscriptionCard(card: Locator) {
    return {
        price: dollars(await cardPrice(card).innerText()),
        struck: dollars(await cardStruck(card).innerText()),
        saving: savePercent(await cardSaving(card).innerText()),
    };
}

// ---- Add button -----------------------------------------------------------------------------------------------

/**
 * Assert an add button reads "$<price> — Add to Bag|Cart" and return which wording is shown. The wording is
 * inconsistent on this theme (O4: 'Add to Bag' for subscriptions, 'Add to Cart' once a one-time pack is clicked),
 * so callers that are not about the wording use this and log what they got. Uses innerText: the button also holds
 * a display:none span whose textContent is '$42' or 'undefined'.
 */
export async function expectAddPrice(button: Locator, price: string): Promise<'Bag' | 'Cart'> {
    await expect.poll(() => button.innerText()).toMatch(new RegExp(`^\\s*\\${price}\\s*—\\s*Add to (Bag|Cart)\\s*$`));
    return /Add to Cart/.test(await button.innerText()) ? 'Cart' : 'Bag';
}

// ---- Variety box ----------------------------------------------------------------------------------------------

export const varietySubscribeBox = (page: Page) => page.locator('#variety-subscribeBox');
export const varietyOneTimeBox = (page: Page) => page.locator('#variety-oneTimeBox');
/** Clicking the radio row (not the label centre, which would land on a mix button). */
export const varietySubscribeRow = (page: Page) => page.locator('#variety-subscribeBox .variety-radio-group');
export const varietyOneTimeRow = (page: Page) => page.locator('#variety-oneTimeBox .variety-radio-group');
export const varietyMixes = (page: Page, mode: 'subs' | 'once') => page.locator(`#variety-${mode === 'subs' ? 'subscribeFlavors' : 'oneTimeFlavors'} .variety-qty`);
export const varietyMix = (page: Page, mode: 'subs' | 'once', name: '2 Citrus & 1 Mint' | '2 Mint & 1 Citrus') =>
    varietyMixes(page, mode).filter({ hasText: name });
/** The Variety box has its own add button (no price in the label, no main__atc__button class). */
export const varietyButton = (page: Page) => page.locator('#variety-add-to-cart');

/** "$42$51" -> { price: 42, struck: 51 } for a Variety purchase-type box. */
export async function readVarietyOffer(box: Locator) {
    const text = (await box.locator('.variety-price').innerText()).replace(/\s+/g, '');
    const m = text.match(/^\$([\d,.]+)\$([\d,.]+)$/);
    if (!m) throw new Error(`Unexpected Variety price text "${text}"`);
    return {
        price: Number(m[1].replace(/,/g, '')),
        struck: Number(m[2].replace(/,/g, '')),
        saving: savePercent(await box.locator('.variety-save-tag').innerText()),
    };
}
