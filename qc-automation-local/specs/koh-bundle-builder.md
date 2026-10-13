# KOH Bundle Builder Test Plan

## Application Overview

Test plan for the Kreatures of Habit (KOH) bundle builder at https://kreaturesofhabit.com/pages/bundle-builder (Shopify theme with a custom "pfp" builder and the shadow-DOM cart drawer <ns-hybrid-cart>), plus the single-product builders on /products/meal-one-v2 and /products/daily-bar. Project: koh-desktop-chromium, seed: tests/seed.spec.ts.

GLOBAL RULES FOR EVERY SCENARIO
- Start from a fresh browser context (empty cart). If needed clear the cart with fetch('/cart/clear.js', {method:'POST'}) then reload. Each scenario is independent.
- NEVER place an order: stop at the Shopify checkout URL (/checkouts/cn/...). NEVER submit the Klaviyo/email/SMS popup, the footer newsletter form or any other form.
- Popups: on load a Klaviyo "Sitewide Popup - Finish the Year Strong" dialog ("Get your mornings back.", MORNINGS / 3PM / BOTH buttons, 'Close dialog' button) can appear and cover the page. Close it via the 'Close dialog' button (never click MORNINGS/3PM/BOTH). After closing, a small pink teaser tab ("Get your mornings back") stays in the bottom-left corner above the sticky bar; it can overlap the sticky bundle bar and may intercept clicks near the bottom-left. An offer popup may also appear. Always dismiss before interacting.
- Cart drawer: <ns-hybrid-cart> sits over the page when open (it intercepts pointer events on the builder, so close the drawer with the 'Close cart' button before touching builder controls). Use page.locator('ns-hybrid-cart').getByRole('button', {name: 'plus' | 'minus' | 'remove'}) (aria-labels are lower-case 'plus', 'minus', 'remove'); the free-gift REMOVE button is [data-koh-remove-gift]; the checkout control is a link named CHECKOUT pointing to /checkout. Verify cart contents through the drawer and, where noted, fetch('/cart.js').
- Builder selectors verified live: steppers are buttons with aria-label 'Increase <Flavour>' / 'Decrease <Flavour>' (classes pfp__stepper-plus / pfp__stepper-minus); purchase type toggles are buttons with aria-pressed ('Subscribe & Save', 'One-Time Purchase'); frequency is a combobox named 'Delivery frequency'; the main button is .pfp__atc (there are several .pfp__atc / .pfp-sticky__atc copies, some hidden for mobile; use the visible one, e.g. 'button.pfp__atc.is-enabled:visible').

