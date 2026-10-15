# Revitin Buy Box Test Plan

## Application Overview

Test plan for the Revitin PDP buy box at https://revitin.com/products/revitin-natural-toothpaste (custom Shopify theme: size tabs, flavor chips, subscription/one-time pack cards, <site-cart> drawer, custom Judge.me-fed review cards) and the merchant-specific features around it: flavor and size URLs, Variety mixes, Travel size products, cart accuracy, drawer-to-checkout, FAQ, reviews, content pages and mobile. Project: revitin-desktop-chromium (mobile scenarios use a 390x844 viewport), seed: tests/seed.spec.ts (fixtures/base closes popups and handles Cloudflare 429s). Not re-planned here because generic specs already cover them: one-time vs subscribe switching, choosing every delivery frequency, subscribe discount badge visible, subscription carried to cart, generic cart drawer upsell cards, cart qty +/-/remove, generic accordion open/close, reviews widget count.

GLOBAL RULES FOR EVERY SCENARIO
- Start from a fresh browser context (empty cart). If needed clear the cart with fetch('/cart/clear.js', {method:'POST'}) and reload the page (clearing does NOT close an open drawer or refresh its contents). Each scenario is independent.
- NEVER place an order: stop at the Shopify checkout URL (/checkouts/cn/<token>/en-us). NEVER submit any form: Judge.me 'Write a review' / 'Submit Review', the footer newsletter 'Subscribe', contact, wholesale, partner forms, and the 15%-off promotional popup (its 'Gum Health', 'Enamel Support', 'Tooth Sensitivity', 'Safer Ingredients' buttons). Do not click 'Write a Review', vote or upload controls.
- Be gentle with the site (Cloudflare 429): one navigation per step, no reload loops, no more than one cart add per page load. Use the rateLimitGuard fixture; do not add ad-hoc waitForTimeout to dodge 429s (short waits for UI settle are fine).
- Popups: a dialog 'Promotional popup' ("You've Got 15% off", 'What do you brush for?', 'Close popup' button, 'I don't want 15% off' button) appears a few seconds after load and may cover the buy box. The fixtures close it via 'Close popup'. A chat launcher ('Text us', Podium iframe) sits bottom-left and may overlap lower content. Also an accessiBe widget ('Use Website In a Screen-Reader Mode') is present; ignore it.
- NAVIGATION TRAP: clicking a Full/Travel size tab or a Citrus/Mint flavor chip changes the URL (full navigation or pushState). A plain locator.click() can hang on 'waiting for scheduled navigations'. Use click({noWaitAfter:true}) followed by expect(page).toHaveURL(...) and wait for the buy box (button.main__atc__button) to be visible again.
- Cart drawer: custom element <site-cart> (class gets 'active' when open). It intercepts pointer events on the page when open, so reload (or close it with its first, unlabeled close button) before touching the buy box again. Checkout control is a link 'Checkout' with href /checkout. Line buttons are named 'Decrement Line Item Quantity', 'Increment Line Item Quantity', 'Remove <variant title>'.
- Button label varies: the main button reads '$42 — Add to Bag' in Subscribe mode but '$17 — Add to Cart' after a one-time pack is picked (and 'Add to Cart' for the Variety box). Always match /Add to (Bag|Cart)/ and use the visible button.main__atc__button (a hidden duplicate exists; a hidden span.atc-price contains the literal text 'undefined', display:none).
- Verify cart contents with fetch('/cart.js') (variant_id, sku, title, price in cents, selling_plan_allocation.selling_plan.name) AND the drawer text. Prices on the page have no cents ($42, $17).
- Console shows 5-9 third-party errors on every load (analytics, chat, review widgets); do not fail tests on console errors unless the error originates from the product-form, cart or review scripts.

VERIFIED PAGE FACTS (live, 2026-10-13)
- Page: /products/revitin-natural-toothpaste (a trailing '?' is appended to the address bar after load, e.g. '.../revitin-natural-toothpaste?'). Document title is identical for every flavor/size/URL: 'Revitin | SLS-Free Toothpaste | Buy Fluoride-Free Toothpaste Online'. Announcement bar link 'Subscribe & Get Free Shipping on Every Order' -> /products/revitin-natural-toothpaste/Mint; nav 'Shop' -> same /Mint URL, 'About' -> /pages/about, 'Ingredients' -> /pages/ingredients; header button 'Cart 0'.
- Buy box (desktop): H3 'Revitin Natural Toothpaste' (class main_pdp_size_heading), review badge '881 reviews' (data-average-rating 4.54), blurb 'Promote a healthy balance of your oral ecology to support oral health and wellness for whiter teeth and fresher breath.', size tabs buttons 'Full Size' (.size_selection_btn.full-size-btn, class 'active' when selected) and 'Travel Size' (.travel-size-btn), flavor chips 'Citrus', 'Mint' (button[data-flavor], class 'flavour-custom ... active' + bg-gold / bg-light-green) and 'Variety' (.variety-selector-btn), footer text '30-Day Money Back Guarantee'. No sticky add-to-cart bar exists on desktop or mobile. No Afterpay/Klarna/Shop Pay messaging is rendered (afterpay-placement / klarna-placement / shopify-payment-terms elements: 0; only a generic payment-terms script is present).
- Default state of /products/revitin-natural-toothpaste: Full Size active, Citrus active (Citrus gallery visible), Subscribe & Save heading 'Subscribe & Save up to 20%', 'Free shipping. Save on every order.', 'Easily edit, skip, or cancel anytime.', Trio card selected, main button '$42 — Add to Bag'. Selected state is conveyed only by CSS class 'active' (no aria-pressed / aria-checked / aria-expanded anywhere in the buy box).
- Subscription pack cards (button.variant-price-btn, class 'active' when chosen): 'Trio - 3 tubes' + badge 'Most Popular', $42 (struck $51), 'Save 18%'; 'Family pack - 5 tubes', $68 (struck $85), 'Save 20%'. Each card has 'Delivered every' combobox with options 'month', '2 months', '3 months' (default, selected), '6 months'. Main button price follows the selected card ($42 Trio, $68 Family). Math: 42/51 = 17.65% off (shown 18%), 68/85 = 20.0% off (shown 20%).
- One-Time card: button 'One-Time Purchase' (button.one_time_heading, data-cadence='Once') with price $17. After selecting it the subscription cards stay visible but deselected and four pack buttons appear: 'Single Tube' ($17, DOM text 'Save 0%'), '3 Tubes Save 10%' ($46, struck $51 => 9.8%), '5 Tubes Save 18%' ($70, struck $85 => 17.6%), '25 Tubes Save 18%' ($350, struck $425 => 17.6%). Main button follows: '$17 — Add to Cart', '$46', '$70', '$350'. Gotcha: getByRole('button',{name:'5 Tubes'}) also matches 'Family pack - 5 tubes' and '25 Tubes' (case-insensitive substring); anchor with /^5 Tubes/.
- Flavor URLs: Mint -> /products/revitin-natural-toothpaste/Mint (Mint chip active, Mint gallery); Citrus -> /products/revitin-natural-toothpaste/Citrus; unknown flavor e.g. /products/revitin-natural-toothpaste/Banana returns HTTP 200 and falls back to Citrus selected. Variety -> /products/revitin-natural-toothpaste?pack=variety (note: query parameter, not a path segment). Travel -> /products/revitin-natural-toothpaste/Citrus?size=travel and /Mint?size=travel; Travel + Variety -> /Mint?size=travel&pack=variety.
- Variety box (full size): Subscribe & Save card ($42 struck $51, 'Save 18%', 'Delivered every [3 months]' with the same four frequency options, 'Free shipping. Cancel anytime.') and a One-time Purchase card ($46 struck $51, 'Save 10%') as labels/radios (labels 'Subscribe & Save' and 'One-time Purchase', lowercase t). Mix buttons '2 Citrus & 1 Mint' (default, class 'variety-qty subs|once active', data-citrus-count=2 data-mint-count=1) and '2 Mint & 1 Citrus' (data-mint-count=2 data-citrus-count=1); one set for subscribe (.subs) and one for one-time (.once). No Family 5-pack exists for Variety. Main button label 'Add to Cart' with no price.
- Travel size (separate products): heading changes to 'Revitin Travel Size Toothpaste', no subscription/one-time cards and no frequency, one fixed pack: 'Citrus 3-pack' $18, 'Mint 3-pack' $18, Variety '2 Mint & 2 Citrus' $24 (4 tubes). Main button '$18 — Add to Bag' / '$24 — Add to Bag'. Flavor chips become .ts-flavor-btn.ts-citrus / .ts-mint / .ts-variety. Default flavor on /?size=travel is Citrus.
- Cart facts from /cart.js (all verified live; price in cents): Citrus Trio subscription 'Revitin Toothpaste (3 Tubes) - Citrus' sku CITRUS3 variant 45594633666698, $42, plan 'Delivery every 3 months' (ids: 1 month 2436038794, 2 months 2435973258, 3 months 2436071562, 6 months 2436006026; names 'Delivery every 1 month' / '2 months' / '3 months' / '6 months'). Mint Family monthly: 'Revitin Toothpaste (5 Tubes) - Mint' sku MINT5 variant 45618689310858, $68, plan 'Delivery every 1 month with 17.65% discount'. One-time Mint 3 Tubes: sku MINT3 variant 45618606080138 $46 (no selling plan); one-time Mint 5 Tubes: sku MINT5 $70 (same variant as the Family pack, price differs by selling plan); one-time Mint 25 Tubes: sku MINT25 $350. Single Tube Citrus variant 45594631471242 sku CITRUS1 $17 (from product JSON; add-to-cart not re-verified). Variety 2 Citrus & 1 Mint: 'Revitin Toothpaste Variety 3 Tubes - Citrus' sku VARIETYPACK2C-1M variant 46765298909322, $42 subscription (plan 'Delivery every 3 months', id 2436432010) / $46 one-time. Variety 2 Mint & 1 Citrus: 'Revitin Toothpaste Variety 3 Tubes - Mint' sku VARIETYPACK2M-1C variant 46765283049610, $42 subscription. Travel: 'Citrus Travel 3-Pack of 1oz - Citrus' sku CitrTravel3-pk variant 46346187341962 $18 (url /products/revitin-toothpaste-travel-3-tubes), 'Mint Travel 3-Pack of 1oz - Mint' sku MintTravel3-pk variant 46346189045898 $18 (url /products/revitin-toothpaste-travel-3-tubes-1), 'Variety Travel 4-Pack of 1 oz' sku VarietyTravel4-pk variant 47799599759498 $24 (url /products/variety-travel-4-pack-of-1-oz). Travel and one-time lines carry no selling plan.
- Drawer text (examples): subscription Trio 'Your Cart | Subscription | Revitin Natural Toothpaste | Pack: 3 Tubes | Flavor: Citrus | $46 | $42 | Quantity | 1 | Delivered every 3 months'; one-time 'One-Time Purchase | ... | Pack: 3 Tubes | Flavor: Mint | $51 | $46' followed by the subscribe nudge 'Save and Get Free Shipping by Subscribing | Pay $42 for 3 tubes — just $14 each | Subscribe & Save'; Variety shows the mix as the line title ('2 Citrus & 1 Mint', 'Pack: 3 Tubes | Flavor: Variety'); Travel one-time 'Pack: Citrus Travel 3-Pack of 1oz' with nudge 'Pay only $42 for 3 full size tubes.'. Subscription Trio shows 'Upgrade and Save | Save more at just $13.60 per tube | Get free shipping on every delivery | Upgrade to 5 Tubes'. Footer rows: 'Subtotal | $<total>', 'Checkout', 'Taxes and shipping calculated at checkout'. Upsell cards (.cart-upsell-card, section .you-may-also-like): Mint cart -> 'Most Added | Mint Travel 3-Pack of 1oz | $18 | Flavor: Mint | Add'; Mint Family cart -> 'Try a New Flavor | Citrus Travel 3-Pack of 1oz | $18'; Travel cart -> 'Best Value | Citrus Full Size | $17'. The drawer header close button has no accessible name.
- Checkout: drawer link 'Checkout' (/checkout) lands on https://revitin.com/checkouts/cn/<token>/en-us?_r=... with title 'Checkout - Revitin' (verified with a Mint Trio subscription cart). Stop there.
- FAQ (PDP): section 'Frequently Asked Questions' (H3, eyebrow 'You're not alone') with 8 items, each a button.accordion-button containing an H2, all closed on load, opening is independent (opening item 2 leaves item 1 open; second click closes). Questions: 'How is Revitin different from other toothpastes?', 'What should I do if I accidentally swallow Revitin?' (answer 'Revitin is designed for oral use and is safe if swallowed. Please follow the usage instructions provided with the product.'), 'Is Revitin fluoride-free?' ('Yes, Revitin is fluoride-free. There are no toxic ingredients in our formula.'), 'What else is Revitin free from?' ('Revitin is free from fluoride, SLS, gluten, dyes, peanuts, sugar, xylitol, and GMOs.'), 'Does Revitin whiten teeth?', 'Is Revitin vegan?' ('Yes.'), 'Is Revitin safe for children?', 'Do you ship internationally?' ('Yes.'). Panel height grows from about 57px closed to about 118px open.
- Key Ingredients section (PDP, below the buy box): eyebrow 'Key Ingredients', H3 'Our first-of-its-kind formula is backed by 15 years of clinical research. Here's what goes into it:', six H3 cards: Vitamin C (Antioxidant), CoQ10 (Anti-inflammatory enzyme), Vitamin D (Mineralization), Cranberry Seed Oil (Prebiotic), Quillaja Saponaria Extract (Lifting agent), Chondrus Crispus (Prebiotic), each with a description and an illustration; link 'All ingredients' -> /pages/ingredients. Also a 'Meet Dr. Gerry' / 'Backed by research' block.
- Reviews: H2 'Customer Reviews', summary heading '4.6', '1,139 Reviews' with distribution 923 / 80 / 60 / 28 / 48 (sum 1139), 'Reviews Summary' AI paragraph, 'Write a Review' button (do not click). Cards are article.jm-card with .jm-card-stars (five svg.jm-star; filled = style opacity 1, empty = 0.22), .jm-card-date (format MM/DD/YY), name and 'Verified by shop', body. Sort control is a button showing 'Highest Rating' by default with list items 'Highest Rating', 'Lowest Rating', 'Most Recent', 'Oldest'. 20 cards initially; 'Load More' adds 20 per click (20 -> 40 verified). Verified: Lowest Rating -> star sequence 1,1,...,2,...,3,...,4,...,5 (ascending); Highest Rating -> all 5; Most Recent -> 10/13/26, 10/12/26, 10/11/26, 10/09/26 (descending); Oldest -> 06/18/26, 06/18/26, 06/19/26, 06/19/26, 06/21/26 (ascending). Choosing an option closes the list; clicking the sort button when the list is already open toggles it closed.
- Content pages (all HTTP 200, no 404): /pages/about (title 'About Revitin® | Meet Dr. Gerry Curatola, Our Founder'; H2 'Microbes are necessary for oral health', 'Harsh chemicals do more harm than good', 'Natural ingredients work very, very hard'; anchor #meet-dr-gerry exists; footer link 'Meet Dr. Gerry'), /pages/ingredients (title 'Revitin Ingredients | What's in Our Prebiotic Toothpaste', H1 'Revitin Ingredients', H2 'Meet Citrus', 'Meet Mint', 'Calcium Carbonate', 'Chrondrus Crispus'), /pages/faqs (title 'Revitin | FAQS', H2 'Ingredients', 'Product', 'Orders, Shipping & Returns', 'Subscriptions', 'Know About Revitin', 'Trusted by Thousands of Happy Smiles'; questions such as 'Is Revitin toothpaste fluoride-free and made with naturally derived in...', 'Is nano-hydroxyapatite safe for daily use?'), /pages/wholesale (title 'Revitin Wholesale Program', H1 'Revitin Wholesale Program', only ~660 characters of text and one form - do not submit), /pages/press (title 'Revitin Press Coverage & Media Mentions', H1 'Press & Media', H2 'Listen To The Revitin Story'), /blogs/all (title 'Revitin | All', H1 'Discover the Science of Prebiotic Oral Care', H2 article titles e.g. 'The Best Natural Toothpaste Ingredients to Look For in 2025'). Footer link 'The Science' -> /blogs/all, 'Reviews' -> /pages/review.
- Mobile (390x844): no horizontal overflow (scrollWidth 390); size tabs 104x46 and 120x46 at y~738, flavor chips 108x50 / 97x50 / 114x50 at y~796, pack cards 318x92 and 318x87, main button 350x48 at y~1271 (static position - NOT sticky, no fixed bottom bar; only the Podium chat iframe is fixed). Drawer fills the viewport (390x844) with Checkout at y 742-790 (350 wide), inside the viewport.

OBSERVATIONS (possible defects found while exploring - scenarios below are designed to detect them, not to assume them)
- O1. Two different review totals on the PDP: header badge '881 reviews' (4.54) vs widget '4.6 / 1,139 Reviews'. Also the 'Oldest' sort starts at 06/18/26 although the brand cites 15 years of research (likely import date; confirm with the merchant).
- O2. Compare-at prices differ between PDP and drawer: PDP shows Trio $42 struck $51 (Save 18%) and Family $68 struck $85 (Save 20%), but the drawer shows struck $46 for the Trio and struck $70 for the Family pack (the one-time pack prices), so the drawer-implied saving is 8.7% / 2.9%.
- O3. Selling plan name for the Family pack is 'Delivery every 1 month with 17.65% discount' (17.65% = Trio's 42/51 discount) while the PDP promises 20% (68/85); Trio plans have no discount text in their name.
- O4. Main button wording is inconsistent: 'Add to Bag' (subscription, Citrus/Mint, travel) vs 'Add to Cart' (one-time packs, Variety box); Variety button shows no price while the others show '$X —'.
- O5. The PDP upsell 'Citrus 3-pack $16 - Add to Bag' named in the coverage review was NOT found on the PDP in any state (default, /Mint, Variety, Travel, desktop or mobile; no '$16' text in the PDP HTML). The only upsells seen are in the drawer ($18 Travel 3-pack, $17 Citrus Full Size, $24 Variety Travel 4-Pack, 'Upgrade to 5 Tubes'). Scenario 4.1 records what is actually present.
- O6. The product page of the travel pack itself (/products/revitin-toothpaste-travel-3-tubes, linked from the cart line URL) renders the full-size buy box (Full Size / Citrus / Trio $42 selected) under the title 'Citrus Travel 3-Pack of 1oz' and shows '5 reviews', not the $18 travel pack.
- O7. After a client-side switch to Travel + Mint the desktop gallery containers [data-swap-flavor] still had Citrus visible (first two groups opacity-100 Citrus) while the URL said /Mint?size=travel; on full-size Mint all three groups show Mint. Needs a fresh-load visual check.
- O8. Variety line items are titled '... Variety 3 Tubes - Citrus' / '- Mint' in cart.js, so the variant title does not say which mix (2 Citrus & 1 Mint vs 2 Mint & 1 Citrus) - only SKU VARIETYPACK2C-1M / VARIETYPACK2M-1C and the drawer text do.
- O9. Accessibility/semantics: no aria-pressed/aria-expanded on size, flavor, pack and FAQ controls; drawer close button unlabeled; /pages/about has three H1 elements that are the 'GLUTEN FREE' marquee texts; /pages/faqs has no H1; /pages/wholesale has no H2 and almost no copy. Document title never changes per flavor/size URL. Trailing '?' appended to PDP URLs.
- O10. Unknown flavor paths (/products/revitin-natural-toothpaste/Banana) return 200 and silently show Citrus.
- O11. Trio default frequency is '3 months' while the header says 'Subscribe & Get Free Shipping on Every Order' and the drawer one-time nudge says 'just $14 each' for $42 (rounded; 42/3 = 14.00, ok) but the Upgrade nudge says '$13.60 per tube' (68/5) - fine; listed only so the maths is checked in scenario 3.6.

## Test Scenarios

### 1. 1. Size tabs, flavor selection and URL state

**Seed:** `tests/seed.spec.ts`

#### 1.1. 1.1. Default PDP state

**File:** `tests/generated/revitin-buy-box/default-state.spec.ts`

**Steps:**
  1. Open /products/revitin-natural-toothpaste on a fresh context; popups are closed by the fixture.
    - expect: H3 'Revitin Natural Toothpaste' and badge '881 reviews' are visible; document title is 'Revitin | SLS-Free Toothpaste | Buy Fluoride-Free Toothpaste Online'.
    - expect: 'Full Size' has class active and 'Travel Size' does not; flavor chip 'Citrus' has class active, 'Mint' and 'Variety' do not.
  2. Inspect purchase options and the main button.
    - expect: Heading 'Subscribe & Save up to 20%', cards 'Trio - 3 tubes' (Most Popular, $42, $51, Save 18%) and 'Family pack - 5 tubes' ($68, $85, Save 20%); the Trio card has class active; frequency combobox shows '3 months'.
    - expect: One-Time Purchase shows $17; main button text is '$42 — Add to Bag'; text '30-Day Money Back Guarantee' is visible.
    - expect: Cart badge reads 0 and /cart.js item_count is 0. No sticky add-to-cart bar and no Afterpay/Klarna placement is present (record).

#### 1.2. 1.2. Flavor chips change the URL path and selection

**File:** `tests/generated/revitin-buy-box/flavor-url.spec.ts`

**Steps:**
  1. Open the PDP and click the 'Mint' chip with noWaitAfter, then wait for the URL.
    - expect: URL path becomes /products/revitin-natural-toothpaste/Mint; 'Mint' chip has class active and 'Citrus' does not; the Mint gallery (data-swap-flavor='Mint') is the one with opacity-100; main button price is unchanged ($42).
  2. Click 'Citrus'.
    - expect: URL path becomes /products/revitin-natural-toothpaste/Citrus; Citrus chip active; Citrus gallery visible.
  3. Open /products/revitin-natural-toothpaste/Mint and /products/revitin-natural-toothpaste/Citrus directly, and also click the header 'Shop' link and the announcement bar link 'Subscribe & Get Free Shipping on Every Order'.
    - expect: Direct loads show the matching chip active with Full Size active; 'Shop' and the announcement link both land on /products/revitin-natural-toothpaste/Mint with Mint selected.
  4. Open /products/revitin-natural-toothpaste/Banana (unknown flavor).
    - expect: Page does not 404 (HTTP 200) and falls back to Citrus selected (OBSERVATION O10). Record the behaviour; a 404 or a broken buy box is a failure.

#### 1.3. 1.3. Full Size to Travel Size tab: what changes

**File:** `tests/generated/revitin-buy-box/size-tabs.spec.ts`

**Steps:**
  1. On /products/revitin-natural-toothpaste/Mint click 'Travel Size' (noWaitAfter) and wait for the URL.
    - expect: URL becomes /products/revitin-natural-toothpaste/Mint?size=travel; 'Travel Size' tab has class active, 'Full Size' does not; heading changes to 'Revitin Travel Size Toothpaste'.
    - expect: Subscribe & Save cards, One-Time Purchase card and frequency combobox are absent; a single fixed pack 'Mint 3-pack' at $18 is shown; main button reads '$18 — Add to Bag'.
    - expect: Flavor chip Mint stays selected (class ts-flavor-btn ts-mint active); document title is unchanged.
  2. Click 'Full Size' again.
    - expect: URL returns to the full-size path (no size=travel), Full Size tab is active, Subscribe/One-Time cards and the '$42 — Add to Bag' button return with Trio selected and '3 months'.
  3. Open /products/revitin-natural-toothpaste/Citrus?size=travel directly.
    - expect: Travel Size active, Citrus chip active, pack 'Citrus 3-pack' $18, main button '$18 — Add to Bag'.

#### 1.4. 1.4. Travel size flavors and the Variety travel pack

**File:** `tests/generated/revitin-buy-box/travel-flavors.spec.ts`

**Steps:**
  1. Open /products/revitin-natural-toothpaste/Citrus?size=travel, click '.ts-flavor-btn.ts-mint', then '.ts-flavor-btn.ts-variety'.
    - expect: After Mint: URL /products/revitin-natural-toothpaste/Mint?size=travel, label 'Mint 3-pack', $18, only the Mint chip active.
    - expect: After Variety: URL contains size=travel&pack=variety, pack label '2 Mint & 2 Citrus', $24, main button '$24 — Add to Bag' (4 tubes at $24 vs 3 tubes at $18).
  2. Load /products/revitin-natural-toothpaste/Mint?size=travel fresh and inspect the visible gallery (first visible [data-swap-flavor] group, image src/alt).
    - expect: Gallery shows Mint imagery. OBSERVATION O7: after a client-side flavor switch the first two gallery groups still showed Citrus; record whether a fresh load shows the correct flavor and fail if Mint travel shows Citrus images.

### 2. 2. Pack options, savings and price maths

**Seed:** `tests/seed.spec.ts`

#### 2.1. 2.1. Subscription pack cards: displayed saving matches the prices

**File:** `tests/generated/revitin-buy-box/subscription-math.spec.ts`

**Steps:**
  1. Read price, struck price and 'Save N%' for the 'Trio - 3 tubes' and 'Family pack - 5 tubes' cards on /products/revitin-natural-toothpaste/Mint.
    - expect: Trio $42 vs $51: round((51-42)/51*100) = 18 = shown 'Save 18%'. Family $68 vs $85: (85-68)/85 = 20% = shown 'Save 20%'. Allow rounding of +/-1 point; heading says 'up to 20%' (the max).
    - expect: Per-tube price: Trio $14.00, Family $13.60 (matches the drawer text 'just $13.60 per tube').
  2. Click the Family card, then the Trio card, and read the main button each time.
    - expect: Family: card has class active, main button '$68 — Add to Bag'. Trio: '$42 — Add to Bag'. Only one card is active at a time; the 'Most Popular' badge remains on the Trio card.

#### 2.2. 2.2. One-time packs: price, struck price and saving per pack

**File:** `tests/generated/revitin-buy-box/one-time-math.spec.ts`

**Steps:**
  1. Click 'One-Time Purchase' and read the four pack buttons (use /^Single Tube/, /^3 Tubes/, /^5 Tubes/, /^25 Tubes/ to avoid substring matches with 'Family pack - 5 tubes').
    - expect: Buttons 'Single Tube', '3 Tubes Save 10%', '5 Tubes Save 18%', '25 Tubes Save 18%' are visible; Single Tube is active by default; both subscription cards are deselected (not class active).
  2. Click each pack and read the One-Time card price/struck price and the main button.
    - expect: Single $17 (no struck price); 3 Tubes $46 struck $51 (9.8%, shown 10%); 5 Tubes $70 struck $85 (17.6%, shown 18%); 25 Tubes $350 struck $425 (17.6%, shown 18%). Main button shows '$17 / $46 / $70 / $350 — Add to Cart' accordingly.
    - expect: Struck price equals n x $17 for each pack (51, 85, 425) and shown % equals round(100 x (struck - price)/struck) within one point.

#### 2.3. 2.3. Main price and button follow every selection and mode switch

**File:** `tests/generated/revitin-buy-box/price-follows-selection.spec.ts`

**Steps:**
  1. Cycle: Trio -> Family -> One-Time Single -> One-Time 3 Tubes -> Trio again, reading the main button and which card/pack has class active after each click.
    - expect: Prices go $42, $68, $17, $46, $42 with exactly one active pack/card overall at each step (selecting a subscription card deselects one-time packs and vice versa).
    - expect: Record the label wording per step ('Add to Bag' vs 'Add to Cart' - OBSERVATION O4); the test must not fail on wording but must log it.
  2. Change the frequency combobox on the Family card to '6 months' and then back to '3 months'.
    - expect: Combobox shows the chosen value; the price stays $68 (frequency does not change the price); the Family card stays active.

#### 2.4. 2.4. Variety box: mix options, prices and selection state

**File:** `tests/generated/revitin-buy-box/variety-box.spec.ts`

**Steps:**
  1. Click the 'Variety' chip on the PDP and wait for ?pack=variety.
    - expect: URL is /products/revitin-natural-toothpaste?pack=variety; Variety chip active, Citrus/Mint chips inactive.
    - expect: Layout is different from Citrus/Mint: 'Subscribe & Save' card ($42 struck $51, 'Save 18%', 'Delivered every 3 months', 'Free shipping. Cancel anytime.') and a 'One-time Purchase' card ($46 struck $51, 'Save 10%'); no Family pack; main button 'Add to Cart' with no price.
  2. Read the mix buttons; click '2 Mint & 1 Citrus', then '2 Citrus & 1 Mint'.
    - expect: Two mix buttons '2 Citrus & 1 Mint' (default active) and '2 Mint & 1 Citrus'; exactly one is active at a time (class active on .variety-qty.subs).
    - expect: Subscription maths: 42/51 = 17.6% (shown 18%); one-time 46/51 = 9.8% (shown 10%).
  3. Click the 'One-time Purchase' label and check the mix buttons.
    - expect: The one-time mix set (.variety-qty.once) is shown with '2 Citrus & 1 Mint' active; the subscription mix set is hidden. Switching back to 'Subscribe & Save' restores the subscription set.

### 3. 3. Cart accuracy: variant, pack, flavor and selling plan

**Seed:** `tests/seed.spec.ts`

#### 3.1. 3.1. Citrus Trio subscription (default) lands correctly

**File:** `tests/generated/revitin-buy-box/cart-citrus-trio.spec.ts`

**Steps:**
  1. On /products/revitin-natural-toothpaste/Citrus click the main add button once and wait for the drawer; read /cart.js.
    - expect: One line: title 'Revitin Toothpaste (3 Tubes) - Citrus', sku CITRUS3, quantity 1, price 4200, selling plan 'Delivery every 3 months'.
    - expect: Drawer shows 'Subscription', 'Pack: 3 Tubes', 'Flavor: Citrus', $42 (struck $46 - OBSERVATION O2, record), 'Delivered every 3 months', Subtotal $42; header cart badge is 1.

#### 3.2. 3.2. Mint Family pack with a monthly plan

**File:** `tests/generated/revitin-buy-box/cart-mint-family.spec.ts`

**Steps:**
  1. On /products/revitin-natural-toothpaste/Mint choose the Family card, set its combobox to 'month', verify the main button '$68 — Add to Bag', add to bag.
    - expect: /cart.js: 'Revitin Toothpaste (5 Tubes) - Mint', sku MINT5, price 6800, plan 'Delivery every 1 month with 17.65% discount' (OBSERVATION O3: the PDP promises 20%; record).
    - expect: Drawer: 'Pack: 5 Tubes', 'Flavor: Mint', 'Delivered every month', Subtotal $68; struck price shown is $70 (OBSERVATION O2).

#### 3.3. 3.3. One-time packs map to the right variants and prices

**File:** `tests/generated/revitin-buy-box/cart-one-time-packs.spec.ts`

**Steps:**
  1. For Mint, select One-Time then '3 Tubes', add to cart, read /cart.js and the drawer. Reload (clear the cart first) and repeat for '5 Tubes' and '25 Tubes' (one add per page load).
    - expect: 3 Tubes: 'Revitin Toothpaste (3 Tubes) - Mint', sku MINT3, price 4600, no selling_plan_allocation; drawer 'One-Time Purchase', 'Pack: 3 Tubes', $51 struck / $46, plus the nudge 'Pay $42 for 3 tubes — just $14 each'.
    - expect: 5 Tubes: sku MINT5, price 7000, no plan. 25 Tubes: sku MINT25, price 35000, drawer '$425 / $350' and no subscribe nudge or a different one (record).
    - expect: Single Tube (Citrus): expect sku CITRUS1 at 1700 with no plan; this add was not re-verified live, so record the actual result.

#### 3.4. 3.4. Variety mixes: each mix and purchase type gives the right variant

**File:** `tests/generated/revitin-buy-box/cart-variety.spec.ts`

**Steps:**
  1. On ?pack=variety add the default '2 Citrus & 1 Mint' with Subscribe & Save; read /cart.js and the drawer. Clear, reload, choose '2 Mint & 1 Citrus' and add again.
    - expect: Default: variant 46765298909322, sku VARIETYPACK2C-1M, price 4200, plan 'Delivery every 3 months', title 'Revitin Toothpaste Variety 3 Tubes - Citrus'; drawer line '2 Citrus & 1 Mint', 'Pack: 3 Tubes', 'Flavor: Variety', $46 struck / $42, 'Delivered every 3 months'.
    - expect: Second: variant 46765283049610, sku VARIETYPACK2M-1C, price 4200, drawer '2 Mint & 1 Citrus'. OBSERVATION O8: variant titles end in '- Citrus'/'- Mint' without the mix; the SKU and drawer text must still match the chosen mix.
  2. Clear, reload, click the 'One-time Purchase' label, add the default mix.
    - expect: Same variant (VARIETYPACK2C-1M), price 4600, no selling plan; drawer 'One-Time Purchase', $51 struck / $46, subscribe nudge 'Pay $42 for 3 tubes'.

#### 3.5. 3.5. Travel size lines (Citrus, Mint, Variety)

**File:** `tests/generated/revitin-buy-box/cart-travel.spec.ts`

**Steps:**
  1. Open /products/revitin-natural-toothpaste/Citrus?size=travel and add to bag; read /cart.js and drawer. Clear, then repeat for /Mint?size=travel and for the Variety travel pack (?size=travel&pack=variety), one add per page load.
    - expect: Citrus: 'Citrus Travel 3-Pack of 1oz - Citrus', sku CitrTravel3-pk, variant 46346187341962, price 1800, no plan, drawer 'One-Time Purchase', 'Pack: Citrus Travel 3-Pack of 1oz', nudge 'Pay only $42 for 3 full size tubes.', upsell 'Citrus Full Size $17'.
    - expect: Mint: sku MintTravel3-pk, variant 46346189045898, 1800. Variety: 'Variety Travel 4-Pack of 1 oz', sku VarietyTravel4-pk, variant 47799599759498, 2400, drawer 'Flavor: Variety'.
    - expect: No travel line has a selling plan; the flavor in the drawer matches the chip chosen.

#### 3.6. 3.6. Delivery frequency plan IDs per pack, and PDP vs drawer price maths

**File:** `tests/generated/revitin-buy-box/cart-plan-and-prices.spec.ts`

**Steps:**
  1. On /Citrus select the Trio card, set the combobox to 'month', '2 months', '6 months' in separate page loads (one add each, clearing the cart in between) and read selling_plan ids/names.
    - expect: Plan names 'Delivery every 1 month' (2436038794), 'Delivery every 2 months' (2435973258), '... 6 months' (2436006026); price stays 4200 each time; the drawer shows the matching 'Delivered every ...' text (generic frequency selection is covered elsewhere - here only the id/name/price mapping is checked).
  2. Compare PDP struck/saving values with drawer struck/subtotal values for Trio and Family subscription carts.
    - expect: OBSERVATION O2: PDP says $51 and $85 but the drawer shows $46 and $70. The test should assert the drawer struck price equals the PDP struck price; if it fails, report as a P3 pricing-display inconsistency (do not weaken the assertion).
    - expect: Drawer 'just $13.60 per tube' equals 68/5 and Trio nudge 'just $14 each' equals 42/3.

### 4. 4. Upsell and checkout

**Seed:** `tests/seed.spec.ts`

#### 4.1. 4.1. PDP 'Citrus 3-pack $16 - Add to Bag' upsell: detect and verify

**File:** `tests/generated/revitin-buy-box/pdp-upsell.spec.ts`

**Steps:**
  1. On the default PDP, /Mint, ?pack=variety and ?size=travel, scan the page for a visible upsell card containing 'Citrus 3-pack' and '$16' (text and button 'Add to Bag').
    - expect: OBSERVATION O5: none was found in exploration. If the card is absent, the test records 'PDP upsell not present' as a finding (mark as BAD_TEST_DATA / spec gap) and skips steps 2-3; if present, continue.
  2. If present: click its 'Add to Bag' and stay on the page.
    - expect: URL unchanged (no navigation); /cart.js gains exactly one line for the Citrus 3-pack at the shown price; the original buy box selection is unchanged; cart badge increments.
  3. If present: add the same upsell twice.
    - expect: Quantity becomes 2 on one line (no duplicate lines); price is price x 2.

#### 4.2. 4.2. Drawer cross-flavor upsell adds the correct item without leaving the page

**File:** `tests/generated/revitin-buy-box/drawer-upsell-add.spec.ts`

**Steps:**
  1. Add Mint Trio to the bag. In the drawer's 'You May Also Like' (.cart-upsell-card) read the card, then click 'Add' (this is a light check of the actual upsell that exists; generic card rendering is covered elsewhere).
    - expect: Card reads 'Most Added | Mint Travel 3-Pack of 1oz | $18 | Flavor: Mint | Add'.
    - expect: After Add: URL stays /products/revitin-natural-toothpaste/Mint; /cart.js has 2 lines (MINT3 at 4200 with plan, MintTravel3-pk at 1800); drawer Subtotal $60; the clicked card disappears or is replaced; badge shows 2.

#### 4.3. 4.3. Drawer Checkout reaches the Shopify checkout URL

**File:** `tests/generated/revitin-buy-box/checkout-link.spec.ts`

**Steps:**
  1. Add the default Citrus Trio, open the drawer, click the 'Checkout' link (href /checkout).
    - expect: Browser lands on https://revitin.com/checkouts/cn/<token>/en-us?_r=... with title 'Checkout - Revitin'. STOP: no field is filled, nothing submitted, no payment interaction.
  2. Repeat with a one-time Mint 3 Tubes cart and with a Travel cart (separate page loads).
    - expect: Same checkout URL pattern for each; the checkout page loads without error.
  3. Use browser Back from checkout.
    - expect: Returns to the PDP (or the cart) and /cart.js still contains the item.

### 5. 5. Content: FAQ, ingredients, reviews and content pages

**Seed:** `tests/seed.spec.ts`

#### 5.1. 5.1. PDP FAQ accordion (8 items, independent)

**File:** `tests/generated/revitin-buy-box/pdp-faq.spec.ts`

**Steps:**
  1. Scroll to 'Frequently Asked Questions' and list the buttons.accordion-button.
    - expect: Exactly 8 questions in the verified order ('How is Revitin different from other toothpastes?' ... 'Do you ship internationally?'); all closed (panel height about 57px).
  2. Open item 1, open item 2, then close item 2 (clicking the question each time).
    - expect: Item 1 and 2 are open at the same time (non-exclusive, panel about 118px); closing item 2 leaves item 1 open. Each answer is non-empty, e.g. 'Is Revitin fluoride-free?' -> 'Yes, Revitin is fluoride-free. There are no toxic ingredients in our formula.' and 'What else is Revitin free from?' -> 'Revitin is free from fluoride, SLS, gluten, dyes, peanuts, sugar, xylitol, and GMOs.' (consistent with the 'GLUTEN FREE, FLUORIDE & SLS FREE...' marquee).
    - expect: Record that no aria-expanded attribute exists (OBSERVATION O9) - do not assert it.

#### 5.2. 5.2. Key Ingredients section and link

**File:** `tests/generated/revitin-buy-box/key-ingredients.spec.ts`

**Steps:**
  1. Scroll to the 'Key Ingredients' section.
    - expect: Intro 'Our first-of-its-kind formula is backed by 15 years of clinical research. Here's what goes into it:'; six cards: Vitamin C (Antioxidant), CoQ10 (Anti-inflammatory enzyme), Vitamin D (Mineralization), Cranberry Seed Oil (Prebiotic), Quillaja Saponaria Extract (Lifting agent), Chondrus Crispus (Prebiotic), each with non-empty text and a visible image.
  2. Click the link 'All ingredients'.
    - expect: URL /pages/ingredients, H1 'Revitin Ingredients', H2 'Meet Citrus' and 'Meet Mint' present, no 404.

#### 5.3. 5.3. Review sort: Highest, Lowest, Most Recent, Oldest (read-only)

**File:** `tests/generated/revitin-buy-box/reviews-sort.spec.ts`

**Steps:**
  1. Scroll to 'Customer Reviews'; read the summary and the sort button (do not click 'Write a Review').
    - expect: Heading '4.6', '1,139 Reviews', distribution 923/80/60/28/48 sums to 1139; 20 article.jm-card cards; sort button text 'Highest Rating'. OBSERVATION O1: the top badge says '881 reviews' - the test logs both numbers and flags if the product intends one total.
  2. For each option 'Lowest Rating', 'Most Recent', 'Oldest', 'Highest Rating': open the sort list (only if it is closed), click the li, wait for the list to refresh, then read star counts (svg.jm-star with style opacity 1) and .jm-card-date of the first 6 cards.
    - expect: Lowest Rating: star counts are non-decreasing across the first 40 cards (1,1,...,2,...,3,...,4,...,5). Highest Rating: all first cards 5 stars. Most Recent: dates non-increasing (10/13/26 first). Oldest: dates non-decreasing (06/18/26 first). Button label updates to the chosen option; no navigation; card count stays 20.

#### 5.4. 5.4. Reviews 'Load More' (read-only) and review card content

**File:** `tests/generated/revitin-buy-box/reviews-load-more.spec.ts`

**Steps:**
  1. Click 'Load More' once.
    - expect: Card count goes from 20 to 40; 'Load More' remains; the page does not jump to top; sort order of the first 20 is unchanged.
  2. Inspect cards.
    - expect: Every card has a date (MM/DD/YY), a name, 'Verified by shop', a non-empty body and exactly five stars with a consistent filled/empty pattern. Never click vote/upload/'Write a Review'/'Submit Review'.

#### 5.5. 5.5. Payment-installment (Afterpay) messaging

**File:** `tests/generated/revitin-buy-box/afterpay.spec.ts`

**Steps:**
  1. Load the PDP and the default buy box; look for afterpay-placement, klarna-placement, square-placement, shopify-payment-terms elements and visible text 'Afterpay' / 'installments' near the price.
    - expect: Verified 2026-10-13: 0 such elements and no text (only a generic script handler exists). The test asserts the current absence by logging it; if a placement appears later, assert it shows an amount consistent with the main price ($42 / 4 = $10.50 etc.) and updates when the pack changes.

#### 5.6. 5.6. Content pages load with a heading and no 404

**File:** `tests/generated/revitin-buy-box/content-pages.spec.ts`

**Steps:**
  1. Visit /pages/about, /pages/ingredients, /pages/faqs, /pages/wholesale, /pages/press and /blogs/all one at a time with a pause between navigations.
    - expect: Each returns 200 with the expected title: 'About Revitin® | Meet Dr. Gerry Curatola, Our Founder', 'Revitin Ingredients | What's in Our Prebiotic Toothpaste', 'Revitin | FAQS', 'Revitin Wholesale Program', 'Revitin Press Coverage & Media Mentions', 'Revitin | All'; none has a 404/not-found title or body.
    - expect: Headings: ingredients H1 'Revitin Ingredients'; wholesale H1 'Revitin Wholesale Program'; press H1 'Press & Media'; blogs H1 'Discover the Science of Prebiotic Oral Care' with at least four article H2s; faqs has H2 'Ingredients', 'Product', 'Orders, Shipping & Returns', 'Subscriptions' (no H1 - OBSERVATION O9); about has H2 'Microbes are necessary for oral health' (its H1s are marquee 'GLUTEN FREE' text - record, do not assert H1 text).
    - expect: Do not submit the forms on /pages/wholesale, /pages/faqs, /pages/press or /blogs/all.
  2. From the footer click 'Meet Dr. Gerry' and 'The Science'.
    - expect: 'Meet Dr. Gerry' -> /pages/about/#meet-dr-gerry and the element with id meet-dr-gerry exists; 'The Science' -> /blogs/all.

### 6. 6. Mobile (390x844) buy box

**Seed:** `tests/seed.spec.ts`

#### 6.1. 6.1. Buy box layout and tap targets at 390x844

**File:** `tests/generated/revitin-buy-box/mobile-layout.spec.ts`

**Steps:**
  1. Set the viewport to 390x844, open /products/revitin-natural-toothpaste and wait 3s for popups to be closed by the fixture.
    - expect: document.documentElement.scrollWidth <= 390 (no horizontal scroll).
    - expect: Size tabs, flavor chips, pack cards and main button are fully inside the viewport width; tap targets are at least 44px high (observed tabs 46, chips 50, cards 87-92, button 48); controls do not overlap each other.
  2. Tap Mint, Travel Size, Full Size, then pick Family and One-Time 3 Tubes (waiting for URL changes).
    - expect: Same selection and price behaviour as desktop ($42 / $68 / $46; /Mint?size=travel at $18).

#### 6.2. 6.2. No sticky add-to-cart on mobile; main button remains reachable

**File:** `tests/generated/revitin-buy-box/mobile-sticky-atc.spec.ts`

**Steps:**
  1. Scroll the mobile PDP to y=0, 800, 1300, 2500 and 4000 and look for position:fixed/sticky elements near the bottom of the viewport.
    - expect: Verified 2026-10-13: no sticky add-to-cart bar exists; only the Podium chat iframe is fixed. Assert that the main button (button.main__atc__button, 350x48, static) is the only add-to-cart control and that the chat launcher does not cover it when scrolled into view. If a sticky bar is added later, assert it shows the current pack price and adds the same variant.

#### 6.3. 6.3. Mobile add to cart, drawer and checkout link visibility

**File:** `tests/generated/revitin-buy-box/mobile-drawer.spec.ts`

**Steps:**
  1. At 390x844 tap '$42 — Add to Bag' once.
    - expect: Drawer opens full screen (390x844) with the Citrus Trio line, quantity controls and Subtotal $42; no horizontal scroll (scrollWidth 390).
  2. Inspect the Checkout link without activating it, then (optionally) tap it.
    - expect: 'Checkout' link (href /checkout) is inside the viewport (observed y 742-790, 350px wide) and not covered by the chat iframe; if tapped, the URL becomes /checkouts/cn/<token>/en-us and the test stops.
