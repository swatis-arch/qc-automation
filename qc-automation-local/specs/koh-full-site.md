# Kreatures of Habit (KOH) - Whole-Site Test Plan (excluding collections)

## Application Overview

Whole-site functional plan for https://kreaturesofhabit.com (Playwright project `koh-desktop-chromium`, seed `tests/seed.spec.ts`, merchant data `merchants/koh/config.js` and `locators.js`). Explored live on 2026-10-15.

OUT OF SCOPE: everything under /collections/* (owned by the client). No scenario below visits or asserts on a collection page.

GLOBAL RULES (apply to every scenario)
- Starting state is always fresh (new browser context, empty cart). If a scenario needs a clean cart, call POST /cart/clear.js first.
- NEVER submit any form (contact, newsletter, wholesale, login, account, Klaviyo popup buttons MORNINGS/3PM/BOTH). NEVER place an order. Checkout scenarios STOP at the Shopify checkout URL (`/checkouts/cn/...`).
- A Klaviyo popup appears a few seconds after load (body class `klaviyo-prevent-body-scrolling`) and blocks clicks. Close it with the "Close dialog" button (locator `popupClose`) before interacting. The `popupGuard` fixture does this automatically.
- /cart redirects to `/?cart=open` (drawer only, there is no cart page).
- The cart drawer is `<ns-hybrid-cart>` with an open shadow root; `#ns-hybrid-cart` is the role=dialog inside it. Playwright locators pierce it; page.evaluate code must go through `document.querySelector('ns-hybrid-cart').shadowRoot`.
- Automation hazard (see O12): drawer +/-/remove buttons and the PDP `.pfp__atc` click never satisfy Playwright "stable"/navigation waits. Use `click({ force: true, noWaitAfter: true })` followed by an expect-poll on the drawer text, not fixed sleeps.
- Use the `fixtures/base` `{ test, expect }`, the `merchant` fixture and page objects; keep URLs, handles and prices in `merchants/koh/config.js`. Console-error assertions must ignore the known third-party noise listed in O3 and O14 (or assert it as a documented known-issue), otherwise they fail on every page.
- Tag 1-3 critical tests per suite with `{ tag: '@smoke' }`.

KEY LIVE FACTS (verified 2026-10-15)
- Meal One (/products/meal-one-v2): one box = $39.99 one-time, $23.59 subscription (39.99 x 0.59 = 23.594), 7 meals/box, 8 flavors with steppers, 2-box minimum, "Can add up to 20 boxes", frequency options 15/30/45/60 days, free shipping on 3+ boxes, free Kreatures Glass Mug with a subscription. Accordions: HOW TO PREPARE, WHAT'S INSIDE EACH BOX, REVIEWS & RATINGS.
- Daily Bar (/products/daily-bar): $39.99 / $23.59 per box, 12 bars/box, 4 flavors (Variety Pack, Blueberry Cream Cruncher, Peanut Butter Banger, Cookie Dough Dazzler), subscribe copy "41% off first order - 10% off recurring". Clicking ADD TO CART in subscribe mode opens `.pfp-gift-modal` ("Free gift unlocked", buttons "Add Kreatures Glass Mug" / "Skip for now").
- Bundle builder (/pages/bundle-builder): h1 "BUNDLE & SAVE", 12 steppers (Meal One 8 + Protein Bar 4), "MINIMUM 2 PRODUCTS", mixed Meal One + Bar boxes count together (2 boxes = $79.98 / $47.18, 3 boxes = $119.97 / $70.77).
- Cart drawer: header "Your cart (N)" (N = total quantity), progress text "Only $X left to get free shipping!" (one-time, threshold $119) or "Add 1 more to get free shipping!" (subscription builder boxes, 3+ boxes), "Congratulations! You have free shipping!" once met, "Your Free Gifts" group with the Glass Mug ("Add a subscription to unlock your free gift!" until a subscription line exists, then "Unlocked!"), per-line frequency `<select>` (One-time/15/30/45/60 days) only on subscription-capable lines, Subtotal block with "Discount $X off", CHECKOUT link `a[href="/checkout"]`. Empty state: "Your cart is empty" + "Continue Shopping" -> /pages/bundle-builder.
- Simple PDPs: black-hoodie $45.00 (XS,S,M,L available, XL sold out), oatmeal-hoodie same, beanie $25.00, koh-new-york-colorway-snapback $22.50 sale / $45.00 compare-at (Sale badge), glass-cup $0.00.
- Header (desktop): logo, OVERNIGHT OATS, PROTEIN BAR, BUNDLE & SAVE, NOW AT SPROUTS, SHOP NOW (->/pages/bundle-builder), "Log in" (->/a/account/login), Cart button. A SLEEP link exists in the DOM but is display:none (excluded).
- Footer: SHOP (MEAL ONE, DAILY BAR, BUNDLE & SAVE), HELP (FAQS, CONTACT US, SHIPPING POLICY, REFUND POLICY), COMPANY (ABOUT, HABIT LAB BLOG, PODCAST, WHOLESALE), legal row (Refund policy, Privacy policy, Terms of service, Shipping policy), socials Facebook/Instagram/TikTok, copyright link to "/".

==================================================================
LIVE OBSERVATIONS (all seen in the browser on 2026-10-15; "Confirmed" = reproduced/seen, "Suspected" = seen but intent uncertain)
==================================================================

O1 - Store locator map fails to load [Confirmed]
URL: https://kreaturesofhabit.com/pages/stores
Steps: open the page, wait ~4 s.
Saw: Google Maps overlay "This page can't load Google Maps correctly. Do you own this website?" with OK button; list shows "No locations found - Try adjusting your search or filters". Console error: "Google Maps JavaScript API error: BillingNotEnabledMapError" (key in maps.googleapis.com/maps/api/js?...libraries=places,geometry).
Expected: working map and a list of Sprouts locations (this is the "NOW AT SPROUTS" nav destination).

O2 - Zigpoll quota error in console [Confirmed]
URLs: https://kreaturesofhabit.com/pages/stores and https://kreaturesofhabit.com/pages/zzz-not-real
Steps: load either page, read console.
Saw: "[Zigpoll] Error: Response limit has been reached. Please upgrade your plan to resume access to Zigpoll." (cdn.zigpoll.com/static/js/main.js).
Expected: no console errors from live third-party widgets.

O3 - Console errors on the homepage (and most pages) [Confirmed]
URL: https://kreaturesofhabit.com/
Steps: load the page, read console (errors).
Saw: (a) "ReferenceError: TriplePixel is not defined" from GTM container GTM-TTTXR9CJ; (b) "Unexpected token '<', "<!doctype "... is not valid JSON" (a JSON request returns an HTML page); (c) "NetworkError: Failed to execute 'importScripts' ... analytics.tiktok.com/i18n/pixel/shopify.js ... failed to load" from the Shopify web-pixel worker. Also warnings: sandboxed addEventListener, PayPal "Allow attribute will take precedence over 'allowpaymentrequest'".
Expected: zero console errors on the homepage.

O4 - Missing / wrong h1 on content pages [Confirmed in served HTML]
URLs: https://kreaturesofhabit.com/ (h1 contains only the logo link/image, no text), /pages/faqs, /pages/contact, /pages/stores, /pages/podcast, /pages/ws-account-create (no h1 in server HTML), /pages/about-us (h1 text is "About Us | Kreatures of Habit | Health and Wellness", i.e. the SEO title, not a heading).
Steps: GET each URL, query `h1`.
Expected: one meaningful visible h1 per page (accessibility/SEO).

O5 - Builder price card shows "2 BOXES" but the price of one box before any selection [Confirmed]
URLs: https://kreaturesofhabit.com/products/meal-one-v2, /products/daily-bar, /pages/bundle-builder
Steps: load the page with 0 boxes selected and read the purchase cards.
Saw: Meal One: "Subscribe & Save $39.99 $23.59 2 BOXES - 14 meals $3.37/meal" and "One-Time $39.99 2 BOXES - 14 meals $5.71/meal" (prices and $/meal are for 1 box = 7 meals). Daily Bar: "$39.99 ... 2 BOXES - 24 bars $3.33/bar" (39.99/12 = 3.33, i.e. 1 box). After adding 1 box the label becomes "1 BOX - 7 meals $39.99"; with 2 boxes it becomes $79.98. Bundle builder shows "0 Boxes $39.99".
Expected: label and price describe the same quantity (either "1 box - 7 meals $39.99" or "2 boxes - 14 meals $79.98").

O6 - One-cent rounding differences in subscription price [Suspected]
URL: https://kreaturesofhabit.com/products/meal-one-v2 (same on bundle builder)
Steps: add 2 boxes, then 3 boxes in subscribe mode.
Saw: 2 boxes $79.98 -> $47.18; 3 boxes $119.97 -> $70.77. 41% off exactly gives 47.188 -> $47.19 and 70.782 -> $70.78; site shows 3 x $23.59 (per-box rounded). Cart drawer is consistent with this ($94.36 for 4 boxes, 117.95 for 5).
Expected: either documented per-unit rounding or exact 41% of the total. Tests should assert price = boxes x 23.59 (+/- $0.01) and never exact 59% of total.

O7 - Inconsistent discount formatting in cart drawer [Confirmed]
URL: https://kreaturesofhabit.com/products/meal-one-v2 (add 5 subscription boxes, open drawer)
Saw: line discount "$32.80 off" and subtotal discount "$65.60 off" with 2 decimals, but the subtotal discount for 5 boxes reads "$82 off" (no decimals). Beanie subtotals also render "$25", "$125" without ".00".
Expected: consistent currency formatting ($82.00 off / $25.00).

O8 - Two different login pages and duplicate account links [Confirmed]
URLs: https://kreaturesofhabit.com/a/account/login (Skio "Welcome! Access your account..." with email + "Get login code") and https://kreaturesofhabit.com/account/login (classic Shopify "Login or Email / Password / Forgot your password? / Sign in" plus a contact form with email field).
Steps: open the mobile menu (390 px): it lists both "My Account" -> /a/account/login and "Log in" -> /account/login. Desktop header "Log in" -> /a/account/login.
Expected: a single account entry point; mobile menu should not show two different login destinations.

O9 - Unknown page returns a real 404, unknown product soft-redirects [Confirmed]
URLs: https://kreaturesofhabit.com/pages/zzz-not-real (HTTP 404, title "404 Not Found", h1 "Page not found") vs https://kreaturesofhabit.com/products/zzz-not-a-real-product (301/redirect to https://kreaturesofhabit.com/ , 200, homepage, no message).
Note: merchants/koh/config.js comment says unknown /products/* AND /pages/* 301 to /; live, only /products/* does. Update the comment/test.
Expected: consistent, user-visible not-found handling.

O10 - Images without alt attribute [Confirmed]
URLs: https://kreaturesofhabit.com/ (9 of 72 `<img>` have no alt attribute), https://kreaturesofhabit.com/pages/faqs (2 in main content).
Steps: query `img:not([alt])`.
Expected: every img has an alt (empty alt for decorative).

O11 - Conflicting social-proof numbers on the homepage [Suspected]
URL: https://kreaturesofhabit.com/
Saw: hero link "4.7 stars | 58,100+ Happy Customers" while the stats band says "91K+ CUSTOMERS" and "2103 5-STAR REVIEWS"; PDP shows "639 Reviews" for Meal One and "156 Reviews" for Daily Bar.
Expected: consistent claims (confirm with the client; may be different metrics).

O12 - Add to cart / drawer buttons are not Playwright-stable [Confirmed, automation hazard]
URLs: https://kreaturesofhabit.com/products/meal-one-v2 and drawer.
Steps: `page.locator('.pfp__atc').click()` times out at "waiting for scheduled navigations to finish"; `#ns-hybrid-cart button[aria-label="plus"|"minus"|"remove"]` `.click()` times out at "waiting for element to be visible, enabled and stable" even though the action works. `click({ force: true, noWaitAfter: true })` works. Same for `.pfp__stepper-plus` (works with force).
Expected: n/a (site behaves); record so generated tests use the working pattern.

O13 - Cart header count/subtotal lag after remove [Suspected]
URL: https://kreaturesofhabit.com/products/meal-one-v2
Steps: cart with Strawberry x1, Apple x1, Maple x2 (cart 4, $94.36); remove the Apple row; read the drawer 3 s later.
Saw: rows reduced to 2 but header still "Your cart (4)" and subtotal $94.36 (later correct "(2)" / $47.18 after the next removal). Possibly just >3 s latency.
Expected: header/subtotal update with the line removal. Tests must poll (expect.poll) rather than read once.

O14 - Report-only CSP error on every page [Confirmed]
URLs: all pages (seen on blog article, 404 page, product pages)
Saw: console error "Framing 'https://pay.google.com/' violates the following report-only Content Security Policy directive: frame-ancestors ...".
Expected: no console errors.

O15 - Free-gift product is a normal, purchasable PDP [Confirmed seen, business risk Suspected]
URL: https://kreaturesofhabit.com/products/glass-cup
Saw: "Kreatures Glass Mug" at "Regular price $0.00 USD" with an enabled "Add to cart" button, reachable by URL (and in sitemap/products JSON). Do NOT add it to the cart in tests beyond verifying the button is present and enabled.
Expected: confirm with the client that a $0 mug can be added by anyone without a subscription.

O16 - Hidden SLEEP product link still in nav and meta [Confirmed]
URL: https://kreaturesofhabit.com/
Saw: header contains `a[href="/products/kreatures-sleep-v2"]` (display:none) and the meta description still advertises "KREATURE'S SLEEP"; /products/kreatures-sleep-v2 redirects (no PDP).
Expected: no dead product in the DOM/meta; excluded from navLinks tests.

Verified OK (no defect seen): all nav, footer and CTA hrefs return 200 (meal-one-v2, daily-bar, bundle-builder, stores, faqs, contact, about-us, podcast, habit-lab, ws-account-create, 4 policies, 5 simple products); no broken (naturalWidth=0) images on the homepage or black-hoodie; no horizontal overflow at 390 px on /, both PDPs, bundle builder, hoodie, faqs, stores, about, contact, blog (the only elements wider than the viewport are the off-canvas `#menu-drawer` items); 41% math on single boxes ($39.99 -> $23.59, $16.40 off); drawer discount sums ($32.80 + $16.40 x 2 = $65.60), subtotal 4 boxes $94.36 and 5 boxes $117.95; one-time threshold ($25 -> "Only $94 left"; $100 -> $19 left; $125 -> Congratulations); FAQ page has 52 `[data-faq-button]` accordions collapsed by default (aria-expanded false -> true on click); checkout link reaches `https://kreaturesofhabit.com/checkouts/cn/<token>/en-us?...` (title "Checkout - Kreatures of Habit"); black-hoodie XL radio is disabled and selecting its variant URL shows a disabled "Sold out" button.

## Test Scenarios

### 1. 1. Homepage

**Seed:** `tests/seed.spec.ts`

#### 1.1. 1.1 Homepage renders hero, announcement bar and key sections

**File:** `tests/generated/koh-full-site/1-homepage.spec.ts`

**Steps:**
  1. Navigate to / and close the Klaviyo popup if shown
    - expect: Title is 'Kreatures of Habit - Wellness Solutions For Healthy Habits'
    - expect: Announcement bar reads 'SAVE 41% ON FIRST-TIME SUBSCRIPTION ORDERS' and links to /pages/bundle-builder
  2. Read the h2 headings
    - expect: Headings include 'HIGH-PROTEIN OVERNIGHT OATS. CREATINE PROTEIN BARS.', 'WAKE UP TO WIND DOWN. WE GOT YOU.', 'NUTRITION & INGREDIENTS', 'HOW THE HABIT WORKS.', "DON'T TAKE OUR WORD FOR IT", 'Where you can find us!', 'Stay Connected with Us!'"
    - expect: Page has no horizontal scroll (scrollWidth <= innerWidth)

#### 1.2. 1.2 Every homepage CTA points to a live page

**File:** `tests/generated/koh-full-site/1-homepage.spec.ts`

**Steps:**
  1. Collect all `main a` hrefs (SAVE 41% + FREE GIFT, SHOP MEAL ONE, SHOP BAR, BUNDLE & SAVE, READ MICHAEL'S STORY, SHOP NOW x5, SUBSCRIBE & SAVE 41%, TRY A ONE-TIME ORDER, #reviwes-home-show)
    - expect: Hrefs are limited to /products/meal-one-v2, /products/daily-bar, /pages/bundle-builder, /pages/about-us and the in-page anchor #reviwes-home-show
  2. Request each unique internal href with the page request fixture
    - expect: Each returns HTTP 200
  3. Click SHOP MEAL ONE and go back, click SHOP BAR and go back
    - expect: URLs become /products/meal-one-v2 and /products/daily-bar respectively

#### 1.3. 1.3 Homepage images load and have alt text

**File:** `tests/generated/koh-full-site/1-homepage.spec.ts`

**Steps:**
  1. Scroll the full page to trigger lazy loading, then count img elements with complete=true and naturalWidth=0
    - expect: Zero broken images (72 images present)
  2. Count img elements without an alt attribute
    - expect: Known defect O10: 9 images lack alt. Assert and report; do not weaken to pass

#### 1.4. 1.4 Homepage console is free of site-owned errors

**File:** `tests/generated/koh-full-site/1-homepage.spec.ts`

**Steps:**
  1. Attach a console listener, load /, wait for networkidle and ~6 s
    - expect: No uncaught errors from kreaturesofhabit.com scripts
    - expect: Known third-party errors O3 (TriplePixel, JSON '<!doctype', TikTok importScripts) and O14 (CSP frame-ancestors) are the only errors; any new error fails the test

#### 1.5. 1.5 Klaviyo popup can be closed without signing up

**File:** `tests/generated/koh-full-site/1-homepage.spec.ts`

**Steps:**
  1. Load / and wait until body has class klaviyo-prevent-body-scrolling
    - expect: Popup 'Get your mornings back.' is visible with Close dialog button
  2. Click only 'Close dialog' (never MORNINGS / 3PM / BOTH)
    - expect: Popup is hidden, body class removed, page is clickable and scrolls

### 2. 2. Header and navigation

**Seed:** `tests/seed.spec.ts`

#### 2.1. 2.1 Desktop header shows logo, 4 nav links, SHOP NOW, Log in and Cart

**File:** `tests/generated/koh-full-site/2-header-navigation.spec.ts`

**Steps:**
  1. Open / and inspect `header`
    - expect: Logo img (alt 'Kreatures of Habit') links to /
    - expect: Visible nav links: OVERNIGHT OATS, PROTEIN BAR, BUNDLE & SAVE, NOW AT SPROUTS
    - expect: SLEEP link exists but is not visible (O16)
    - expect: SHOP NOW, 'Log in' and a Cart button are visible

#### 2.2. 2.2 Each nav link reaches its page

**File:** `tests/generated/koh-full-site/2-header-navigation.spec.ts`

**Steps:**
  1. For each of config.navLinks click the header link from /
    - expect: OVERNIGHT OATS -> /products/meal-one-v2 (h1 'MEAL ONE.')
    - expect: PROTEIN BAR -> /products/daily-bar (h1 'THE DAILY BAR.')
    - expect: BUNDLE & SAVE -> /pages/bundle-builder (h1 'BUNDLE & SAVE')
    - expect: NOW AT SPROUTS -> /pages/stores (h2 'Find Daily Bar at Your Local Sprouts')
  2. Click the logo from /pages/stores
    - expect: Navigates to /

#### 2.3. 2.3 SHOP NOW and announcement bar go to the bundle builder

**File:** `tests/generated/koh-full-site/2-header-navigation.spec.ts`

**Steps:**
  1. Click header SHOP NOW, then go back and click the announcement bar
    - expect: Both land on /pages/bundle-builder

#### 2.4. 2.4 Cart icon opens the drawer and account link goes to the login page

**File:** `tests/generated/koh-full-site/2-header-navigation.spec.ts`

**Steps:**
  1. Click the Cart button on / with an empty cart
    - expect: Drawer opens with 'Your cart (0)', 'Your cart is empty' and 'Continue Shopping' -> /pages/bundle-builder
    - expect: Close cart button closes it (body loses ns-hybrid-cart-open)
  2. Click the header 'Log in' link (do not enter data)
    - expect: URL is /a/account/login

#### 2.5. 2.5 Visiting /cart opens the drawer

**File:** `tests/generated/koh-full-site/2-header-navigation.spec.ts`

**Steps:**
  1. Navigate to /cart
    - expect: Redirects to /?cart=open and the drawer is open showing the empty state

### 3. 3. Footer

**Seed:** `tests/seed.spec.ts`

#### 3.1. 3.1 Footer link groups and labels are present

**File:** `tests/generated/koh-full-site/3-footer.spec.ts`

**Steps:**
  1. Open / and scroll to the footer
    - expect: SHOP: MEAL ONE, DAILY BAR, BUNDLE & SAVE
    - expect: HELP: FAQS, CONTACT US, SHIPPING POLICY, REFUND POLICY
    - expect: COMPANY: ABOUT, HABIT LAB BLOG, PODCAST, WHOLESALE
    - expect: Legal row: Refund policy, Privacy policy, Terms of service, Shipping policy
    - expect: Copyright link 'Kreatures of Habit' -> /

#### 3.2. 3.2 Every internal footer link resolves with HTTP 200

**File:** `tests/generated/koh-full-site/3-footer.spec.ts`

**Steps:**
  1. Collect all `footer a` hrefs, resolve relative ones against the base URL, de-duplicate
    - expect: Internal targets /products/meal-one-v2, /products/daily-bar, /pages/bundle-builder, /pages/faqs, /pages/contact, /pages/about-us, /blogs/habit-lab, /pages/podcast, /pages/ws-account-create and the 4 /policies/* all return 200 (none 404)

#### 3.3. 3.3 Social links have valid external hrefs

**File:** `tests/generated/koh-full-site/3-footer.spec.ts`

**Steps:**
  1. Read hrefs of Facebook, Instagram, TikTok footer links
    - expect: https://www.facebook.com/OfficialKreaturesofHabit
    - expect: https://www.instagram.com/kreaturesofhabit/
    - expect: https://www.tiktok.com/@kreaturesofhabit
    - expect: Links open in a new tab or same tab; do not follow them (external sites)

#### 3.4. 3.4 Footer newsletter block renders but is never submitted

**File:** `tests/generated/koh-full-site/3-footer.spec.ts`

**Steps:**
  1. Locate the 'Stay Connected with Us!' / 'Let's Get in Touch!' sections and any email input
    - expect: Heading and input (if any) are visible and enabled
    - expect: Do not type or submit; assert no network request to the subscribe endpoint is made

### 4. 4. Meal One PDP (bundle builder)

**Seed:** `tests/seed.spec.ts`

#### 4.1. 4.1 Meal One PDP initial state and gallery

**File:** `tests/generated/koh-full-site/4-meal-one-pdp.spec.ts`

**Steps:**
  1. Open /products/meal-one-v2 and wait for `.pfp__atc`
    - expect: h1 'MEAL ONE.'; title contains 'MEAL ONE'
    - expect: `.pfp__atc` text is 'PLEASE ADD 2 BOXES'
    - expect: 8 flavor rows (Maple Caramel, Apple Cinnamon, Strawberry Walnut Cream, Peanut Butter Banana, Chocolate, Vanilla, ...) each with quantity 0, '-' stepper disabled
    - expect: 3 gallery thumbnails (`button.pfp__thumb`); zoom button opens `.koh-pswp` and closes with Escape
    - expect: Known issue O5 on the 0-box card label

#### 4.2. 4.2 Two-box minimum and stepper behaviour

**File:** `tests/generated/koh-full-site/4-meal-one-pdp.spec.ts`

**Steps:**
  1. Click first flavor '+' once (use force + noWaitAfter)
    - expect: Button text 'PLEASE ADD 1 BOX'; cards say '1 BOX - 7 meals', $39.99 / $23.59
  2. Click the same '+' again
    - expect: Button becomes 'ADD TO CART'; cards show 2 BOXES, $79.98 / $47.18
  3. Click '-' once
    - expect: Back to 'PLEASE ADD 1 BOX'; attempting ADD TO CART at 1 box does nothing (drawer stays closed, cart count unchanged)
  4. Add boxes across different flavors (flavor 1 x2, flavor 2 x1, flavor 3 x1)
    - expect: Totals sum across flavors: 4 BOXES - 28 meals, $159.96 / $94.36
  5. Keep clicking '+' toward the maximum (boundary)
    - expect: Copy says 'Can add up to 20 boxes'; at 20 the '+' stops incrementing (boundary, report actual behaviour)

#### 4.3. 4.3 Subscribe vs one-time pricing and 41% discount math

**File:** `tests/generated/koh-full-site/4-meal-one-pdp.spec.ts`

**Steps:**
  1. With 2 boxes selected read subscribe and one-time prices
    - expect: One-time $79.98; subscribe $47.18 (2 x $23.59)
    - expect: Each subscribe box = round(39.99 x 0.59, 2) = $23.59, i.e. 41% off; assert within +/- $0.01 (O6)
    - expect: $/meal one-time 79.98/14 = $5.71; subscribe $3.37
  2. Click the One-Time Purchase card head (`[data-pfp-purchase-select]`), then the Subscribe card head
    - expect: aria-pressed toggles between cards; ATC remains enabled; selected card is highlighted
  3. Open `select.pfp__delivery-select` and read options
    - expect: Options: DELIVERED EVERY 15, 30, 45, 60 DAYS; selecting 45 changes the value; default is 30 days (cart line later shows 'Every 30 days')

#### 4.4. 4.4 Free gift messaging and Add to cart (subscription)

**File:** `tests/generated/koh-full-site/4-meal-one-pdp.spec.ts`

**Steps:**
  1. Read subscribe card benefits
    - expect: '41% off first order', 'Free Gift with your subscription', 'Free Shipping on 3+ Boxes', 'Pause, Skip, Or Cancel Anytime'; one-time card says 'Free Shipping on 3+ Boxes'
  2. Select 3 boxes in subscribe mode and click ADD TO CART
    - expect: Drawer (`#ns-hybrid-cart`) opens with 'Your cart (3)', lines per flavor with 'Every 30 days', sale price $23.59 and original $39.99, 'Discount $16.40 off'
    - expect: 'Your Free Gifts' shows Kreatures Glass Mug, 'with subscription', 'Unlocked!', FREE
    - expect: Subtotal = 3 x 23.59 = $70.77; 'Congratulations! You have free shipping!'

#### 4.5. 4.5 One-time add to cart has no gift and no frequency

**File:** `tests/generated/koh-full-site/4-meal-one-pdp.spec.ts`

**Steps:**
  1. Clear cart, choose 2 boxes, select One-Time Purchase, click ADD TO CART
    - expect: Drawer lines show $39.99 each (no sale/original pair), no 'Every N days'
    - expect: Header says 'Add 1 more'/'Only $X left to get free shipping' per drawer rules; gift row shows 'Add a subscription to unlock your free gift!'
    - expect: Subtotal = $79.98

#### 4.6. 4.6 PDP accordions and reviews

**File:** `tests/generated/koh-full-site/4-meal-one-pdp.spec.ts`

**Steps:**
  1. Click each `summary.pfp__accordion-header` (HOW TO PREPARE, WHAT'S INSIDE EACH BOX, REVIEWS & RATINGS)
    - expect: Each `<details>` opens with non-empty content and closes on second click
  2. Scroll to 'Customer reviews' and click 'See more reviews' (Junip)
    - expect: Review list renders; more reviews load; no navigation away

### 5. 5. Daily Bar PDP

**Seed:** `tests/seed.spec.ts`

#### 5.1. 5.1 Daily Bar PDP initial state

**File:** `tests/generated/koh-full-site/5-daily-bar-pdp.spec.ts`

**Steps:**
  1. Open /products/daily-bar
    - expect: h1 'THE DAILY BAR.', title contains 'DAILY BAR'
    - expect: 4 flavor steppers: Variety Pack, Blueberry Cream Cruncher, Peanut Butter Banger, Cookie Dough Dazzler
    - expect: ATC reads 'PLEASE ADD 2 BOXES'; accordions HOW TO PREPARE / WHAT'S INSIDE EACH BOX / REVIEWS & RATINGS
    - expect: Known issue O5: label '2 BOXES - 24 bars' with $39.99

#### 5.2. 5.2 Two-box minimum, 12 bars per box and price math

**File:** `tests/generated/koh-full-site/5-daily-bar-pdp.spec.ts`

**Steps:**
  1. Add 1 box then 2 boxes of Variety Pack
    - expect: 1 box: 'PLEASE ADD 1 BOX'; 2 boxes: 'ADD TO CART', 24 bars, one-time $79.98 ($3.33/bar), subscribe $47.18 ($1.97/bar)
  2. Read subscription copy
    - expect: '41% off first order - 10% off recurring', free gift and free shipping messaging; one-time card says '3+ Boxes Unlocks Free Shipping'

#### 5.3. 5.3 Gift modal appears on subscription Add to cart

**File:** `tests/generated/koh-full-site/5-daily-bar-pdp.spec.ts`

**Steps:**
  1. Before clicking ATC, check `.pfp-gift-modal`
    - expect: Modal exists but is hidden (opacity 0, no is-open class)
  2. Select 2 boxes, subscribe mode, click ADD TO CART
    - expect: `.pfp-gift-modal.is-open` shows 'Free gift unlocked', 'Pick a free gift, on us. Choose One:', Kreatures Glass Mug, buttons 'Add Kreatures Glass Mug' and 'Skip for now', and a close (x)
  3. Click 'Add Kreatures Glass Mug'
    - expect: Modal closes; drawer opens with The Daily Bar line ($47.18 / $79.98 original, Discount $32.80 off) and 'Your Free Gifts' Glass Mug 'Unlocked!'

#### 5.4. 5.4 Gift modal Skip and close

**File:** `tests/generated/koh-full-site/5-daily-bar-pdp.spec.ts`

**Steps:**
  1. Clear cart; repeat subscription ATC and click 'Skip for now'
    - expect: Modal closes; drawer opens; Daily Bar line present; record whether the mug row is auto-added (Meal One added it automatically) and assert the actual, consistent behaviour
  2. Repeat and click the modal close (x)
    - expect: Modal closes without errors; cart still contains the bar

#### 5.5. 5.5 One-time Daily Bar does not open the gift modal

**File:** `tests/generated/koh-full-site/5-daily-bar-pdp.spec.ts`

**Steps:**
  1. Select One-Time Purchase, 2 boxes, ADD TO CART
    - expect: Gift modal stays hidden; drawer opens with $39.99 per box lines and subtotal $79.98

### 6. 6. Bundle builder page

**Seed:** `tests/seed.spec.ts`

#### 6.1. 6.1 Bundle builder initial state

**File:** `tests/generated/koh-full-site/6-bundle-builder.spec.ts`

**Steps:**
  1. Open /pages/bundle-builder
    - expect: Title 'Kreatures of Habit | MEAL ONE & DAILY BAR | Bundle Builder'; h1 'BUNDLE & SAVE'; 'MINIMUM 2 PRODUCTS'; '1. ADD TWO BOXES OR MORE'; '2. PURCHASE TYPE'
    - expect: Groups 'Protein Bar' (4 steppers) and 'Meal One' (8 steppers); button 'PLEASE ADD 2 BOXES'
    - expect: Cards show '0 Boxes' with $39.99 / $23.59 (O5)

#### 6.2. 6.2 Mixed Meal One + Protein Bar boxes satisfy the 2-box minimum

**File:** `tests/generated/koh-full-site/6-bundle-builder.spec.ts`

**Steps:**
  1. Click '+' on the first Meal One flavor, then on a Protein Bar flavor
    - expect: After 1 box: 'PLEASE ADD 1 BOX', 1 Box $39.99 / $23.59
    - expect: After 2 boxes (1+1): 'ADD TO CART', 2 Boxes $79.98 / $47.18
  2. Add a third box
    - expect: 3 Boxes $119.97 / $70.77 (3 x 23.59); 'Free Shipping on 3+ Boxes' still shown

#### 6.3. 6.3 Frequency and purchase type selection

**File:** `tests/generated/koh-full-site/6-bundle-builder.spec.ts`

**Steps:**
  1. Read and change `select.pfp__delivery-select`
    - expect: Options every 15/30/45/60 days; selection persists when steppers change
  2. Toggle One-Time Purchase and back
    - expect: Active card changes; one-time card has no frequency selector; prices unchanged by toggle

#### 6.4. 6.4 Add bundle to cart opens drawer with correct lines

**File:** `tests/generated/koh-full-site/6-bundle-builder.spec.ts`

**Steps:**
  1. Clear cart; select 1 Meal One + 2 Protein Bar boxes, subscription, 30 days; click ADD TO CART
    - expect: Drawer shows 'Your cart (3)' with a Meal One line and a Daily Bar line (qty 2), each 'Every 30 days'
    - expect: Free gift Glass Mug 'Unlocked!'; subtotal $70.77; free shipping congratulation
    - expect: (If the gift modal appears, choose 'Add Kreatures Glass Mug')

#### 6.5. 6.5 Free gift messaging and FAQ/nutrition sections

**File:** `tests/generated/koh-full-site/6-bundle-builder.spec.ts`

**Steps:**
  1. Read 'Pick a free gift, on us.' block and sections NUTRITION & INGREDIENTS, BOX INFO, TRANSFORM YOUR DAILY HABITS, FREQUENTLY ASKED QUESTIONS
    - expect: All sections render with content; FAQ accordions toggle; footer present

### 7. 7. Apparel and simple PDPs

**Seed:** `tests/seed.spec.ts`

#### 7.1. 7.1 Black Scripted Hoodie sizes and sold-out XL

**File:** `tests/generated/koh-full-site/7-simple-pdps.spec.ts`

**Steps:**
  1. Open /products/black-hoodie
    - expect: h1 'Black Scripted Hoodie', price $45.00 USD, size radios XS (checked by default), S, M, L, XL
    - expect: XL radio is disabled/'sold out'; 'Add to cart' enabled for XS
  2. Open /products/black-hoodie?variant=40307357614245 (XL)
    - expect: Submit button text 'Sold out' and disabled
  3. Select S then add to cart
    - expect: Drawer opens with 'Black Scripted Hoodie' size S, $45, subtotal $45

#### 7.2. 7.2 Oat Scripted Hoodie matches the black hoodie behaviour

**File:** `tests/generated/koh-full-site/7-simple-pdps.spec.ts`

**Steps:**
  1. Open /products/oatmeal-hoodie
    - expect: h1 'Oat Scripted Hoodie', $45.00, same 5 sizes, XL sold out, 5 images load

#### 7.3. 7.3 Beanie single-variant PDP

**File:** `tests/generated/koh-full-site/7-simple-pdps.spec.ts`

**Steps:**
  1. Open /products/beanie and add to cart
    - expect: h1 'KOH Knit Beanie', $25.00, no size selector
    - expect: Drawer: 'Your cart (1)', $25, 'Only $94 left to get free shipping!', gift teaser 'Add a subscription to unlock your free gift!'

#### 7.4. 7.4 Snapback shows sale price against compare-at price

**File:** `tests/generated/koh-full-site/7-simple-pdps.spec.ts`

**Steps:**
  1. Open /products/koh-new-york-colorway-snapback
    - expect: Regular (compare-at) price $45.00 struck through, sale price $22.50, visible 'Sale' badge; the 'Sold out' badge element exists but is hidden
    - expect: Sale price = 50% of compare-at; add to cart puts $22.50 in the drawer

#### 7.5. 7.5 Glass Mug is a $0 gift item

**File:** `tests/generated/koh-full-site/7-simple-pdps.spec.ts`

**Steps:**
  1. Open /products/glass-cup
    - expect: h1 'Kreatures Glass Mug', price $0.00 USD, 'Add to cart' enabled (O15); 2 images load. Do not complete a purchase

### 8. 8. Cart drawer

**Seed:** `tests/seed.spec.ts`

#### 8.1. 8.1 Line items, quantity plus/minus and subtotal math

**File:** `tests/generated/koh-full-site/8-cart-drawer.spec.ts`

**Steps:**
  1. Clear cart, add the beanie ($25), open the drawer
    - expect: One product row (`li:has(a[href^='/products/'])`), qty input 1, 'Your cart (1)', subtotal $25
  2. Click plus (force + noWaitAfter) 4 times, polling after each
    - expect: Qty 2..5 -> subtotal $50, $75, $100, $125; header count matches; never read once without polling (O13)
  3. Click minus
    - expect: Qty and subtotal decrease by one unit; at qty 1 minus does not go below 1 (or removes the line, assert actual)

#### 8.2. 8.2 Free-shipping progress at the $119 one-time threshold

**File:** `tests/generated/koh-full-site/8-cart-drawer.spec.ts`

**Steps:**
  1. With beanie qty 1/4/5 read the progress message
    - expect: $25 -> 'Only $94 left to get free shipping!'
    - expect: $100 -> 'Only $19 left to get free shipping!'
    - expect: $125 -> 'Congratulations! You have free shipping!'
  2. Add Meal One subscription boxes (2 then 3)
    - expect: 2 boxes -> 'Add 1 more to get free shipping!'; 3 boxes -> 'Congratulations! You have free shipping!'

#### 8.3. 8.3 Remove a line and the empty state

**File:** `tests/generated/koh-full-site/8-cart-drawer.spec.ts`

**Steps:**
  1. With 3 Meal One lines in the cart click `remove` on one
    - expect: That row disappears; subtotal and header recompute (poll up to 10 s)
  2. Remove all lines
    - expect: 'Your cart (0)', 'Only $119 left to get free shipping!', 'Your cart is empty', 'Continue Shopping' -> /pages/bundle-builder

#### 8.4. 8.4 Gift lines and discount math with a subscription

**File:** `tests/generated/koh-full-site/8-cart-drawer.spec.ts`

**Steps:**
  1. Add 4 Meal One boxes in subscription mode (flavor1 x1, flavor2 x1, flavor3 x2)
    - expect: Lines $23.59, $23.59, $47.18 (originals $39.99, $39.99, $79.98); discounts $16.40, $16.40, $32.80; Subtotal discount $65.60 off; subtotal $94.36
  2. Inspect the 'Your Free Gifts' group
    - expect: Kreatures Glass Mug, 'with subscription', 'Unlocked!', FREE, REMOVE (`[data-koh-remove-gift]`)
  3. Click REMOVE on the gift
    - expect: Gift row disappears or reverts to the locked teaser; paid lines and subtotal are unchanged
  4. Change a line's frequency `<select>` (30 -> 15 days) and to One-time
    - expect: Line text updates ('Every 15 days'); choosing One-time shows $39.99 and loses the discount; free gift state reflects whether a subscription line remains

#### 8.5. 8.5 Checkout button reaches the Shopify checkout URL and stops

**File:** `tests/generated/koh-full-site/8-cart-drawer.spec.ts`

**Steps:**
  1. With any item in the cart click `#ns-hybrid-cart a[href='/checkout']`
    - expect: URL matches /checkouts/cn/<token>/en-us...; title 'Checkout - Kreatures of Habit'
  2. STOP: assert only the URL/title, do not fill any field or press pay
    - expect: No order is placed

#### 8.6. 8.6 Drawer open/close and persistence

**File:** `tests/generated/koh-full-site/8-cart-drawer.spec.ts`

**Steps:**
  1. Open the drawer via the header cart button, close via 'Close cart', press Escape, click the backdrop
    - expect: Each closes the drawer (`ns-hybrid-cart-open` removed)
  2. Reload the page and navigate to another page
    - expect: Cart contents and the header badge persist

### 9. 9. Content pages

**Seed:** `tests/seed.spec.ts`

#### 9.1. 9.1 About page

**File:** `tests/generated/koh-full-site/9-content-pages.spec.ts`

**Steps:**
  1. Open /pages/about-us
    - expect: Title 'About Us - Kreatures of Habit | Health and Wellness'; headings 'ABOUT US' and 'Meet Michael'; images load with alt (no missing alt in main)

#### 9.2. 9.2 FAQ accordions

**File:** `tests/generated/koh-full-site/9-content-pages.spec.ts`

**Steps:**
  1. Open /pages/faqs
    - expect: 52 `[data-faq-button]` / `[data-faq-group]` entries, all collapsed (aria-expanded=false)
  2. Click the first question ('Why is Kreatures spelled with a K?')
    - expect: aria-expanded=true and the answer text is visible; clicking again collapses it
  3. Open several others
    - expect: Record whether opening one closes others and assert that behaviour consistently

#### 9.3. 9.3 Contact page form renders (never submit)

**File:** `tests/generated/koh-full-site/9-content-pages.spec.ts`

**Steps:**
  1. Open /pages/contact
    - expect: Heading 'CONTACT'; form posting to /contact#ContactForm with 5 inputs (name, email, phone/subject, message, submit) visible and enabled
  2. Do NOT fill or click submit
    - expect: No POST to /contact is made

#### 9.4. 9.4 Stores page (Sprouts locator) and podcast

**File:** `tests/generated/koh-full-site/9-content-pages.spec.ts`

**Steps:**
  1. Open /pages/stores
    - expect: Heading 'Find Daily Bar at Your Local Sprouts'; address/zip input ('Enter Address or Zip Code'); radius options 5/10/25/50/100 miles; category filter 'All Locations'
  2. Check map and list
    - expect: Expected: map renders and locations list populates. Currently FAILS (O1): Google Maps billing error dialog and 'No locations found'; report as a real bug, do not weaken
  3. Open /pages/podcast
    - expect: Title 'Our Podcast - Kreatures of Habit'; page has content/embeds and 200 status; no h1 in HTML (O4)

#### 9.5. 9.5 Blog index and an article

**File:** `tests/generated/koh-full-site/9-content-pages.spec.ts`

**Steps:**
  1. Open /blogs/habit-lab
    - expect: h1 'Habit Lab'; article cards link to /blogs/habit-lab/<handle> (e.g. take-the-swing, finish-the-year-strong-week-1)
  2. Click the first article
    - expect: Article page loads (e.g. h1 'TAKE THE SWING', title 'TAKE THE SWING - Kreatures of Habit'), images load, no horizontal overflow

#### 9.6. 9.6 Wholesale page renders (never submit)

**File:** `tests/generated/koh-full-site/9-content-pages.spec.ts`

**Steps:**
  1. Open /pages/ws-account-create
    - expect: Title 'Wholesale Registration Form - Kreatures of Habit'; registration form fields are visible. Do not fill or submit

#### 9.7. 9.7 The four policy pages

**File:** `tests/generated/koh-full-site/9-content-pages.spec.ts`

**Steps:**
  1. Open /policies/shipping-policy, /policies/refund-policy, /policies/privacy-policy, /policies/terms-of-service
    - expect: Each returns 200 with h1 'Shipping policy' / 'Refund policy' / 'Privacy policy' / 'Terms of service' and non-empty body text

### 10. 10. Account login page

**Seed:** `tests/seed.spec.ts`

#### 10.1. 10.1 /a/account/login renders (no login)

**File:** `tests/generated/koh-full-site/10-account-login.spec.ts`

**Steps:**
  1. Open /a/account/login
    - expect: Header, announcement bar and footer present; Skio 'Welcome! Access your account and manage...' panel; email input and 'Get login code (sends SMS...)' button visible
  2. Do not type or click any submit button
    - expect: No request to a login/sendcode endpoint is made

#### 10.2. 10.2 Classic /account/login also renders (O8)

**File:** `tests/generated/koh-full-site/10-account-login.spec.ts`

**Steps:**
  1. Open /account/login
    - expect: Page renders 'Login or Email', Password, 'Forgot your password?', 'Sign in'. Document that two different login experiences exist; no data entered

#### 10.3. 10.3 Account links from the header and mobile menu

**File:** `tests/generated/koh-full-site/10-account-login.spec.ts`

**Steps:**
  1. Desktop: read the header 'Log in' href
    - expect: /a/account/login
  2. Mobile (390 px): open the menu and read 'My Account' and 'Log in' hrefs
    - expect: Known inconsistency O8: /a/account/login vs /account/login. Test asserts both resolve with 200

### 11. 11. 404 and unknown URLs

**Seed:** `tests/seed.spec.ts`

#### 11.1. 11.1 Unknown product handle

**File:** `tests/generated/koh-full-site/11-not-found.spec.ts`

**Steps:**
  1. Navigate to /products/zzz-not-a-real-product
    - expect: Redirects to / (final URL https://kreaturesofhabit.com/), homepage renders, no error text, no uncaught console error (soft 404)

#### 11.2. 11.2 Unknown page returns a real 404

**File:** `tests/generated/koh-full-site/11-not-found.spec.ts`

**Steps:**
  1. Navigate to /pages/zzz-not-real
    - expect: HTTP 404, title '404 Not Found - Kreatures of Habit', h1 'Page not found', header and footer still present (O9, O2)

#### 11.3. 11.3 Unknown blog article and policy

**File:** `tests/generated/koh-full-site/11-not-found.spec.ts`

**Steps:**
  1. Navigate to /blogs/habit-lab/zzz-not-real and /policies/zzz
    - expect: Record status (expected 404 page with header/footer, not a blank page or server error)

#### 11.4. 11.4 Recovery from the 404 page

**File:** `tests/generated/koh-full-site/11-not-found.spec.ts`

**Steps:**
  1. On the 404 page click the logo and a header nav link
    - expect: Navigates to / and /products/meal-one-v2 successfully

### 12. 12. Mobile (Pixel 7, 390 px wide)

**Seed:** `tests/seed.spec.ts`

#### 12.1. 12.1 Mobile header and menu drawer

**File:** `tests/generated/koh-full-site/12-mobile.spec.ts`

**Steps:**
  1. Set viewport 390x844 (project koh-mobile-chrome), open /, close the popup
    - expect: Hamburger (`summary.header__icon--menu`), logo, cart button visible; desktop nav hidden
  2. Tap the hamburger
    - expect: `#menu-drawer` opens with OVERNIGHT OATS, PROTEIN BAR, BUNDLE & SAVE, NOW AT SPROUTS, My Account, Log in, Facebook, Instagram, TikTok, country selector 'United States | USD $'
  3. Tap each nav entry in turn
    - expect: Each goes to its page (meal-one-v2, daily-bar, bundle-builder, stores)

#### 12.2. 12.2 No horizontal overflow on key pages

**File:** `tests/generated/koh-full-site/12-mobile.spec.ts`

**Steps:**
  1. For /, /products/meal-one-v2, /products/daily-bar, /pages/bundle-builder, /products/black-hoodie, /pages/faqs, /pages/stores, /pages/about-us, /pages/contact, /blogs/habit-lab compare document scrollWidth with clientWidth
    - expect: scrollWidth <= clientWidth on every page (menu drawer items excluded as they are off-canvas)

#### 12.3. 12.3 Mobile PDP builder and add to cart

**File:** `tests/generated/koh-full-site/12-mobile.spec.ts`

**Steps:**
  1. On /products/meal-one-v2 tap '+' twice on the first flavor
    - expect: Steppers tappable (touch target visible, not covered by sticky bar), ATC becomes 'ADD TO CART', prices $79.98 / $47.18
  2. Tap ADD TO CART
    - expect: Drawer opens full width, lines visible without horizontal scroll, CHECKOUT link visible

#### 12.4. 12.4 Mobile cart drawer controls

**File:** `tests/generated/koh-full-site/12-mobile.spec.ts`

**Steps:**
  1. In the drawer tap plus, minus and remove (force click) and Close cart
    - expect: Quantities, subtotal and header update; drawer closes; body scroll unlocked
  2. Tap CHECKOUT (STOP at URL)
    - expect: URL matches /checkouts/cn/... only

#### 12.5. 12.5 Mobile bundle builder and content pages

**File:** `tests/generated/koh-full-site/12-mobile.spec.ts`

**Steps:**
  1. Open /pages/bundle-builder and add 1 Meal One and 1 Protein Bar box
    - expect: 'ADD TO CART' enabled; Protein Bar and Meal One groups stack vertically without clipping
  2. Open /pages/faqs and tap a question; open /pages/stores
    - expect: Accordion expands; stores page shows locator inputs (map defect O1 applies)