VERIFIED PAGE FACTS (live, 2026-10-11)
- Heading 'BUNDLE & SAVE', 'MINIMUM 2 PRODUCTS', section '1. Add two boxes or more', section '2. Purchase Type'.
- Protein Bar group: Variety Pack, Blueberry Cream Cruncher, Peanut Butter Banger, Cookie Dough Dazzler (4 flavours). Meal One group: Maple Caramel, Apple Cinnamon, Strawberry Walnut Cream, Peanut Butter Banana, Chocolate, Vanilla, Blueberry Banana, Variety (8 flavours). Group headers show 'Starting From $39.99 (struck) $23.59'. All Decrease buttons start disabled at count 0.
- Purchase cards show the live total and box count: e.g. 'Subscribe & Save $79.98 $47.18 2 Boxes' and 'One-Time Purchase $79.98 2 Boxes'; with 0 boxes both show '$39.99 / $23.59 ... 0 Boxes'; with 1 box the text is the singular '1 Box'. Subscribe & Save lists: '41% off first order • 10% off recurring', 'Free Gift with your subscription', 'Free Shipping on 3+ Boxes', 'Pause, Skip, Or Cancel Anytime'. One-Time lists 'Free Shipping on 3+ Boxes'. Frequency options: 15, 30 (default), 45, 60 days.
- Main button text: 0 boxes 'PLEASE ADD 2 BOXES' (disabled); 1 box 'PLEASE ADD 1 BOX' (singular, disabled); 2+ boxes enabled 'ADD TO CART' (the visible desktop button) while a hidden variant reads 'ADD TO CART - $47.18'. A sticky bottom bar appears once boxes are chosen: 'Your Bundle (2)  Total: $47.18 (struck) $79.98  ADD TO CART'.
- Prices: $39.99 one-time per box; subscription $23.59 per box (41% off, 39.99 x 0.59 = 23.594). 2 boxes $47.18 / $79.98, 3 boxes $70.77 / $119.97. Cart line shows e.g. '$23.59 $39.99 $16.40 off'.
- Cart line plan text: 'Every 30 days' (cart.js selling plan name '30 days'; '15 days' when 15 selected). Subscription lines show a star rating and 'N Reviews'.
- Drawer header 'Your cart (N)' counts paid boxes only (gift not counted). Free-shipping bar: subscription 2 boxes -> 'Add 1 more to get free shipping!'; 1 box -> 'Add 2 more to get free shipping!'; 3 boxes -> 'Congratulations! You have free shipping!'. One-time carts use a PRICE-based message ('Only $39.02 left to get free shipping!' for $79.98, i.e. threshold $119) rather than a box count. Subtotal row shows '$X off' badge and the original price, e.g. '$32.80 off  $47.18'; 'Shipping + tax calculated at checkout'. One-time lines show only '$39.99' and a per-line 'Subscribe & Save 41%' button, and the subtotal has no discount badge.
- Drawer stepper: '-' at quantity 1 does NOT remove the line (stays 1); the trash icon (aria-label 'remove') removes the line.
- Free gift: gift row 'Your Free Gifts' -> 'Kreatures Glass Mug', 'with subscription', 'Unlocked!', FREE, REMOVE. OBSERVATION: in exploration the 'Pick a free gift, on us.' modal (.pfp-gift-modal, aria-hidden=true, opacity 0, with Add / Skip for now) was NOT visibly displayed when reaching 2 boxes or after clicking ADD TO CART, yet the mug row appeared in the drawer a moment later in two of the runs (and was still present after the quantity was reduced to 1 box) and did not appear in a third run (2 Meal One boxes, 3 after plus, no mug after waiting 5s+). Gift behaviour is therefore inconsistent and must be investigated, not assumed. See scenarios in the Free Gift suite.
- Checkout link goes to https://kreaturesofhabit.com/checkouts/cn/<token>/en-us (title 'Checkout - Kreatures of Habit').
- Product pages: /products/meal-one-v2 (8 flavour steppers) and /products/daily-bar (4 flavour steppers) show the same builder with H1 'MEAL ONE.' / 'THE DAILY BAR.'. Their purchase cards already display the default 2-box figures: Meal One 'Subscribe & Save $39.99 $23.59 2 BOXES • 14 meals $3.37/meal' and 'One-Time Purchase $39.99 2 BOXES • 14 meals $5.71/meal'; Daily Bar '2 BOXES • 24 bars $1.97/bar' and '$3.33/bar'. Button initially 'PLEASE ADD 2 BOXES'. Accordions: HOW TO PREPARE, WHAT'S INSIDE EACH BOX, REVIEWS & RATINGS, plus a product-specific FAQ. NOTE the bundle-builder page shows '0 Boxes' and no per-meal text, unlike the product pages.
- Bundle-builder accordions/sections: HOW TO PREPARE, WHAT'S INSIDE EACH BOX, REVIEWS & RATINGS (<summary>/<details> groups); 'NUTRITION & INGREDIENTS' button and a 'Box info' dialog (tabs Protein Bar / Meal One, buttons Subscription / One Time purchase); 'TRANSFORM YOUR DAILY HABITS' tabs (MEAL ONE / PROTEIN BAR) with 'Ingredients & Nutritional Facts' button; FAQ 'FREQUENTLY ASKED QUESTIONS' with 5 items ('Why is Kreatures spelled with a "K"?' opens by default, others closed); Junip reviews widget with Sort by / Rating / Photos & videos filters and 'See more reviews'.
- Console shows several third-party errors on load (analytics/Klaviyo etc.); do not fail tests on console errors unless the error originates from the builder or cart scripts.
- Mobile (390x844): no horizontal overflow observed on the page (scrollWidth 375 vs 390 viewport); the mobile sticky ATC variant 'ADD TO CART - $x' (pfp-sticky__atc--mobile) is used.

