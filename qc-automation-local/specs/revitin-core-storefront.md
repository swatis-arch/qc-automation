# Revitin Core Storefront Test Plan

## Application Overview

Core storefront coverage for https://revitin.com (Shopify, custom theme; merchant slug `revitin`, project `revitin-desktop-chromium`, seed `tests/seed.spec.ts`) outside the PDP buy box (see specs/revitin-buy-box.md). Explored 2026-10-15. Global rules: never submit any form (newsletter, contact, account), never place an order, stop at the /checkout link (assert href only, never click). Site is behind Cloudflare and returns 429 if hammered: space navigations (>=1.5s), reuse pages, prefer one page.request.get(url,{maxRedirects:0}) per URL, do not crawl. Always start from a fresh/empty cart (/cart.js item_count 0).

VERIFIED SELECTORS
- Announcement bar: section > div.announcement.text-center.text-brown > p > a (home text 'Subscribe & Get Free Shipping on Every Order' -> /products/revitin-natural-toothpaste/Mint; sub-pages also render 'New Product Drop: Travel Size is Here' -> https://revitin.com/products/revitin-natural-toothpaste/Citrus, title 'Revitin Travel Size').
- Header: header#shopify-section-header.shopify-section; wrapper div.site-header; desktop nav `nav.hidden.items-center.gap-8.md:flex` (two such navs: left = Shop/About/Ingredients, right = Account); logo a.flex.justify-center.relative.z-20 href='/' (no text, contains svg/img; no accessible name); cart button button#cart-icon-bubble.group (text 'Cart' + count, e.g. 'Cart 0'; accessible name 'Cart 0'); account link role=link name 'Account' href /account.
- Shop dropdown (desktop hover): div.shop-dropdown > a (href /products/revitin-natural-toothpaste/Mint) > div.shop-dropdown-trigger; div.shop-dropdown-content with div.shop-dropdown-item links 'Full Size Toothpaste' -> /products/revitin-natural-toothpaste/Citrus and 'Travel Size Toothpaste' -> /products/revitin-natural-toothpaste/Citrus?size=travel (span.dropdown-link-title). Other nav links: a.lg:hover:opacity-70 'About' /pages/about, 'Ingredients' /pages/ingredients.
- Footer: footer.bg-light-tan.mt-8.lg:mt-12; h3 'The world's first prebiotic toothpaste. Try it today!'; column labels p.tag ('Shop', 'Orders'); newsletter label 'Newsletter', Klaviyo-style form: input[type=email][name=email] (placeholder/label 'Email', class needsclick kl-private-reset-css-*), input[type=submit] (value 'Subscribe'), p.success.hidden / p.error.hidden message slots; copyright p.text-brown.opacity-50 '(c) 2026, Revitin'. 22 anchors in footer. No social links, no mailto/tel in footer.
- Cart drawer: custom element <site-cart> containing div.site-cart.fixed.w-full.top-0.right-0.bottom-0.z-[100] (class 'active' toggled when open; closed = opacity-0 invisible, visibility hidden); panel div.flyout__content; close button button#close-menu (svg X, no accessible name); backdrop button.flyout__veil; empty state: heading 'Your cart is empty', a.button.button--gold 'Shop Revitin' -> /products/revitin-natural-toothpaste, 'Subtotal $0', a.button.button--gold.!w-full 'Checkout' href /checkout, 'Taxes and shipping calculated at checkout' (link 'shipping' -> /policies/shipping-policy). Filled drawer: cart-item.cart-item, qty input[aria-label^='Quantity for'] (name quantity), button[name=decrement] aria-label 'Decrement Line Item Quantity', button[name=increment] aria-label 'Increment Line Item Quantity', button.remove-button-js aria-label 'Remove <item title>', upsell button.subscribe_save.subscribe-btn-js 'Upgrade to 5 Tubes', upsell card button.add-to-cart-btn.cart-upsell-card__add 'Add' (Citrus Travel 3-Pack of 1oz, $18, /products/revitin-toothpaste-travel-3-tubes).
- Mobile: button#hamburger-icon.md:hidden (no aria-label, svg 3 bars, icon does not change when open); panel div.mobile-menu.fixed.top-[92px].left-0.w-full.h-screen.z-20 (visibility hidden when closed, visible when open) wrapping nav.site-container.grid.content-start.pt-4; custom elements <mobile-menu>, <marquee-carousel> (trust-badge ticker, intentionally wider than viewport inside overflow-hidden).
- 404 page: title 'Revitin | 404 Not Found', canonical https://revitin.com/404, header and footer present, div.not-found-text > h2 'Oops! The page you're looking for doesn't exist', a.home-button 'Go to Home' href '/', followed by trust-icons strip and 'Loved By Over +70,000 Smiles!' h2. No H1.

VERIFIED STATUS TABLE (page.request, no redirects): / 200; /pages/about 200; /pages/ingredients 200; /products/revitin-natural-toothpaste/Mint 200; /collections/all 404; /cart 200 (JS then lands on / with drawer open); /account 302 -> /account/login?return_url=%2Faccount; /pages/faqs 200; /pages/contact-us 200; /pages/press 200; /pages/review 200; /blogs/all 200; /pages/shipping-policy 200; /pages/return-and-refund-policy 200; /pages/wholesale 200; /pages/partner-with-us-professionally 200; /pages/privacy-policy 200; /pages/terms-of-use 200; /policies/privacy-policy 200; /policies/refund-policy 200; /policies/shipping-policy 200; /policies/terms-of-service 200; /pages/does-not-exist, /products/does-not-exist, /collections/does-not-exist all 404. External footer link: Affiliates https://ui.awin.com/merchant-profile/89339 (do not fetch).

OBSERVATIONS (possible defects; tests should log/annotate these, not hard-fail, unless noted)
- O1. /collections/all returns HTTP 404 (title 'Revitin | 404 Not Found'); the store has no collection grid, no sort control and no product-card listing. Product listing exists only as the homepage carousel (4 unique cards, Quick Add buttons) and the Shop dropdown. Scenario 4.1 asserts the actual state.
- O2. /pages/about renders THREE H1 elements and every one is the trust-badge marquee text 'GLUTEN FREE FLUORIDE & SLS FREE PEANUT FREE DYE FREE GMO FREE SUGAR & XYLITOL FREE'; the real page title 'About Us' is not an H1. The same marquee text is an H3 x3 on the homepage. SEO/accessibility heading defect.
- O3. /pages/faqs has no H1 at all (only H2s: Ingredients, Product, Orders, Shipping & Returns, Subscriptions; visible text 'How can we help?').
- O4. Escape key does not close either the cart drawer (stays class 'active', visibility visible) or the mobile menu (stays visible); drawer closes only via #close-menu X, clicking the backdrop (e.g. mouse click at 200,300), or reopening toggles. Keyboard accessibility gap. (Mobile menu closes by clicking #hamburger-icon again.)
- O5. Unlabeled controls: logo link (a[href='/'] has no text/aria-label), drawer close button#close-menu, #hamburger-icon, quantity-input hidden overlay; none have an accessible name except the quantity input and +/-/remove buttons. Also 46 of 62 homepage images have empty alt text.
- O6. Hamburger icon does not change to an X when the mobile menu is open and the menu has no dedicated close button; the only way to close is the same toggle.
- O7. /cart is not a real page: HTTP 200 but client-side redirect to '/' with the cart drawer opened (URL ends as https://revitin.com/). Direct visits show the homepage (title, H1 of home) rather than a cart page; the 'redirect' is JS, not a 301/302. Related: when the drawer is active (e.g. after /cart), header #cart-icon-bubble is covered by the drawer panel (div.cart__items grid intercepts pointer events), so Playwright .click() on it times out; tests must close the drawer first.
- O8. Drawer line price strike-through does not match the PDP: after adding the default Trio (3 tubes, subscription) the drawer shows '$46' struck/'$42' while the PDP card shows '$42 ... $51 Save 18%'. Compare-at price inconsistent ($51 vs $46).
- O9. Footer 'Made in the USA' link goes to /pages/ingredients (same as 'Ingredients'); 'The Science' -> /blogs/all (generic Blogs); 'Meet Dr. Gerry' -> /pages/about/#meet-dr-gerry (trailing slash before the hash). Footer 'Revitin Toothpaste' and header 'Shop' use different PDP paths (/products/revitin-natural-toothpaste vs .../Mint) and the hero CTA href ends with a stray '?' (https://revitin.com/products/revitin-natural-toothpaste/Mint?).
- O10. Footer has no social-media links and no contact email/phone; contact details only exist on /pages/contact-us as plain text (info@revitin.com in an H2, (207) 613-6825 as tel: link; no mailto: link for the email). Mobile menu labels differ from desktop ('Shop Toothpaste', 'Blogs' vs 'The Science', 'Account', 'Wholesale', 'Contact Us') and omit FAQ/Press/Reviews.
- O11. Console noise on every page: TikTok pixel worker 'Failed to execute importScripts ... analytics.tiktok.com/i18n/pixel/shopify.js ... failed to load' (network error, likely adblock/Cloudflare in automation); homepage has ~8-12 warnings. Filter these in console-error assertions.
- O12. The 404 page canonical is https://revitin.com/404 and the 404 page has no H1 (the message is an H2). /policies/* pages are default Shopify legal pages (H1 'Privacy policy', 'Refund policy') duplicating /pages/privacy-policy and /pages/return-and-refund-policy with different H1/titles; footer links to the /pages/ versions only.


## Test Scenarios

### 1. 1. Homepage

**Seed:** `tests/seed.spec.ts`

#### 1.1. 1.1 Homepage head metadata and heading structure

**File:** `tests/generated/revitin-core-storefront/homepage-metadata.spec.ts`

**Steps:**
  1. Navigate to https://revitin.com/ and wait for domcontentloaded
    - expect: HTTP status 200
    - expect: document.title is exactly 'Revitin® Toothpaste Online | Best Prebiotic Toothpaste'
  2. Read meta[name=description], link[rel=canonical], meta[property='og:title'], meta[name=viewport]
    - expect: description is "The world's first prebiotic toothpaste. Fluoride-free and SLS-free, safe if swallowed, for a balanced oral microbiome, whiter teeth, and fresher breath." (non-empty, ends with a period)
    - expect: canonical is https://revitin.com/
    - expect: og:title equals the document title
    - expect: viewport is width=device-width,initial-scale=1
  3. Count h1 elements and read the text
    - expect: Exactly one h1: 'The world’s first prebiotic toothpaste'
    - expect: Hero paragraph 'Promote a healthy balance of your oral ecology to support oral health and wellness for whiter teeth and fresher breath.' is visible

#### 1.2. 1.2 Header, announcement bar and hero CTAs (desktop 1280x720)

**File:** `tests/generated/revitin-core-storefront/homepage-header-hero.spec.ts`

**Steps:**
  1. Load / and locate div.announcement a
    - expect: Announcement link text 'Subscribe & Get Free Shipping on Every Order' with href /products/revitin-natural-toothpaste/Mint (record the text actually shown; sub-pages show 'New Product Drop: Travel Size is Here' -> .../Citrus)
  2. Inspect header#shopify-section-header: logo a[href='/'], nav links, Account link, button#cart-icon-bubble
    - expect: Nav links visible in order: Shop (/products/revitin-natural-toothpaste/Mint), About (/pages/about), Ingredients (/pages/ingredients)
    - expect: Logo link href '/' is visible; Account link href /account is visible; cart button shows 'Cart' and count 0
    - expect: Record that the logo has no accessible name (O5)
  3. Hover the Shop link
    - expect: div.shop-dropdown-content becomes visible with 'Full Size Toothpaste' -> /products/revitin-natural-toothpaste/Citrus and 'Travel Size Toothpaste' -> /products/revitin-natural-toothpaste/Citrus?size=travel
  4. Record hero CTA and main homepage links: 'Shop Revitin' hero button, 'View ingredients' button, second 'Shop Revitin', 'Prebiotic toothpaste' inline link, 'Learn More', 'Quick Add' buttons
    - expect: Hero 'Shop Revitin' href https://revitin.com/products/revitin-natural-toothpaste/Mint? (stray '?', O9)
    - expect: 'View ingredients' -> /pages/ingredients; 'Learn More' -> /pages/about; second 'Shop Revitin' -> /products/revitin-natural-toothpaste; 'Prebiotic toothpaste' -> https://revitin.com/products/revitin-natural-toothpaste
    - expect: Carousel shows 4 unique cards: 'Mint - 3.4oz' / 'Citrus - 3.4oz' (from $13.60 per tube, 'Full Size - Quick Add') and 'Mint - 1oz' / 'Citrus - 1oz' (3 Tubes for $18, 'Travel Size - Quick Add'); hrefs end .../Mint, .../Citrus, .../Mint?size=travel, .../Citrus?size=travel. Do NOT click Quick Add.

#### 1.3. 1.3 Homepage images load and no horizontal overflow

**File:** `tests/generated/revitin-core-storefront/homepage-images.spec.ts`

**Steps:**
  1. Load / at 1280x720, scroll through the page slowly to trigger lazy loading, wait for network idle
    - expect: No img with complete===true and naturalWidth===0 (broken images list is empty; observed 62 images, 0 broken)
    - expect: document.documentElement.scrollWidth <= innerWidth (observed 1265 vs 1280)
  2. Count images with empty alt
    - expect: Log the count (observed 46 of 62 without alt, O5); do not fail
  3. Check console for page errors, excluding analytics.tiktok.com importScripts noise
    - expect: No uncaught page errors (O11)

### 2. 2. Header navigation

**Seed:** `tests/seed.spec.ts`

#### 2.1. 2.1 Each header nav link resolves with HTTP 200 and expected page

**File:** `tests/generated/revitin-core-storefront/header-nav.spec.ts`

**Steps:**
  1. From /, click 'Shop' (use click({noWaitAfter:true}) then expect URL) and wait 2s
    - expect: URL is /products/revitin-natural-toothpaste/Mint (PDP) with status 200
  2. Go back to /, click 'About'
    - expect: URL /pages/about, status 200, title 'About Revitin® | Meet Dr. Gerry Curatola, Our Founder', visible text 'About Us'
  3. Go to /, click 'Ingredients'
    - expect: URL /pages/ingredients, status 200, h1 'Revitin Ingredients', title "Revitin Ingredients | What's in Our Prebiotic Toothpaste"
  4. Go to /, click the logo from /pages/about
    - expect: URL returns to https://revitin.com/

#### 2.2. 2.2 Account link redirects to login without submitting anything

**File:** `tests/generated/revitin-core-storefront/header-account.spec.ts`

**Steps:**
  1. GET /account with page.request and maxRedirects 0
    - expect: Status 302 with location /account/login?return_url=%2Faccount
  2. Click the header 'Account' link in the browser and wait
    - expect: URL path contains /account/login; page loads (record H1/heading and the field names only); do not type into or submit any field

### 3. 3. Footer

**Seed:** `tests/seed.spec.ts`

#### 3.1. 3.1 Footer headings, columns and link inventory

**File:** `tests/generated/revitin-core-storefront/footer-links.spec.ts`

**Steps:**
  1. Load / and scroll footer.bg-light-tan into view
    - expect: h3 'The world’s first prebiotic toothpaste. Try it today!' visible
    - expect: Column label 'Shop' links: Revitin Toothpaste -> https://revitin.com/products/revitin-natural-toothpaste; About Us -> /pages/about; Ingredients -> /pages/ingredients; Meet Dr. Gerry -> /pages/about/#meet-dr-gerry; The Science -> /blogs/all; Made in the USA -> /pages/ingredients; Press -> /pages/press; Reviews -> /pages/review; FAQ -> /pages/faqs
    - expect: Column label 'Orders' links: Affiliates -> https://ui.awin.com/merchant-profile/89339; Shipping Policy -> /pages/shipping-policy; Return & Refund Policy -> /pages/return-and-refund-policy; Contact Us -> /pages/contact-us; Wholesale -> /pages/wholesale; Professional Partnerships -> /pages/partner-with-us-professionally; Account -> https://revitin.com/account
    - expect: Bottom bar: logo link '/', '© 2026, Revitin', button 'Accessibility', Privacy Policy -> /pages/privacy-policy, Terms of Service -> /pages/terms-of-use
  2. Request each internal footer href once with page.request.get (maxRedirects 0), 1.5s apart; skip the external Awin URL (assert only that href starts with https://ui.awin.com/)
    - expect: All internal pages return 200 except /account (302 to login)
    - expect: Any non-200 is reported with the link text

#### 3.2. 3.2 Footer newsletter field (never submit) and absence of social/contact links

**File:** `tests/generated/revitin-core-storefront/footer-newsletter.spec.ts`

**Steps:**
  1. Locate the footer textbox named 'Email' and the 'Subscribe' input[type=submit]
    - expect: Label 'Newsletter' and text 'Receive special offers and first look at new products!' visible
    - expect: Email input is visible, enabled, type=email, name=email; Subscribe control visible
    - expect: p.success and p.error message slots are hidden
  2. Optionally focus the Email field and fill the invalid text 'not-an-email' WITHOUT pressing Enter or clicking Subscribe; then clear it
    - expect: Page URL unchanged; no network POST to /subscribe or klaviyo is made; field cleared afterwards
  3. Search footer for links matching facebook|instagram|twitter|tiktok|youtube|pinterest|linkedin and for mailto:/tel: anchors
    - expect: Observed: none (O10). Test records this and fails only if a social link exists with an empty/placeholder href

#### 3.3. 3.3 Contact page details (no form submission)

**File:** `tests/generated/revitin-core-storefront/contact-page.spec.ts`

**Steps:**
  1. Open /pages/contact-us
    - expect: Status 200, h1 'Contact Revitin', intro 'Questions? We’re here to help. Fill out the form below or send our team an email.'
    - expect: Heading text 'info@revitin.com' and tel link tel:+12076136825 '(207) 613-6825' visible (email is not a mailto link, O10)
    - expect: Contact form posts to /contact#contact_form with fields contact[name], contact[email], contact[request_type], contact[order_number], contact[message]; do NOT fill or submit

### 4. 4. /collections/all

**Seed:** `tests/seed.spec.ts`

#### 4.1. 4.1 /collections/all actual behaviour (404, no grid)

**File:** `tests/generated/revitin-core-storefront/collections-all.spec.ts`

**Steps:**
  1. Navigate to https://revitin.com/collections/all
    - expect: HTTP status 404 (O1); title 'Revitin | 404 Not Found'
    - expect: Page shows the 404 content ('Oops! The page you’re looking for doesn’t exist', 'Go to Home'); no product grid, no product cards, no sort control (<select> or 'Sort by') is present
  2. Record the product listing that does exist: homepage carousel cards (title, price text, href) and the Shop dropdown links
    - expect: 4 unique cards with titles/prices/hrefs exactly as in test 1.2; there is no sort control anywhere on the homepage

### 5. 5. Cart drawer (outside buy box)

**Seed:** `tests/seed.spec.ts`

#### 5.1. 5.1 Empty cart drawer from header: open, empty state, close methods

**File:** `tests/generated/revitin-core-storefront/cart-drawer-empty.spec.ts`

**Steps:**
  1. Load / with an empty cart (new context) and confirm div.site-cart does not have class 'active'; click button#cart-icon-bubble
    - expect: div.site-cart gains class 'active' and is visible; heading 'Your Cart'; text 'Your cart is empty'; link 'Shop Revitin' -> /products/revitin-natural-toothpaste; 'Subtotal' '$0'; 'Checkout' link href /checkout (do not click); 'Taxes and shipping calculated at checkout' with 'shipping' -> /policies/shipping-policy
  2. Click button#close-menu inside site-cart
    - expect: Drawer loses 'active' and becomes hidden
  3. Reopen, press Escape
    - expect: Observed: drawer stays open (O4) - record, mark as known defect
  4. With the drawer open, click the backdrop at page coordinates (200,300)
    - expect: Drawer closes

#### 5.2. 5.2 /cart page behaviour

**File:** `tests/generated/revitin-core-storefront/cart-page.spec.ts`

**Steps:**
  1. GET /cart with page.request (maxRedirects 0), then page.goto('/cart') and wait 2.5s
    - expect: Request status 200 (not a 3xx); in the browser the URL ends up as https://revitin.com/ and the cart drawer has class 'active' showing 'Your cart is empty' (O7)
    - expect: While the drawer is open, header #cart-icon-bubble is covered; close via #close-menu before interacting with the header

#### 5.3. 5.3 Drawer quantity +/- and remove after single add from PDP default button

**File:** `tests/generated/revitin-core-storefront/cart-drawer-qty.spec.ts`

**Steps:**
  1. Open /products/revitin-natural-toothpaste (default state), click the visible button.main__atc__button ('$42 — Add to Bag') once
    - expect: Drawer opens; line item 'Revitin Natural Toothpaste' 'Subscription', 'Pack: 3 Tubes', 'Flavor: Citrus', price $42 (struck-through $46, O8), quantity 1, badge 'Cart 1'; /cart.js shows 1 item 'Revitin Toothpaste (3 Tubes) - Citrus' price 4200 with selling plan 'Delivery every 3 months'
    - expect: Upsells visible: 'Upgrade to 5 Tubes' (button.subscribe_save), 'Citrus Travel 3-Pack of 1oz' $18 with 'Add' (do not click); Subtotal $42; Checkout link href /checkout (do not click)
  2. Click button[name=increment] ('Increment Line Item Quantity') and wait ~2.5s
    - expect: Quantity input becomes 2, badge 'Cart 2', line shows $84, /cart.js quantity 2 total_price 8400
  3. Click button[name=decrement] ('Decrement Line Item Quantity')
    - expect: Quantity 1, badge 'Cart 1', total 4200
  4. Click button.remove-button-js (aria-label starts 'Remove Revitin Toothpaste (3 Tubes)'), wait 2.5s
    - expect: Line removed, drawer shows 'Your cart is empty', badge 'Cart 0', /cart.js items [] (note: during exploration decrementing from quantity 1 also emptied the cart; assert both paths lead to empty state)
  5. Cleanup: ensure /cart.js item_count is 0 (POST /cart/clear.js if not). Never click Checkout
    - expect: Cart empty at test end

### 6. 6. Content and policy pages

**Seed:** `tests/seed.spec.ts`

#### 6.1. 6.1 Content pages: status, title, headings

**File:** `tests/generated/revitin-core-storefront/content-pages.spec.ts`

**Steps:**
  1. Visit one by one with 2s spacing: /pages/about, /pages/ingredients, /pages/faqs, /pages/contact-us, /pages/press, /pages/review, /pages/wholesale, /pages/partner-with-us-professionally, /blogs/all
    - expect: Every page returns 200 with the shared header and footer
    - expect: /pages/about: title 'About Revitin® | Meet Dr. Gerry Curatola, Our Founder'; H2s 'Microbes are necessary for oral health', 'Harsh chemicals do more harm than good', 'Natural ingredients work very, very hard'; 3 H1s equal to the trust-badge text (O2)
    - expect: /pages/ingredients: one H1 'Revitin Ingredients'; H2s start 'Meet Citrus', 'Meet Mint', 'Calcium Carbonate', 'Chrondrus Crispus' (note possible typo 'Chrondrus')
    - expect: /pages/faqs: title 'Revitin | FAQS'; no H1 (O3); H2 sections Ingredients, Product, 'Orders, Shipping & Returns', Subscriptions; 'How can we help?' visible
    - expect: /pages/contact-us: h1 'Contact Revitin'
    - expect: Record H1/title for press, review, wholesale, partner pages and blogs/all

#### 6.2. 6.2 Policy pages: status, H1 and canonical

**File:** `tests/generated/revitin-core-storefront/policy-pages.spec.ts`

**Steps:**
  1. Visit footer policy pages: /pages/shipping-policy, /pages/return-and-refund-policy, /pages/privacy-policy, /pages/terms-of-use
    - expect: All 200; H1s respectively 'Revitin Shipping Policy and Delivery Information', 'Revitin Return and Refund Policy', 'Revitin Privacy Policy', 'Revitin Terms of Use'; canonical equals the page URL; shipping page contains 'Most orders are shipped within 48 hours'; refund page contains 'Our policy allows returns within 30 days of purchase'
  2. Visit Shopify default policies: /policies/privacy-policy, /policies/refund-policy, /policies/shipping-policy, /policies/terms-of-service
    - expect: All 200; H1s 'Privacy policy', 'Refund policy' (H2s Returns, 'To receive a refund:', 'Additional non-returnable items:', 'Refunds (if applicable)'), titles 'Revitin | Privacy policy', 'Revitin | Refund policy'; record shipping/terms H1 (O12 duplicate-content note)

### 7. 7. 404 and unknown URLs

**Seed:** `tests/seed.spec.ts`

#### 7.1. 7.1 Unknown page, product and collection return 404 with branded 404 page

**File:** `tests/generated/revitin-core-storefront/not-found.spec.ts`

**Steps:**
  1. Navigate (2s apart) to /pages/does-not-exist, /products/does-not-exist, /collections/does-not-exist
    - expect: Each response status is exactly 404 (not 200 soft-404, not 429)
    - expect: Title 'Revitin | 404 Not Found'; canonical https://revitin.com/404; header and footer present
    - expect: div.not-found-text contains h2 'Oops! The page you’re looking for doesn’t exist'; no H1 (O12); trust icons and 'Loved By Over +70,000 Smiles!' section follow
  2. Click a.home-button 'Go to Home'
    - expect: href is '/'; navigation lands on https://revitin.com/ with status 200 and the homepage H1

### 8. 8. Mobile 390x844

**Seed:** `tests/seed.spec.ts`

#### 8.1. 8.1 Mobile homepage has no horizontal overflow

**File:** `tests/generated/revitin-core-storefront/mobile-home.spec.ts`

**Steps:**
  1. Set viewport 390x844, load /, wait 3s
    - expect: documentElement.scrollWidth and body.scrollWidth equal 390 (no horizontal scrollbar); the only elements wider than the viewport are inside marquee-carousel / div.overflow-hidden
    - expect: Announcement link, #hamburger-icon, logo and #cart-icon-bubble are visible; desktop nav links (Shop/About/Ingredients) are not visible; h1 visible

#### 8.2. 8.2 Hamburger menu open/close and links

**File:** `tests/generated/revitin-core-storefront/mobile-menu.spec.ts`

**Steps:**
  1. At 390x844 confirm div.mobile-menu has visibility hidden, then click #hamburger-icon
    - expect: div.mobile-menu becomes visible (nav.site-container inside) with links: Shop Toothpaste, Revitin Toothpaste, About Us, Ingredients, Meet Dr. Gerry, Contact Us, Wholesale, Account, Blogs; hrefs: .../Mint, .../Citrus, /pages/about, /pages/ingredients, /pages/about/#meet-dr-gerry, /pages/contact-us, /pages/wholesale, /account, /blogs/all
  2. Click #hamburger-icon again
    - expect: Menu hidden again (the hamburger is the only close control, icon does not change, O6)
  3. Open the menu, press Escape
    - expect: Observed: menu stays open (O4); record. Then close via the hamburger
  4. Open the menu and click 'About Us'
    - expect: Navigates to /pages/about with status 200 and the menu closed on the new page

#### 8.3. 8.3 Mobile cart button and drawer

**File:** `tests/generated/revitin-core-storefront/mobile-cart.spec.ts`

**Steps:**
  1. At 390x844 with an empty cart click #cart-icon-bubble
    - expect: Drawer opens full width with 'Your cart is empty', 'Shop Revitin', Checkout link (href /checkout, not clicked) in view (about y=742); #close-menu visible at about x=346,y=40; no horizontal scroll (scrollWidth 390)
  2. Click #close-menu
    - expect: Drawer closes (class 'active' removed)
