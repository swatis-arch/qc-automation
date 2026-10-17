// spec: specs/revitin-buy-box.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    ACTIVE, expectAddLabel, familyCard, flavorChip, mainButton, oneTimeCard, pdpPath, travelButton, travelPackLabel,
    travelPackPrice, trioCard,
} from './helpers';
import {
    cardFrequency, cardPrice, cardStruck, dollars, expectAddPrice, expectOnlyActivePack, oneTimeContainer, oneTimePack,
    readSubscriptionCard, readVarietyOffer, varietyButton, varietyMix, varietyOneTimeBox, varietyOneTimeRow,
    varietySubscribeBox,
} from './pack-helpers';
import type { OneTimePack } from './pack-helpers';
import {
    SUBSCRIBE_NUDGE_TRIO, addAndWaitForDrawer, cartBadge, drawerSubtotal, expectCartLines, openPdpEmpty, planNameDiscount,
    readDrawer, readUpsells,
} from './cart-helpers';

const note = (type: string, description: string) => test.info().annotations.push({ type, description });

test.describe('Revitin buy box — 3. Cart accuracy', () => {
    test('Citrus Trio subscription (default) lands correctly', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(120_000);

        // 1. On /Citrus click the main add button once and wait for the drawer; read /cart.js.
        await openPdpEmpty(page, pdpPath(merchant, 'Citrus'));
        await expect(flavorChip(page, 'Citrus')).toHaveClass(ACTIVE);
        await expectOnlyActivePack(page, /^Trio/);
        await expectAddLabel(mainButton(page), '$42');
        const pdpTrio = await readSubscriptionCard(trioCard(page));
        expect(pdpTrio).toEqual({ price: 42, struck: 51, saving: 18 });

        await addAndWaitForDrawer(page, mainButton(page));
        await expectCartLines(page, [{
            title: 'Revitin Toothpaste (3 Tubes) - Citrus', sku: 'CITRUS3', variantId: 45594633666698, quantity: 1,
            linePrice: 4200, plan: 'Delivery every 3 months', planId: 2436071562,
        }]);

        // Drawer: Subscription, Pack: 3 Tubes, Flavor: Citrus, $42, Subtotal $42, header badge 1.
        const [line] = await readDrawer(page);
        expect(line.kind).toBe('Subscription');
        expect(line.title).toBe('Revitin Natural Toothpaste');
        expect(line.pack).toBe('Pack: 3 Tubes');
        expect(line.flavor).toBe('Flavor: Citrus');
        expect(line.price).toBe(42);
        expect(await drawerSubtotal(page)).toBe(42);
        await expect(cartBadge(page, 1)).toBeVisible();
        // The drawer should state the delivery frequency ('Delivered every 3 months').
        expect.soft(line.text, 'drawer shows the chosen frequency for the Trio line').toContain('Delivered every 3 months');
        // O2: drawer struck price must equal the PDP struck price ($51).
        expect.soft(line.struck, `O2: PDP struck price is $${pdpTrio.struck}, drawer struck price is $${line.struck}`)
            .toBe(pdpTrio.struck);
        note('record', `Trio drawer line: ${line.text}`);
    });

    test('Mint Family pack with a monthly plan', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(120_000);

        // 1. On /Mint choose the Family card, set its combobox to 'month', verify '$68 — Add to Bag', add to bag.
        await openPdpEmpty(page, pdpPath(merchant, 'Mint'));
        await expect(flavorChip(page, 'Mint')).toHaveClass(ACTIVE);
        const pdpFamily = await readSubscriptionCard(familyCard(page));
        expect(pdpFamily).toEqual({ price: 68, struck: 85, saving: 20 });

        await familyCard(page).click();
        await expectOnlyActivePack(page, /^Family pack/);
        await familyCard(page).getByRole('combobox').selectOption('1-month');
        await expect(cardFrequency(familyCard(page))).toHaveText('month');
        await expectAddLabel(mainButton(page), '$68');

        await addAndWaitForDrawer(page, mainButton(page));
        const [cartLine] = await expectCartLines(page, [{
            title: 'Revitin Toothpaste (5 Tubes) - Mint', sku: 'MINT5', variantId: 45618689310858, quantity: 1,
            linePrice: 6800, plan: /^Delivery every 1 month\b/,
        }]);

        // Drawer: Pack: 5 Tubes, Flavor: Mint, Delivered every month, Subtotal $68.
        const [line] = await readDrawer(page);
        expect(line.kind).toBe('Subscription');
        expect(line.pack).toBe('Pack: 5 Tubes');
        expect(line.flavor).toBe('Flavor: Mint');
        expect(line.price).toBe(68);
        expect(line.text).toContain('Delivered every month');
        expect(await drawerSubtotal(page)).toBe(68);
        await expect(cartBadge(page, 1)).toBeVisible();

        // O3: the plan's discount must match the 20% the PDP promises.
        const planPct = planNameDiscount(cartLine.planName);
        note('record', `Family monthly plan: "${cartLine.planName}" (id ${cartLine.planId}); PDP promises Save ${pdpFamily.saving}%`);
        if (planPct !== null) {
            expect.soft(planPct, `O3: plan name says ${planPct}% but the PDP promises ${pdpFamily.saving}%`)
                .toBeCloseTo(pdpFamily.saving, 0);
        }
        // O2: drawer struck price must equal the PDP struck price ($85).
        expect.soft(line.struck, `O2: PDP struck price is $${pdpFamily.struck}, drawer struck price is $${line.struck}`)
            .toBe(pdpFamily.struck);
    });

    test('One-time packs map to the right variants and prices', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(300_000);

        const cases: { flavor: 'Mint' | 'Citrus'; pack: OneTimePack; packText: string; title: string; sku: string; variantId: number; price: number; struck: number | null }[] = [
            { flavor: 'Mint', pack: '3 Tubes', packText: 'Pack: 3 Tubes', title: 'Revitin Toothpaste (3 Tubes) - Mint', sku: 'MINT3', variantId: 45618606080138, price: 46, struck: 51 },
            { flavor: 'Mint', pack: '5 Tubes', packText: 'Pack: 5 Tubes', title: 'Revitin Toothpaste (5 Tubes) - Mint', sku: 'MINT5', variantId: 45618689310858, price: 70, struck: 85 },
            { flavor: 'Mint', pack: '25 Tubes', packText: 'Pack: 25 Tubes', title: 'Revitin Toothpaste (25 Tubes) - Mint', sku: 'MINT25', variantId: 45622715121802, price: 350, struck: 425 },
            { flavor: 'Citrus', pack: 'Single Tube', packText: 'Pack: Single Tube', title: 'Revitin Toothpaste Single Tube - Citrus', sku: 'CITRUS1', variantId: 45594631471242, price: 17, struck: null },
        ];

        for (const c of cases) {
            const label = `${c.flavor} ${c.pack}`;

            // 1. Select One-Time then the pack, add to cart (one add per page load, cart emptied between loads).
            await openPdpEmpty(page, pdpPath(merchant, c.flavor));
            await oneTimeCard(page).click();
            await oneTimePack(page, c.pack).click();
            await expectOnlyActivePack(page, new RegExp(`^${c.pack}`));
            await expect(oneTimeContainer(page).locator('.one_time_price'), `${label} PDP price`).toHaveText(`$${c.price}`);
            const pdpStruck = c.struck === null ? null : dollars(await oneTimeContainer(page).locator('.one_time_before').innerText());
            expect(pdpStruck, `${label} PDP struck price`).toBe(c.struck);
            await expectAddPrice(mainButton(page), `$${c.price}`);

            await addAndWaitForDrawer(page, mainButton(page));
            await expectCartLines(page, [{
                title: c.title, sku: c.sku, variantId: c.variantId, quantity: 1, linePrice: c.price * 100, plan: null,
            }]);

            // Drawer: One-Time Purchase, pack, flavor, struck / price, subtotal.
            const [line] = await readDrawer(page);
            expect(line.kind, `${label} drawer kind`).toBe('One-Time Purchase');
            expect(line.title, `${label} drawer title`).toBe('Revitin Natural Toothpaste');
            expect(line.pack, `${label} drawer pack`).toBe(c.packText);
            expect(line.flavor, `${label} drawer flavor`).toBe(`Flavor: ${c.flavor}`);
            expect(line.price, `${label} drawer price`).toBe(c.price);
            expect(line.struck, `${label} drawer struck price equals the PDP struck price`).toBe(c.struck);
            expect(await drawerSubtotal(page), `${label} drawer subtotal`).toBe(c.price);
            await expect(cartBadge(page, 1)).toBeVisible();
            expect(line.text, `${label} one-time line is not labelled as a subscription`).not.toContain('Delivered every');

            // Subscribe nudge: Mint 3 Tubes must offer 'Pay $42 for 3 tubes — just $14 each'; the others are recorded.
            if (c.pack === '3 Tubes') expect(line.text).toMatch(SUBSCRIBE_NUDGE_TRIO);
            else note('record', `${label} drawer nudge: ${/Subscribe & Save/.test(line.text) ? line.text : 'none'}`);
        }
    });

    test('Variety mixes: each mix and purchase type gives the right variant', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(240_000);

        const cases = [
            { mode: 'subs', mix: '2 Citrus & 1 Mint', click: false, title: 'Revitin Toothpaste Variety 3 Tubes - Citrus', sku: 'VARIETYPACK2C-1M', variantId: 46765298909322, price: 42 },
            { mode: 'subs', mix: '2 Mint & 1 Citrus', click: true, title: 'Revitin Toothpaste Variety 3 Tubes - Mint', sku: 'VARIETYPACK2M-1C', variantId: 46765283049610, price: 42 },
            { mode: 'once', mix: '2 Citrus & 1 Mint', click: false, title: 'Revitin Toothpaste Variety 3 Tubes - Citrus', sku: 'VARIETYPACK2C-1M', variantId: 46765298909322, price: 46 },
        ] as const;

        for (const c of cases) {
            const label = `Variety ${c.mode === 'subs' ? 'Subscribe & Save' : 'One-time'} ${c.mix}`;

            // 1-2. On ?pack=variety pick the purchase type and mix, add with the Variety box's own button.
            await openPdpEmpty(page, `${pdpPath(merchant)}?pack=variety`, varietyButton);
            const subOffer = await readVarietyOffer(varietySubscribeBox(page));
            const onceOffer = await readVarietyOffer(varietyOneTimeBox(page));
            if (c.mode === 'once') {
                await varietyOneTimeRow(page).click();
                await expect(varietyOneTimeBox(page).locator('input')).toBeChecked();
            }
            if (c.click) await varietyMix(page, c.mode, c.mix).click();
            await expect(varietyMix(page, c.mode, c.mix), `${label}: mix is selected`).toHaveClass(ACTIVE);

            await addAndWaitForDrawer(page, varietyButton(page));
            const [cartLine] = await expectCartLines(page, [{
                title: c.title, sku: c.sku, variantId: c.variantId, quantity: 1, linePrice: c.price * 100,
                plan: c.mode === 'subs' ? 'Delivery every 3 months' : null,
            }]);

            // O8: the variant title does not name the mix, so the SKU must identify it (asserted above); record the title.
            note('record', `O8 ${label}: variant title "${cartLine.title}", sku ${cartLine.sku}`);

            // Drawer: the mix is the line title; Pack: 3 Tubes; Flavor: Variety.
            const [line] = await readDrawer(page);
            expect(line.kind, `${label} drawer kind`).toBe(c.mode === 'subs' ? 'Subscription' : 'One-Time Purchase');
            expect(line.title, `${label} drawer shows the chosen mix`).toBe(c.mix);
            expect(line.pack).toBe('Pack: 3 Tubes');
            expect(line.flavor).toBe('Flavor: Variety');
            expect(line.price).toBe(c.price);
            expect(await drawerSubtotal(page)).toBe(c.price);
            await expect(cartBadge(page, 1)).toBeVisible();

            if (c.mode === 'subs') {
                expect(line.text, `${label} drawer shows the frequency`).toContain('Delivered every 3 months');
                // O2: drawer struck price must equal the PDP struck price ($51).
                expect.soft(line.struck, `O2: ${label} PDP struck price is $${subOffer.struck}, drawer struck price is $${line.struck}`)
                    .toBe(subOffer.struck);
            } else {
                expect(line.struck, `${label} drawer struck price equals the PDP struck price`).toBe(onceOffer.struck);
                expect(line.text).toMatch(/Pay \$42 for 3 tubes/);
                expect(line.text).toContain('Subscribe & Save');
            }
        }
    });

    test('Travel size lines (Citrus, Mint, Variety)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(240_000);

        const cases = [
            {
                name: 'Citrus', path: `${pdpPath(merchant, 'Citrus')}?size=travel`, packLabel: 'Citrus 3-pack', price: 18,
                title: 'Citrus Travel 3-Pack of 1oz - Citrus', sku: 'CitrTravel3-pk', variantId: 46346187341962,
                drawerTitle: 'Citrus Travel 3-Pack of 1oz', pack: 'Pack: Citrus Travel 3-Pack of 1oz', flavor: 'Flavor: Citrus',
                nudge: /Pay only \$42 for 3 full size tubes\./, upsell: /Citrus Full Size.*\$17/,
            },
            {
                name: 'Mint', path: `${pdpPath(merchant, 'Mint')}?size=travel`, packLabel: 'Mint 3-pack', price: 18,
                title: 'Mint Travel 3-Pack of 1oz - Mint', sku: 'MintTravel3-pk', variantId: 46346189045898,
                drawerTitle: 'Mint Travel 3-Pack of 1oz', pack: 'Pack: Mint Travel 3-Pack of 1oz', flavor: 'Flavor: Mint',
                nudge: /Pay only \$42 for 3 full size tubes\./, upsell: /Mint Full Size.*\$17/,
            },
            {
                name: 'Variety', path: `${pdpPath(merchant, 'Mint')}?size=travel&pack=variety`, packLabel: '2 Mint & 2 Citrus', price: 24,
                title: 'Variety Travel 4-Pack of 1 oz', sku: 'VarietyTravel4-pk', variantId: 47799599759498,
                drawerTitle: 'Variety Travel 4-Pack of 1 oz', pack: 'Pack: Travel 4-Pack of 1 oz', flavor: 'Flavor: Variety',
                nudge: /Pay only \$42 for full size variety pack\./, upsell: /Variety 2 Mint 1 Citrus/,
            },
        ];

        for (const c of cases) {
            // 1. Open the travel URL, add to bag (one add per page load, cart emptied between loads).
            await openPdpEmpty(page, c.path);
            await expect(travelPackLabel(page), `${c.name} travel pack`).toHaveText(c.packLabel);
            await expect(travelPackPrice(page)).toHaveText(`$${c.price}`);
            await expectAddLabel(travelButton(page), `$${c.price}`);

            await addAndWaitForDrawer(page, travelButton(page));
            await expectCartLines(page, [{
                title: c.title, sku: c.sku, variantId: c.variantId, quantity: 1, linePrice: c.price * 100, plan: null,
            }]);

            // Drawer: one-time line (no selling plan), pack and flavor match the chip chosen, full-size nudge / upsell.
            const [line] = await readDrawer(page);
            expect(line.kind, `${c.name} drawer kind`).toBe('One-Time Purchase');
            expect(line.title, `${c.name} drawer title`).toBe(c.drawerTitle);
            expect(line.pack, `${c.name} drawer pack`).toBe(c.pack);
            expect(line.flavor, `${c.name} drawer flavor`).toBe(c.flavor);
            expect(line.price).toBe(c.price);
            expect(line.struck, `${c.name} travel line has no struck price`).toBeNull();
            expect(await drawerSubtotal(page)).toBe(c.price);
            expect(line.text).not.toContain('Delivered every');
            expect(line.text).toMatch(c.nudge);
            await expect(cartBadge(page, 1)).toBeVisible();

            const upsells = (await readUpsells(page)).join(' || ');
            note('record', `${c.name} travel drawer upsell: ${upsells || 'none'}`);
            expect(upsells, `${c.name} travel drawer upsell`).toMatch(c.upsell);
        }
    });

    test('Delivery frequency plan IDs per pack, and PDP vs drawer price maths', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(420_000);

        // 1. Trio on /Citrus: each frequency on its own page load; ids / names / price.
        const trioPlans = [
            { value: '1-month', label: 'month', name: 'Delivery every 1 month', id: 2436038794 },
            { value: '2-months', label: '2 months', name: 'Delivery every 2 months', id: 2435973258 },
            { value: '6-months', label: '6 months', name: 'Delivery every 6 months', id: 2436006026 },
        ];
        let pdpTrio = { price: 0, struck: 0, saving: 0 };
        let pdpFamily = { price: 0, struck: 0, saving: 0 };
        let trioDrawerStruck: number | null = null;
        let trioDrawerText = '';

        for (const p of trioPlans) {
            await openPdpEmpty(page, pdpPath(merchant, 'Citrus'));
            pdpTrio = await readSubscriptionCard(trioCard(page));
            pdpFamily = await readSubscriptionCard(familyCard(page));
            await trioCard(page).getByRole('combobox').selectOption(p.value);
            await expect(cardFrequency(trioCard(page))).toHaveText(p.label);
            await expectOnlyActivePack(page, /^Trio/);
            await expectAddLabel(mainButton(page), '$42');

            await addAndWaitForDrawer(page, mainButton(page));
            await expectCartLines(page, [{
                title: 'Revitin Toothpaste (3 Tubes) - Citrus', sku: 'CITRUS3', variantId: 45594633666698, quantity: 1,
                linePrice: 4200, plan: p.name, planId: p.id,
            }]);
            const [line] = await readDrawer(page);
            expect(line.kind).toBe('Subscription');
            expect(line.price, `Trio ${p.label}: price does not depend on frequency`).toBe(42);
            expect(await drawerSubtotal(page)).toBe(42);
            expect.soft(line.text, `Trio ${p.label}: drawer shows the matching frequency`).toContain(`Delivered every ${p.label}`);
            if (p.value === '1-month') {
                trioDrawerStruck = line.struck;
                trioDrawerText = line.text;
            }
        }

        // 1b. Family on /Mint: 2, 3 and 6 months (1 month is scenario 3.2); names must carry the chosen frequency.
        const familyPlans = [
            { value: '2-months', label: '2 months' },
            { value: '3-months', label: '3 months' },
            { value: '6-months', label: '6 months' },
        ];
        let familyDrawerStruck: number | null = null;
        for (const p of familyPlans) {
            await openPdpEmpty(page, pdpPath(merchant, 'Mint'));
            await familyCard(page).click();
            await expectOnlyActivePack(page, /^Family pack/);
            await familyCard(page).getByRole('combobox').selectOption(p.value);
            await expect(cardFrequency(familyCard(page))).toHaveText(p.label);
            await expectAddLabel(mainButton(page), '$68');

            await addAndWaitForDrawer(page, mainButton(page));
            const [cartLine] = await expectCartLines(page, [{
                title: 'Revitin Toothpaste (5 Tubes) - Mint', sku: 'MINT5', variantId: 45618689310858, quantity: 1,
                linePrice: 6800, plan: new RegExp(`^Delivery every ${p.label}\\b`),
            }]);
            const [line] = await readDrawer(page);
            expect(line.price, `Family ${p.label}: price does not depend on frequency`).toBe(68);
            expect(line.text).toContain(`Delivered every ${p.label}`);
            note('record', `Family ${p.label}: plan "${cartLine.planName}" (id ${cartLine.planId})`);
            // O3: the plan's discount must match the 20% the PDP promises.
            const planPct = planNameDiscount(cartLine.planName);
            if (planPct !== null) {
                expect.soft(planPct, `O3: Family ${p.label} plan name says ${planPct}% but the PDP promises ${pdpFamily.saving}%`)
                    .toBeCloseTo(pdpFamily.saving, 0);
            }
            if (p.value === '2-months') familyDrawerStruck = line.struck;
        }

        // 2. PDP struck vs drawer struck for Trio and Family subscription carts.
        // O2: drawer struck price must equal the PDP struck price ($51 Trio, $85 Family).
        expect.soft(trioDrawerStruck, `O2: Trio PDP struck $${pdpTrio.struck} vs drawer struck $${trioDrawerStruck}`).toBe(pdpTrio.struck);
        expect.soft(familyDrawerStruck, `O2: Family PDP struck $${pdpFamily.struck} vs drawer struck $${familyDrawerStruck}`).toBe(pdpFamily.struck);

        // Drawer 'just $13.60 per tube' (Trio cart upgrade nudge) equals the Family price over 5 tubes.
        expect(trioDrawerText).toContain(`just $${(pdpFamily.price / 5).toFixed(2)} per tube`);

        // One-time 3 Tubes cart: the subscribe nudge 'Pay $42 for 3 tubes — just $14 each' equals the Trio price over 3.
        await openPdpEmpty(page, pdpPath(merchant, 'Mint'));
        const trioPrice = await cardPrice(trioCard(page)).innerText().then(dollars);
        expect(trioPrice).toBe(42);
        await oneTimeCard(page).click();
        await oneTimePack(page, '3 Tubes').click();
        await expectAddPrice(mainButton(page), '$46');
        await addAndWaitForDrawer(page, mainButton(page));
        const [oneTime] = await readDrawer(page);
        expect(oneTime.text).toMatch(new RegExp(`Pay \\$${trioPrice} for 3 tubes\\s*—\\s*just \\$${trioPrice / 3} each`));
        expect(trioPrice / 3).toBe(14);
        expect(Number((pdpFamily.price / 5).toFixed(2))).toBe(13.6);
        expect(oneTime.struck, 'one-time 3 Tubes drawer struck price equals the PDP struck price').toBe(pdpTrio.struck);
        expect(await cardStruck(trioCard(page)).innerText().then(dollars)).toBe(pdpTrio.struck);
    });
});