## Test Scenarios

### 1. 1. Minimum and button state, steppers

**Seed:** `tests/seed.spec.ts`

#### 1.1. Initial state of the bundle builder

**File:** `tests/generated/koh-bundle-builder/initial-state.spec.ts`

**Steps:**
  1. Navigate to /pages/bundle-builder and close the Klaviyo popup via 'Close dialog' (do not click MORNINGS/3PM/BOTH).
    - expect: Page title contains 'Bundle Builder'; H1 'BUNDLE & SAVE' and H2 'MINIMUM 2 PRODUCTS' are visible.
  2. Inspect both product groups.
    - expect: Protein Bar lists exactly 4 flavours (Variety Pack, Blueberry Cream Cruncher, Peanut Butter Banger, Cookie Dough Dazzler); Meal One lists exactly 8 flavours (Maple Caramel, Apple Cinnamon, Strawberry Walnut Cream, Peanut Butter Banana, Chocolate, Vanilla, Blueberry Banana, Variety).
    - expect: Each flavour shows count 0; every 'Decrease <flavour>' button is disabled; every 'Increase <flavour>' button is enabled.
    - expect: Group headers show $39.99 struck through and $23.59.
  3. Inspect the Purchase Type section and main button.
    - expect: 'Subscribe & Save' is pressed (aria-pressed=true) by default and 'One-Time Purchase' is not.
    - expect: Both cards show '0 Boxes'; frequency combobox defaults to 'DELIVERED EVERY 30 DAYS'.
    - expect: The .pfp__atc button reads 'PLEASE ADD 2 BOXES' and is disabled.
    - expect: The sticky 'Your Bundle' bar is not shown while no boxes are selected.

#### 1.2. Two-box minimum enables the Add to Cart button

**File:** `tests/generated/koh-bundle-builder/two-box-minimum.spec.ts`

**Steps:**
  1. Load /pages/bundle-builder, dismiss popups. Click 'Increase Variety Pack' once.
    - expect: Count for Variety Pack is 1; both purchase cards show '1 Box' (singular).
    - expect: Main button reads 'PLEASE ADD 1 BOX' and stays disabled; clicking it does not open the cart or change the cart (/cart.js item_count 0).
  2. Click 'Increase Blueberry Cream Cruncher' once.
    - expect: Both cards show '2 Boxes'; the main button becomes enabled and reads 'ADD TO CART'.
    - expect: A sticky bar appears reading 'Your Bundle (2)  Total: $47.18  $79.98  ADD TO CART'.
  3. Click 'Decrease Blueberry Cream Cruncher' once.
    - expect: Count returns to 0 for that flavour, cards show '1 Box', the main button is again disabled with 'PLEASE ADD 1 BOX'; the sticky bar total updates (or the sticky bar remains consistent with 1 box).

#### 1.3. One flavour with quantity 2 satisfies the minimum

**File:** `tests/generated/koh-bundle-builder/single-flavour-two-boxes.spec.ts`

**Steps:**
  1. Click 'Increase Chocolate' twice.
    - expect: Chocolate count is 2; cards show '2 Boxes'; main button enabled ('ADD TO CART').
  2. Click the enabled add-to-cart button and wait for the drawer.
    - expect: Drawer 'Your cart (2)' opens with a single 'MEAL ONE Overnight Oats - Chocolate' line with quantity 2 at $47.18 (struck $79.98) and 'Every 30 days'.

#### 1.4. Steppers never go below zero and respond correctly to repeated clicks

**File:** `tests/generated/koh-bundle-builder/stepper-lower-bound.spec.ts`

**Steps:**
  1. On a fresh builder confirm 'Decrease Vanilla' is disabled; attempt a forced click on it (click with force) and press Enter on it when focused.
    - expect: Count stays 0; no negative value is ever displayed; button stays disabled.
  2. Click 'Increase Vanilla' 3 times, then 'Decrease Vanilla' 3 times.
    - expect: Count goes 1, 2, 3 then 2, 1, 0; after reaching 0 'Decrease Vanilla' becomes disabled again.
    - expect: Cards show '3 Boxes' then back to '0 Boxes'; main button returns to 'PLEASE ADD 2 BOXES' disabled; sticky bar disappears or shows 0.
  3. Click 'Increase Vanilla' 10 times quickly.
    - expect: Count reaches 10 (or a documented maximum if one exists; record any cap). Totals update to $235.90 subscription / $399.90 one-time at 10 boxes and the UI stays responsive.

#### 1.5. Mixing both product groups in one bundle

**File:** `tests/generated/koh-bundle-builder/mix-groups.spec.ts`

**Steps:**
  1. Click 'Increase Cookie Dough Dazzler' once and 'Increase Maple Caramel' once.
    - expect: Counts are 1 and 1; cards show '2 Boxes'; button enabled; total $47.18 (subscription).
  2. Add 'Increase Variety' (Meal One) once and 'Increase Peanut Butter Banger' once.
    - expect: 4 boxes: subscription $94.36 (struck $159.96); one-time $159.96; sticky bar 'Your Bundle (4)'.
  3. Click ADD TO CART and inspect the drawer and /cart.js.
    - expect: Drawer shows 4 separate lines (THE DAILY BAR - Cookie Dough Dazzler, THE DAILY BAR - Peanut Butter Banger, MEAL ONE Overnight Oats - Maple Caramel, MEAL ONE Overnight Oats - Variety), each qty 1 at $23.59 (struck $39.99, '$16.40 off'), plan 'Every 30 days'.
    - expect: Header 'Your cart (4)'; free shipping bar reads 'Congratulations! You have free shipping!'; subtotal $94.36.

### 2. 2. Pricing, purchase type and frequency

**Seed:** `tests/seed.spec.ts`

#### 2.1. Totals and box counts update with each count change

**File:** `tests/generated/koh-bundle-builder/totals-update.spec.ts`

**Steps:**
  1. Add boxes one at a time (mix flavours) and after each click read the two purchase cards and the sticky bar.
    - expect: Subscription total after n boxes = n x $23.59 (2: $47.18, 3: $70.77, 4: $94.36, 5: $117.95) with struck-through original n x $39.99 (2: $79.98, 3: $119.97).
    - expect: One-time total after n boxes = n x $39.99.
    - expect: Box label is '1 Box' for 1 and 'n Boxes' for n>1; sticky bar 'Your Bundle (n)' matches.
  2. Remove boxes with the Decrease buttons.
    - expect: All totals decrease consistently and return to the 0-box defaults ($39.99 / $23.59 / '0 Boxes').

#### 2.2. Subscription 41% first-order discount maths

**File:** `tests/generated/koh-bundle-builder/subscription-math.spec.ts`

**Steps:**
  1. Select 3 boxes of any flavour and read both cards.
    - expect: Subscribe: $70.77 vs struck $119.97. (119.97 - 70.77) / 119.97 = 41.0% (allow +/- 1 cent rounding).
    - expect: Per-box subscription price $23.59 = $39.99 x 0.59 rounded.
    - expect: Copy states '41% off first order • 10% off recurring', and the page/announcement bar says 'SAVE 41% ON FIRST-TIME SUBSCRIPTION ORDERS'.
  2. Add to cart and compare with the drawer.
    - expect: Drawer line price $70.77, original $119.97, badge '$49.20 off'; subtotal badge '$49.20 off', subtotal $70.77.

#### 2.3. Switch between Subscribe & Save and One-Time Purchase

**File:** `tests/generated/koh-bundle-builder/purchase-type-toggle.spec.ts`

**Steps:**
  1. Choose 2 boxes, then click 'One-Time Purchase'.
    - expect: One-Time card becomes aria-pressed=true; Subscribe card false; the frequency combobox is not applicable for the one-time purchase.
    - expect: Sticky total shows $79.98 (no struck-through price); button stays enabled 'ADD TO CART'.
  2. Click 'Subscribe & Save' again.
    - expect: Subscribe card pressed again; sticky total returns to '$47.18 (struck $79.98)'. The previously chosen frequency is retained.
  3. Choose One-Time and ADD TO CART.
    - expect: Cart lines have no plan text and show $39.99 each (no discount badge); /cart.js selling_plan_allocation is absent; no gift row; each line shows a 'Subscribe & Save 41%' button; subtotal $79.98 and free-shipping text 'Only $39.02 left to get free shipping!'.

#### 2.4. Every delivery frequency is selectable and carried to the cart line

**File:** `tests/generated/koh-bundle-builder/delivery-frequency.spec.ts`

**Steps:**
  1. Open the 'Delivery frequency' combobox and list its options.
    - expect: Exactly 4 options: 'DELIVERED EVERY 15 DAYS', '... 30 DAYS' (selected by default), '... 45 DAYS', '... 60 DAYS'.
  2. For each frequency (15, 30, 45, 60): fresh page, add 2 boxes, select that option, ADD TO CART, open the drawer.
    - expect: Combobox shows the chosen value before adding.
    - expect: The cart line shows 'Every 15 days' / 'Every 30 days' / 'Every 45 days' / 'Every 60 days' respectively and /cart.js selling plan name is '15 days' etc.
    - expect: Price per box stays $23.59 for every frequency.
  3. Change frequency while the one-time option is active, then switch back to subscription.
    - expect: No error occurs; the combobox value is preserved or defaults to 30 days (record actual behaviour); the plan carried to the cart matches what the combobox shows at add time.

### 3. 3. Free gift and free shipping

**Seed:** `tests/seed.spec.ts`

#### 3.1. Free gift unlock with 2 subscribed boxes - modal and cart row

**File:** `tests/generated/koh-bundle-builder/free-gift-subscription.spec.ts`

**Steps:**
  1. Fresh page, close popup, add 2 boxes with Subscribe & Save selected. Immediately and for ~5 seconds check whether the modal 'Free gift unlocked / Pick a free gift, on us.' (class pfp-gift-modal, 'Kreatures Glass Mug', buttons 'Add' and 'Skip for now') becomes visible (opacity > 0, aria-hidden removed).
    - expect: Expected: the modal appears with the Kreatures Glass Mug option. KNOWN DISCREPANCY: during exploration it stayed hidden (aria-hidden=true, opacity 0). Record whether it is visible; if not, log a defect.
  2. If visible, click 'Add'. Then add to cart and open the drawer.
    - expect: Drawer shows section 'Your Free Gifts' with 'Kreatures Glass Mug', 'with subscription', 'Unlocked!', price FREE and a REMOVE button; header count still reflects only paid boxes.
  3. Check /cart.js a few seconds after the drawer opens (gift is added asynchronously).
    - expect: The mug line exists with price 0. If it never appears record a defect (it was missing in 1 of 3 exploratory runs).

#### 3.2. Free gift modal: Skip for now

**File:** `tests/generated/koh-bundle-builder/free-gift-skip.spec.ts`

**Steps:**
  1. Reach 2 subscribed boxes so that the gift modal is visible (precondition; if it does not show, mark the test as blocked by the discrepancy above). Click 'Skip for now'.
    - expect: Modal closes; builder stays at 2 boxes; no gift is added to the cart.
  2. Add to cart and open the drawer.
    - expect: Drawer has the 2 paid lines and no 'Your Free Gifts' section.
  3. Repeat, closing the modal with the '×' button instead.
    - expect: Modal closes with the same result as Skip.

#### 3.3. Free gift remove in the drawer

**File:** `tests/generated/koh-bundle-builder/free-gift-remove.spec.ts`

**Steps:**
  1. Add 3 subscribed boxes (e.g. 3 x Apple Cinnamon, 15-day plan) and add to cart; wait for the 'Your Free Gifts' row.
    - expect: Mug row with FREE and REMOVE is shown.
  2. Click the gift's REMOVE ([data-koh-remove-gift]).
    - expect: Gift row disappears; paid items, totals ($70.77) and shipping progress unchanged; no page error.
  3. Reload and reopen the cart.
    - expect: Gift stays removed (is not silently re-added).

#### 3.4. Free gift when switching to One-Time Purchase

**File:** `tests/generated/koh-bundle-builder/free-gift-one-time.spec.ts`

**Steps:**
  1. Add 2 boxes, keep Subscribe & Save (gift unlocked, accept it if offered), then click 'One-Time Purchase' before adding to cart.
    - expect: Gift modal/indicator is not offered or is cleared for the one-time selection (the card lists no free gift).
  2. Add to cart as one-time and inspect the drawer.
    - expect: No 'Your Free Gifts' row and no mug in /cart.js. Record behaviour if a mug is present on a one-time cart (expected defect).
  3. With a subscribed cart that contains the mug, remove the subscribed lines or switch lines to one-time and observe the gift.
    - expect: Record whether the gift is removed. Observation: the mug stayed in the cart after reducing the cart to 1 subscribed box, so the gift is not tied to the 2-box threshold; log if this is not intended.

#### 3.5. Free shipping threshold at 3 boxes (drawer progress text)

**File:** `tests/generated/koh-bundle-builder/free-shipping-threshold.spec.ts`

**Steps:**
  1. Subscribed: add 2 boxes and ADD TO CART.
    - expect: Drawer text 'Add 1 more to get free shipping!' with the progress bar about two thirds full.
  2. Click the drawer 'plus' on a line to reach 3 boxes.
    - expect: Text becomes 'Congratulations! You have free shipping!' and the bar is full; subtotal $70.77.
  3. Click 'minus' on a line with quantity > 1 to return to 2 boxes.
    - expect: Text returns to 'Add 1 more to get free shipping!'.
  4. Fresh page: add 3 boxes straight from the builder (subscribed) and add to cart.
    - expect: Drawer immediately shows 'Congratulations! You have free shipping!'.
  5. Fresh page, One-Time: add 2 boxes then 3 boxes.
    - expect: 2 boxes: price-based text 'Only $39.02 left to get free shipping!' (threshold $119).
    - expect: 3 boxes ($119.97): free shipping congratulation text (verify; record if the one-time text/threshold differs from the '3+ boxes' claim).

### 4. 4. Cart drawer and checkout

**Seed:** `tests/seed.spec.ts`

#### 4.1. Drawer contents and totals match the builder

**File:** `tests/generated/koh-bundle-builder/drawer-matches-builder.spec.ts`

**Steps:**
  1. Select Cookie Dough Dazzler x1, Variety Pack x1 (Protein Bar), Chocolate x1 (Meal One) on a 30-day subscription and note the sticky total ($70.77).
    - expect: Sticky bar 'Your Bundle (3)' total $70.77.
  2. Click ADD TO CART.
    - expect: Cart drawer opens automatically; header 'Your cart (3)'.
    - expect: Three lines with correct product title, flavour, image, 'Every 30 days', qty 1, $23.59 struck $39.99 and '$16.40 off'.
    - expect: Subtotal $70.77 with '$49.20 off' badge and original $119.97 (or per-line equivalent), and 'Shipping + tax calculated at checkout'.
  3. Close the drawer with 'Close cart'; reopen it with the header 'Cart' button.
    - expect: Contents unchanged; builder page remains at the same scroll position.
  4. Navigate to /cart.
    - expect: Redirects to /?cart=open and the drawer opens with the same items.

#### 4.2. Drawer quantity plus, minus and remove for builder items

**File:** `tests/generated/koh-bundle-builder/drawer-quantity.spec.ts`

**Steps:**
  1. Add 2 different flavours (1 each, subscribed) and open the drawer. Click 'plus' on the first line.
    - expect: Qty 2, line price $47.18 (struck $79.98, '$32.80 off'), header 'Your cart (3)', subtotal $70.77, free shipping reached.
  2. Click 'minus' twice on the same line.
    - expect: Qty goes to 1 and stays at 1 (minus does not delete at 1); totals back to $47.18; progress 'Add 1 more'.
  3. Click the trash 'remove' icon on one line.
    - expect: Line disappears; header 'Your cart (1)'; text 'Add 2 more to get free shipping!'; subtotal $23.59.
  4. Remove the last line.
    - expect: Drawer shows an empty-cart state (no lines, no checkout error); /cart.js item_count is 0 (any free gift row is also gone or recorded).
  5. Click 'plus' rapidly 5 times on a line.
    - expect: Quantity ends at the number of clicks, totals are consistent and no stuck loading state.

#### 4.3. Checkout link reaches Shopify checkout

**File:** `tests/generated/koh-bundle-builder/checkout-link.spec.ts`

**Steps:**
  1. Add 2 boxes (subscribed), open the drawer and click the CHECKOUT link (href /checkout).
    - expect: Browser lands on https://kreaturesofhabit.com/checkouts/cn/<token>/en-us with title 'Checkout - Kreatures of Habit'. STOP here: do not fill any checkout field or submit.
  2. Repeat with a one-time cart.
    - expect: Same checkout URL pattern is reached.
  3. Use the browser Back button from checkout.
    - expect: Returns to the builder/cart page without losing the cart contents.

#### 4.4. Empty cart state and cart persistence

**File:** `tests/generated/koh-bundle-builder/empty-cart.spec.ts`

**Steps:**
  1. On a fresh session click the header 'Cart' button without adding anything.
    - expect: Drawer opens showing an empty state; CHECKOUT is absent, disabled or leads nowhere harmful (record behaviour); no console errors from the cart component.
  2. Add 2 boxes, add to cart, reload the page.
    - expect: Cart persists; reopening the drawer shows the same items; builder counters are reset to 0 after reload.

### 5. 5. Accordions, FAQ and informational content

**Seed:** `tests/seed.spec.ts`

#### 5.1. Builder accordions open and close

**File:** `tests/generated/koh-bundle-builder/accordions.spec.ts`

**Steps:**
  1. Click 'HOW TO PREPARE', then 'WHAT'S INSIDE EACH BOX', then 'REVIEWS & RATINGS' summaries below the add to cart button.
    - expect: Each group opens and shows content (details[open]); clicking the same summary again closes it; opening one does not break the others or move the add-to-cart controls.
  2. Click 'NUTRITION & INGREDIENTS' (top of the builder).
    - expect: Dialog 'NUTRITION & INGREDIENTS' opens with tabs 'Protein Bar' and 'Meal One' and 12 flavour buttons; clicking a flavour shows its panel; the close button and Escape close it.
  3. Open the Box Info dialog (via the box info trigger in the accordion/purchase area) and use the 'Protein Bar'/'Meal One' tabs and 'Subscription'/'One Time purchase' buttons.
    - expect: Dialog 'BOX INFO' shows the note 'Box details remain the same; only the price varies between one-time purchase and subscription.' and closes properly.
  4. Under 'TRANSFORM YOUR DAILY HABITS' switch tabs MEAL ONE and PROTEIN BAR and click 'Ingredients & Nutritional Facts'.
    - expect: Tab panels switch (aria-selected updates) with benefit cards; the button opens the nutrition dialog.

#### 5.2. FAQ accordion behaviour

**File:** `tests/generated/koh-bundle-builder/faq.spec.ts`

**Steps:**
  1. Scroll to 'FREQUENTLY ASKED QUESTIONS' and note which items are open.
    - expect: 5 questions: 'Why is Kreatures spelled with a "K"?' (open by default, answer 'Our founder thinks he's an "artist"...'), 'I ate all of my MEAL ONE, what should I do next?', 'What type of plant protein is it? And is it good for me?', 'What are net carbs?', 'Is this high in sugar?'.
  2. Click each closed question, then click it again.
    - expect: Answer is revealed on first click and hidden on the second; non-empty answer text for each.
  3. Check whether opening one item closes the others.
    - expect: Record behaviour (independent vs exclusive); it must be consistent.

#### 5.3. Reviews widget on the builder page

**File:** `tests/generated/koh-bundle-builder/reviews.spec.ts`

**Steps:**
  1. Scroll to the Junip reviews section; change 'Sort by' to 'Highest rated' and 'Rating' to '5 stars'; toggle 'Photos & videos'.
    - expect: Review list refreshes without navigation; only 5-star reviews show for the 5 stars filter; no JS crash. (Do not click vote buttons that submit data.)
  2. Click 'See more reviews'.
    - expect: More review cards load.

### 6. 6. Single-product builders and mobile

**Seed:** `tests/seed.spec.ts`

#### 6.1. Meal One product page builder (/products/meal-one-v2)

**File:** `tests/generated/koh-bundle-builder/product-meal-one.spec.ts`

**Steps:**
  1. Open /products/meal-one-v2, dismiss popups.
    - expect: H1 'MEAL ONE.'; 8 flavour steppers (Maple Caramel ... Variety); button 'PLEASE ADD 2 BOXES' disabled.
    - expect: Purchase cards show 'Subscribe & Save $39.99 $23.59 2 BOXES • 14 meals $3.37/meal' and 'One-Time Purchase $39.99 2 BOXES • 14 meals $5.71/meal'; no Protein Bar flavours present.
  2. Add 2 boxes (e.g. Vanilla and Chocolate), toggle One-Time, then Subscribe.
    - expect: Button enabled; box/meal text updates (2 boxes = 14 meals, 3 boxes = 21 meals); per-meal price $3.37 subscribed vs $5.71 one-time; totals match the bundle-builder maths.
  3. Add to cart and open the drawer.
    - expect: Lines are MEAL ONE Overnight Oats with correct flavours, plan text and prices as in the bundle builder.

#### 6.2. Daily Bar product page builder (/products/daily-bar)

**File:** `tests/generated/koh-bundle-builder/product-daily-bar.spec.ts`

**Steps:**
  1. Open /products/daily-bar, dismiss popups.
    - expect: H1 'THE DAILY BAR.'; 4 flavour steppers; button 'PLEASE ADD 2 BOXES' disabled; cards show '2 BOXES • 24 bars $1.97/bar' (subscribe) and '$3.33/bar' (one-time).
  2. Add 2 boxes, check the totals, enter every frequency, add to cart.
    - expect: Totals $47.18 subscribed / $79.98 one-time; cart line 'THE DAILY BAR' with the chosen plan; the same free-shipping text rules as the bundle page; accordions HOW TO PREPARE, WHAT'S INSIDE EACH BOX, REVIEWS & RATINGS and the daily-bar FAQ (e.g. 'What type of protein is in THE DAILY BAR?') open and close.

#### 6.3. Mobile layout (390x844) of the bundle builder

**File:** `tests/generated/koh-bundle-builder/mobile-layout.spec.ts`

**Steps:**
  1. Use a mobile viewport (390x844, project koh-mobile if available or page.setViewportSize), open the builder and dismiss popups.
    - expect: No horizontal scroll (document scrollWidth <= viewport width).
    - expect: Steppers and flavour buttons are fully visible and tappable (>= 32px); the sticky bar does not cover the stepper being tapped.
  2. Add 2 boxes and inspect the sticky ATC.
    - expect: Mobile sticky button reads 'ADD TO CART - $47.18'; the bottom-left popup teaser does not block it (record any overlap).
  3. Add to cart and open the drawer.
    - expect: Drawer fills the screen, lines/controls usable, CHECKOUT visible without clipping.

#### 6.4. Popup interference check

**File:** `tests/generated/koh-bundle-builder/popup-interference.spec.ts`

**Steps:**
  1. Load the builder and, without dismissing the Klaviyo popup, try to click 'Increase Vanilla'.
    - expect: The click is blocked/intercepted by the dialog (documents why fixtures must close it). After clicking 'Close dialog' the stepper responds. Never click MORNINGS/3PM/BOTH or submit any form.
  2. After closing, check the bottom-left teaser tab and the sticky bar.
    - expect: Teaser does not prevent clicking ADD TO CART in the sticky bar; if it does, record as a defect.
