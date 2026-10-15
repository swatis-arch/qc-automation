# KOH Core Storefront Test Plan

## Application Overview

Test plan for the core storefront of merchant koh (Kreatures of Habit, https://kreaturesofhabit.com): homepage and navigation, the /collections/all grid, the non-builder products (Black and Oat Scripted Hoodies with a Size option, KOH Knit Beanie, KOH New York Colorway Snapback on sale, and the $0.00 items), the cart drawer and checkout hand-off for those products, content pages (about, FAQ, contact, stores, blog, policies, wholesale, login, 404) and the mobile (390x844) experience. Theme: Dawn-based Shopify theme with Tailwind utility classes, the custom shadow-DOM cart drawer <ns-hybrid-cart>, Junip reviews, Skio account app, Klaviyo popup, H1 Apps store locator. Project: koh-desktop-chromium (mobile scenarios set a 390x844 viewport), seed: tests/seed.spec.ts (fixtures/base closes popups and paces Cloudflare 429s). Merchant data comes from merchants/koh/config.js and locators.js; anything not there must be added to config.js / locators.js, never inlined in specs. NOT planned here (already covered in specs/koh-bundle-builder.md): the bundle builder (/pages/bundle-builder), the flavour-stepper builders on /products/meal-one-v2 and /products/daily-bar (2-box minimum, pricing, 41% subscription maths, frequency, free gift Glass Mug, free shipping bar, drawer +/-/remove and checkout for builder items, accordions/FAQ/reviews on those pages, mobile builder). Also out of scope: submitting any form (newsletter, Klaviyo popup, contact, wholesale, login, account) and placing orders.

GLOBAL RULES FOR EVERY SCENARIO
- Start from a fresh browser context (empty cart). To reset the cart use fetch('/cart/clear.js', {method:'POST'}) and then reload the page (clearing does not refresh an open drawer; the header badge also stays stale until reload). Each scenario is independent and must clear what it adds (end with /cart.js item_count 0).
- NEVER place an order: stop at the Shopify checkout URL (https://kreaturesofhabit.com/checkouts/cn/<token>/en-us?_r=...). Do not fill, tab into or submit any checkout field, discount code or express wallet button. NEVER submit any form: footer newsletter (textbox 'Your Best Email' + button 'SUBMIT'), Klaviyo popup (MORNINGS / 3PM / BOTH buttons), contact form (Name, Email, Message, 'Submit Message'), wholesale registration ('Continue'), account login (/a/account/login: assert it loads, NEVER type into 'Email' or click 'Get login code (sends SMS and email)'), store locator search. Read-only inspection of these pages is fine.
- Be gentle with the site (Cloudflare 429): one navigation per step, no reload loops, no more than ONE cart add per page load (reload before the next add). Use the rateLimitGuard fixture; do not add ad-hoc waitForTimeout to dodge 429s (short waits of 2-3 s for the drawer to settle are fine). For bulk status/title checks of many pages use fetch() from the current page with about 1.2 s between requests instead of 10 page.goto calls.
- Popups: the Klaviyo 'Sitewide Popup' ('Get your mornings back.', close button 'Close dialog') did NOT appear in about 25 page loads during exploration (an h2 'Get your mornings back.' exists hidden in the DOM of /collections/all), but it can appear a few seconds after load; the fixture closes it. Never click MORNINGS / 3PM / BOTH. The Dawn 'Item added to your cart' dialog is hidden in the DOM and is NOT the drawer.
- CART DRAWER is the custom <ns-hybrid-cart> element. The HOST has no id and no attributes and has an open shadow root; the real panel is div#ns-hybrid-cart[role=dialog][aria-modal=true][aria-labelledby=ns-hybrid-cart-header] INSIDE the shadow root. Playwright CSS locators pierce open shadow roots, so page.locator('#ns-hybrid-cart') works (count 1, visible, about 526x696 at x 742 on 1280 wide) and getByRole queries scoped to it also work; document.querySelector('#ns-hybrid-cart') returns null, so code using page.evaluate must go through document.querySelector('ns-hybrid-cart').shadowRoot. Controls use aria-labels: button[aria-label="plus"], "minus", "remove", "Close cart" (no text, so :has-text("Close cart") does NOT match; use getByRole('button',{name:'Close cart'})), link 'CHECKOUT' (href /checkout), and the gift row's REMOVE button [data-koh-remove-gift] (no aria-label). The drawer opens automatically after Add to cart (from the PDP or from a collection quick-add) and with /?cart=open.
- The drawer re-renders about 1-2 s after a cart change: after each plus/minus/remove wait with auto-retrying expects (expect.poll on /cart.js or toHaveText), never a single immediate read. Verify cart contents through /cart.js (fetch) AND the drawer text.
- Prices: the storefront shows '$45.00 USD' on PDP/cards and '$45' (no cents, no currency) in the drawer; /cart.js and /products/<handle>.js use cents (4500). Compare numerically (strip $, USD, commas, .00).
- Do not assert on counts that change with the catalogue ('10 products', blog article count, review counts such as '(156)'): assert shape (integer greater than 0) unless a scenario says otherwise. Do not fail tests on console errors (2-5 third-party errors on every page, up to 15 on a mobile PDP after add to cart).
- Selectors: prefer getByRole / getByLabel / getByText as listed per scenario. Selectors with no semantic equivalent are listed under 'Locators to add to merchants/koh/locators.js'.

VERIFIED PAGE FACTS (live, 2026-10-14)
- Homepage /: title 'Kreatures of Habit - Wellness Solutions For Healthy Habits', canonical https://kreaturesofhabit.com/, meta description starts 'MEAL ONE overnight oats (30g protein), DAILY BAR protein bars (20g protein, 3g creatine, plant based and no seed oils) & KREATURE'S SLEEP.' html lang 'en'. The only H1 is the logo wrapper (h1.header__heading containing a link to / with img.header__heading-logo alt 'Kreatures of Habit', no text). 72 images, 21 with empty alt. Skip link 'Skip to content' (#MainContent). Horizontal scrollWidth 1265 at 1280 wide (no overflow).
- Announcement bar (region 'Announcement', .announcement-bar-section): ONE link 'SAVE 41% ON FIRST-TIME SUBSCRIPTION ORDERS' -> /pages/bundle-builder (not a carousel).
- Header (desktop): logo link / ; nav list links 'OVERNIGHT OATS' -> /products/meal-one-v2, 'PROTEIN BAR' -> /products/daily-bar, 'Bundle & Save' (rendered upper-case by CSS) -> /pages/bundle-builder, 'NOW AT SPROUTS' -> /pages/stores; a fifth li 'SLEEP' -> /products/kreatures-sleep-v2 exists in the DOM but is display:none (the product URL 301-redirects to /, see O10). Right side: link 'Shop Now' -> https://kreaturesofhabit.com/pages/bundle-builder, link 'Log in' -> /a/account/login, button 'Cart' (button#cart-icon-bubble with attribute data-ns-hybrid-cart-open). There is NO search icon or form (features.search false confirmed). The hamburger (summary.header__icon--menu, aria-label 'Menu') is 0x0 on desktop. Header is position relative (not sticky). Cart badge div.cart-count-bubble holds '<n>' plus a visually-hidden '<n> items'; it is display:none when the cart is empty.
- Homepage sections (H2 text): 'WIN THE DAY' hero with H2 'HIGH-PROTEIN OVERNIGHT OATS. CREATINE PROTEIN BARS.', link '4.7 stars | 58,100+ Happy Customers' (#reviwes-home-show, sic), image link and 'SAVE 41% + FREE GIFT' -> /pages/bundle-builder, marquee 'Plant Based, Gluten Free, Non GMO, No Seed Oils, No Artificial Flavors'; 'THE PROBLEM' (30G / 3G / 0 stats); 'THE SOLUTION' with 3 cards: 'Meal One' (links '41% OFF FIRST SUBSCRIPTION ORDER' and 'SHOP MEAL ONE' -> /products/meal-one-v2, 'Starting at $3.37/MEAL', button 'SEE INGREDIENTS'), 'The Daily Bar' ('SHOP BAR' -> /products/daily-bar, 'Starting at $1.97/BAR'), 'Want both? Mix, match, and save.' ('BUNDLE & SAVE' -> /pages/bundle-builder, 'Starting at $3.37/MEAL | $1.97/BAR', its 'SEE INGREDIENTS' button is disabled); 'WHO IT'S BUILT FOR' (6 persona articles); 'THE FOUNDER' (link 'Read Michael's Story →' -> /pages/about-us); 'THE PLAN'; 'CLEAN LABEL CERTIFICATIONS'; testimonial slider (tabs 'Go to page 1/2', SHOP NOW links to the two builder PDPs; the arrow buttons have the accessible names 'Translation missing: en.general.slider.previous' / '...next', O13); 'THE CHOICE' with 'SUBSCRIBE & SAVE 41%' and 'TRY A ONE-TIME ORDER' (both -> /pages/bundle-builder).
- Footer (contentinfo): 'Where you can find us!' social links Facebook https://www.facebook.com/OfficialKreaturesofHabit, Instagram https://www.instagram.com/kreaturesofhabit/, TikTok https://www.tiktok.com/@kreaturesofhabit; newsletter 'Stay Connected with Us!' (textbox 'Your Best Email', button 'SUBMIT': DO NOT SUBMIT); column SHOP: MEAL ONE /products/meal-one-v2, DAILY BAR /products/daily-bar, BUNDLE & SAVE /pages/bundle-builder; column HELP: FAQs /pages/faqs, Contact Us /pages/contact, Shipping Policy /policies/shipping-policy, Refund Policy /policies/refund-policy; column COMPANY: About /pages/about-us, Habit Lab Blog https://kreaturesofhabit.com/blogs/habit-lab, Podcast /pages/podcast, Wholesale https://kreaturesofhabit.com/pages/ws-account-create; 'Let's Get in Touch!' Info@kreaturesofhabit.com (plain text, not a mailto link); bottom bar links Refund policy, Privacy policy /policies/privacy-policy, Terms of service /policies/terms-of-service, Shipping policy, and '© 2026, Kreatures of Habit' (link to /). Link texts are upper-cased by CSS, so match case-insensitively.
- Catalogue (from /products/<handle>.js, 2026-10-14): Black Scripted Hoodie /products/black-hoodie (type Apparel, one option 'Size' XS/S/M/L/XL, all 4500, XL available=false; variant ids XS 40550833193125, S 40307357515941, M 40307357548709, L 40307357581477, XL 40307357614245; skus APRL_HOOD21001_BLK_XS/SM/MD/LG/XL). Oat Scripted Hoodie /products/oatmeal-hoodie (Size XS/S/M/L/XL, 4500, XL sold out; ids XS 40550851117221, S 40476193194149, M 40476193226917, L 40476193259685, XL 40476193292453; skus APRL_HOOD21002_WHT_*). KOH Knit Beanie /products/beanie (single 'Default Title' variant 40307356991653, 2500, sku APRL_BEAN11001_BLK_OS, page title 'KOH Knit Beanie Hat - Kreatures of Habit'). KOH New York Colorway Snapback /products/koh-new-york-colorway-snapback (variant 45562942750938, price 2250, compare_at 4500, title 'KOH New York Colorway Snapback Hat - Kreatures of Habit'). Kreature Kontainer - Glass /products/kreature-kontainer-glass (995). Kreatures Glass Mug /products/glass-cup (price 0, sku GLASS_CUP; the free gift). DAILY BAR 2-Pack Mailer /products/daily-bar-2-pack (price 0; renders the builder template, H1 'THE DAILY BAR.'). Kreature Routine Box /products/kreature-routine-box and '[10% Off]' /products/kreature-routine-box-10-off (price 0, type 'Dynamic Box'). Handle /products/kreatures-sleep-v2 does not exist (301 to /).
- Collection /collections/all: title 'Shop All Products - Protein Oats, Protein Bars & Sleep Aid – Kreatures of Habit', canonical https://kreaturesofhabit.com/collections/all, meta description 'High-protein overnight oats (30g), protein bars (20g + creatine, no seed oils) & natural melatonin free sleep aids. Better habits, better life.' NO H1 (H2s: 'Country/region', 'Item added to your cart', 'Sort by:', 'Sort', '10 products'). Count element #ProductCount '10 products'. Grid ul#product-grid (class 'grid grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1'), no pagination, no facets (only Sort). Sort: select#SortBy (desktop, visible) and select#SortBy-mobile (second copy in the mobile Sort drawer; name='sort_by' matches both so use the id), options manual=Featured, most-relevant=Most relevant, best-selling=Best selling (selected by default), title-ascending, title-descending, price-ascending=Price, low to high, price-descending=Price, high to low, created-ascending, created-descending. Choosing 'Price, low to high' reloads to ?sort_by=price-ascending with order: DAILY BAR 2-Pack Mailer $0.00, Kreature Routine Box $0.00, Kreature Routine Box [10% Off] $0.00, Kreatures Glass Mug $0.00, Kreature Kontainer - Glass $9.95, KOH New York Colorway Snapback $22.50 (struck $45.00), KOH Knit Beanie $25.00, THE DAILY BAR $39.99, Oat Scripted Hoodie $45.00, Black Scripted Hoodie $45.00. Default (best selling) order: THE DAILY BAR, DAILY BAR 2-Pack Mailer, Kreature Kontainer - Glass, Kreatures Glass Mug, KOH Knit Beanie, Oat Scripted Hoodie, Black Scripted Hoodie, KOH New York Colorway Snapback, Kreature Routine Box, Kreature Routine Box [10% Off]. Card (li > .card-wrapper): h3.card__heading with the title link, Junip rating '(156)' etc. where reviews exist, price block div.price ('Regular price $39.99 USD'; sale cards have class price--on-sale: 'Sale price $22.50 USD' + struck 'Regular price $45.00 USD' and span.badge 'Sale'), and a quick-add control: link 'Choose options' (a.quick-add__submit, for THE DAILY BAR, Oat and Black Scripted Hoodie) or button 'ADD TO CART' (button.quick-add__submit[name=add], for the other 7). The two Routine Box cards have no image. Meal One (/products/meal-one-v2), the Daily Duo bundle and the other products in /collections/all/products.json (17 products) are NOT on this page (O1). The THE DAILY BAR card shows '$39.99' without 'from' (a builder product).
- Hoodie PDP (/products/black-hoodie, same for /oatmeal-hoodie): title 'Black Scripted Hoodie - Kreatures of Habit', canonical https://kreaturesofhabit.com/products/black-hoodie, meta description 'Cozy up in our scripted black hoodie, made with 450g 100% french terry cotton. ...'. Vendor line 'A10 Agency' (shown upper-case by CSS on the Oat page, 'A10 AGENCY'). Gallery region 'Gallery Viewer' with button 'Open media 1 in modal', 5 image thumbs 'Load image N in gallery view' plus 'Play video 1 in gallery view' on Black (5 thumbs on Oat). Junip link '3.5 stars, 2 reviews' (2 reviews). H1 'Black Scripted Hoodie'. Price status: 'Regular price $45.00 USD'. Text 'Shipping calculated at checkout.' with link Shipping -> /policies/shipping-policy. Size radiogroup (group 'Size'; radios 'XS' (checked by default), 'S', 'M', 'L', 'XL' with ids template--23763858456794__main-1-0 .. -4 on Black; the radio name attribute is 'Size-1' followed by a CR LF, which also appears as 'Size-1%0D%0A' in the /cart/add POST; labels are label[for$="main-1-N"] and render 50-58 px wide x 36 px high); the XL radio has class 'disabled' and its label contains visually-hidden text 'Variant sold out or unavailable'. Quantity: spinbutton 'Quantity' (input[name=quantity], min 1, value 1) with buttons 'Decrease quantity for Black Scripted Hoodie' and 'Increase quantity for Black Scripted Hoodie' (button[name=minus] / button[name=plus]; Decrease is not marked disabled). Main button 'Add to cart' (button.product-form__submit, 1 match, visible); hidden input form[action="/cart/add"] input[name=id] holds the selected variant id (40550833193125 on load). 'Share' details summary at the bottom. Bullets: 'Custom Heavyweight Sweatshirt', '450g 100% French Terry Cotton', 'Double Paneled Hood Interior', 'Heavyweight Ribbing on Cuff and Waist', 'Enzyme Washed', 'Hidden Waist Synch with Metal Clasp', 'SIZE RUN: XS, S, M, L, XL', 'Male model is 6'0" wearing Large', 'Fit is boxy, drop shoulder - Size up one full size for best fit'. Section 'Customer reviews'. JSON-LD: BreadcrumbList, Product (@graph), Organization and ProductGroup (brand 'A10 Agency'). There is no colour option, no breadcrumb, no sticky bar (O17).
- Hoodie variant behaviour (Black): clicking label 'M' (label[for$="main-1-2"]; a text filter such as hasText /^M$/ failed to find it, use the for attribute or getByText) rewrites the URL WITHOUT reload to ?variant=40307357548709, sets the hidden id to 40307357548709 and keeps 'Add to cart' enabled with '$45.00 USD'. Clicking 'XL' IS possible: URL ?variant=40307357614245, hidden id 40307357614245, the main button becomes 'Sold out' and disabled (disabled attribute true, aria-disabled null), price stays '$45.00 USD'. Loading /products/black-hoodie?variant=40307357548709 preselects M (radio M checked, id 40307357548709).
- Simple products: the snapback PDP has no Size radios (0 radios), H1 'KOH New York Colorway Snapback', price block 'Regular price $45.00 USD Sale price $22.50 USD Sale' (.price-item--regular text-xl shows $22.50 and a struck .price-item--regular $45.00, .price-item--sale $22.50), badges 'Sale' (visible) and 'Sold out' (hidden), hidden id 45562942750938, button 'Add to cart', JSON-LD prices 22.5 / 45.0, section 'Customer reviews'. Glass Mug PDP: H1 'Kreatures Glass Mug', price '$0.00 USD', button 'Add to cart' (purchasable, O3). Kontainer PDP: '$9.95 USD'. Beanie PDP: '$25.00 USD', H1 'KOH Knit Beanie'.
- Add to cart (one-time, non-builder): the PDP button POSTs /cart/add (multipart: id, quantity, 'Size-1\r\n'=<size>) and the drawer opens. After adding Black Scripted Hoodie M: /cart.js item_count 1, total_price 4500, items[0] title 'Black Scripted Hoodie - M', variant_id 40307357548709, quantity 1, price 4500, sku APRL_HOOD21001_BLK_MD, url '/products/black-hoodie?variant=40307357548709'. Header badge '1' ('1 items'). Drawer text for it: 'Your cart (1) | Only $74 left to get free shipping! | 2 Reviews | Black Scripted Hoodie | $45 | Your Free Gifts | Add a subscription to unlock your free gift! | Kreatures Glass Mug | with subscription | Free Gift | REMOVE | FREE | Subtotal | $45 | Shipping + tax | calculated at checkout | CHECKOUT'. The line shows image (alt 'Black Scripted Hoodie - Kreatures of Habit', link to the ?variant= URL), title, price and a number input; the selected SIZE IS NOT SHOWN in the drawer (O4) although /cart.js and the checkout summary ('Oat Scripted Hoodie L 1 $45.00') have it. The drawer has 3 li elements for one product (product, 'Your Free Gifts' group, mug row) and the mug row is a teaser: /cart.js does not contain the mug (O5). Free-shipping bar is price based with a $119 threshold: $45 -> 'Only $74 left to get free shipping!', $90 -> 'Only $29 left...', $135 -> 'Congratulations! You have free shipping!', $25 -> 'Only $94 left...', empty cart -> 'Only $119 left to get free shipping!' (O9). Sale line (snapback): 'Sale price | $22.50 | Original price | $45 | Discount | $22.50 off'.
- Drawer quantity (verified with the Black hoodie M): 'plus' -> POST /cart/update.js {"updates":{"40307357548709:<line key hash>":2}}, quantity input 2, line '$90', 'Your cart (2)', 'Only $29 left to get free shipping!', badge '2', /cart.js 2 / 9000; plus again -> 3, '$135', 'Congratulations! You have free shipping!', 13500. 'minus' at quantity 1 REMOVES the line (cart.js 0/0), unlike the builder lines (O6). The remove button also removes the line. Empty state text: 'Your cart (0) | Only $119 left to get free shipping! | Your cart is empty | Continue Shopping' where 'Continue Shopping' -> /pages/bundle-builder (not /collections/all) and there is no CHECKOUT link, only the 'Close cart' button. In two earlier runs the first 'plus' click ended with an EMPTY cart (cart.js 0 items, drawer 'Your cart is empty') instead of quantity 2; two later runs with request logging (waits of 3 s and after 45 s idle) worked, so this is intermittent and unexplained (O7). After a reload the badge is hidden (0).
- /cart is not a page: https://kreaturesofhabit.com/cart redirects (301/302) to https://kreaturesofhabit.com/?cart=open (the homepage with the drawer open, title of the homepage).
- Quick add from /collections/all: clicking button 'Add to cart KOH Knit Beanie' (accessible name includes the product) adds variant 40307356991653 (/cart.js 1 / 2500) and opens the drawer ('Your cart (1) | Only $94 left to get free shipping! | 1 Reviews | KOH Knit Beanie | $25 | ... | Subtotal | $25'); the page stays on /collections/all?sort_by=price-ascending.
- Mixed cart: Beanie (quick add) then Oat Scripted Hoodie L (?variant=40476193259685, preselected) gives /cart.js 2 items, total 7000, lines 'Oat Scripted Hoodie - L' (40476193259685) and 'KOH Knit Beanie' (40307356991653); drawer lists the newest line first: 'Your cart (2) | Only $49 left to get free shipping! | 2 Reviews | Oat Scripted Hoodie | $45 | 1 Reviews | KOH Knit Beanie | $25 | Your Free Gifts ... | Subtotal | $70'; header badge '2'. A cart with builder boxes was not built live (the builder needs the 2-box minimum), it is optional in scenario 4.4.
- Checkout hand-off: the drawer link 'CHECKOUT' (href /checkout, 494x60 at x 758 y 636 for the 2-line cart) navigates to https://kreaturesofhabit.com/checkouts/cn/<token>/en-us?_r=... with title 'Checkout - Kreatures of Habit' within a few seconds. The visible summary text reads 'Order summary | Shopping cart | Oat Scripted Hoodie L 1 $45.00 | KOH Knit Beanie 1 $25.00 | Discount code or gift card ... | Subtotal · 2 items $70.00 | Shipping Enter shipping address | Total USD $70.00'. Nothing was filled or submitted.
- Content pages (HTTP 200 each, fetched once): /pages/about-us title 'About Us - Kreatures of Habit | Health and Wellness', H1 'About Us | Kreatures of Habit | Health and Wellness' (visible), H2 'ABOUT US', 'MEET MICHAEL', H3 'I FELL IN LOVE WITH FINDING OUT WHO I WAS AND WHO I COULD BE THROUGH POSITIVE HABITS.', 2 visible images (both without alt), no links in main, text mentions KREATURE'S SLEEP; /pages/faqs title 'FAQs - Your Questions Answered - Kreatures of Habit' (no H1, no H2); /pages/contact title 'Contact Us - Kreatures of Habit' (H2 'CONTACT', textboxes 'Name', 'Email', 'Message', text 'This site is protected by hCaptcha and the hCaptcha Privacy Policy and Terms of Service apply.', button 'Submit Message': DO NOT SUBMIT; no H1); /pages/stores title 'Kreatures of Habit | THE DAILY BAR | Now At Your Local Sprouts' (H2 'Find Daily Bar at Your Local Sprouts', no H1); /pages/podcast title 'Our Podcast - Kreatures of Habit' (no H1/H2); /blogs/habit-lab title 'Habit Lab – Kreatures of Habit', H1 'Habit Lab', H2 'THE KREATURES OF HABIT PODCAST', article cards (H3 e.g. 'Week 1: Stop trying to quit. Start adding.', 'Finish the Year Strong: 13 habits, 13 weeks, on...', dated like 'SEPTEMBER 29, 2026') linking to /blogs/habit-lab/<slug> (e.g. /blogs/habit-lab/finish-the-year-strong-week-1, /blogs/habit-lab/take-the-swing, /blogs/habit-lab/the-daily-bar-is-available-in-sprouts-nationwide), pagination links ?page=2, ?page=3, 0 broken images; /policies/shipping-policy, /policies/refund-policy, /policies/privacy-policy, /policies/terms-of-service titles 'Shipping policy – Kreatures of Habit', 'Refund policy – ...', 'Privacy policy – ...', 'Terms of service – ...' each with an H1 equal to the policy name; /pages/ws-account-create title 'Wholesale Registration Form – Kreatures of Habit', H1 'Wholesale Registration Form', text 'Already have an account? Login here.', H2 'Customer Information', 1 form with 13 inputs and button 'Continue' (DO NOT SUBMIT); /a/account/login title 'Kreatures of Habit' (generic), H1 'Welcome!', H2 'Access your account and manage your orders', text 'Skio Secured', textbox 'Email' (placeholder 'Your email'), button 'Get login code (sends SMS and email)' (NEVER CLICK), link 'Log in with Shopify instead' -> https://kreaturesofhabit.com/account/login?return_url=/a/account/shopify-login.
- FAQ /pages/faqs: 52 accordion items in 6 groups (labels 'MEAL ONE', 'KREATURE'S SLEEP', 'THE DAILY BAR', 'ORDERS', 'SHIPPING', 'SUBSCRIPTIONS'); each question is div[data-faq-button] with aria-expanded and aria-controls=faq-<id> (no role=button, no tabindex), inside div[data-faq] in div[data-faq-group]. The page loads with all items collapsed in the accessibility tree sense (aria-expanded false, panel height 0, overflow hidden). Clicking 'What are net carbs?' sets aria-expanded true and the panel to about 125 px high (answer '(Carbs minus fiber)'); clicking another question ('Is this high in sugar?') closes the previous one: the accordion is EXCLUSIVE across the whole page (only one aria-expanded true at any time). Answers contain links 'Send us a note' / 'contact us' -> https://kreaturesofhabit.com/pages/contact. Content questions of note: 'Can I order less than the 8-pack?' and 'all flavors are sold in boxes of 7 pouches' (differs from the builder, O14).
- Store locator /pages/stores (H1 Apps widget): comboboxes 'Enter Address or Zip Code', distance ('-- miles', 5/10/25/50/100 miles) and 'Or, Filter by Category' ('All Locations'), text 'Loading locations...' then, after about 4 s, 'No locations found' / 'Try adjusting your search or filters', 'Powered by H1 Apps', and Google Maps shows 'This page can't load Google Maps correctly. Do you own this website?' with an 'OK' button (O11).
- Redirects and 404: GET /pages/this-page-does-not-exist-qa -> 301 to / (lands on the homepage, status 200, no 404 page); GET /products/kreatures-sleep-v2 -> 301 to /; GET /products/zzz-not-a-real-product and /collections/zzz-not-real -> HTTP 404 with title '404 Not Found – Kreatures of Habit'; the product 404 page shows paragraph '404', H1 'Page not found', link 'Continue shopping' -> /collections/all (no announcement bar was seen in the snapshot).
- Mobile 390x844 (verified): scrollWidth 375 on homepage, PDP and collection (no overflow). Header: hamburger summary.header__icon--menu 40x40 at x 315 y 43, cart button 28x40, logo 54x42, 'Shop Now' 98x38. Tapping the hamburger opens #menu-drawer full screen (390x844 at 0,0, details[open], aria-expanded true) with links OVERNIGHT OATS, PROTEIN BAR, BUNDLE & SAVE, NOW AT SPROUTS (each 45 px high), My Account -> /a/account/login (44), Log in -> /account/login (40), Facebook, Instagram, TikTok (44) and a country picker button 'United States | USD $' plus a 'Close' button; Escape closes it. The hidden SLEEP link is not shown. Collection on mobile: single column (cards 345 px wide at x 15), quick-add controls 321x47, the sort combobox 'Sort by:' plus a 'Sort' summary. Hoodie PDP on mobile: Size labels XS 58x36, S 50x36, M 52x36, L 50x36, XL 58x36; quantity buttons 45x47; 'Add to cart' 345x60 at x 15; after choosing L (?variant=40307357581477) and Add to cart: /cart.js 1 item 'Black Scripted Hoodie - L'; the drawer is a floating card 372x826 at x 9 y 9 with plus 32x28, minus 32x28, remove 32x32, 'Close cart' 32x32, CHECKOUT 348x52 at x 21 y 775 (inside the viewport), drawer page scrollWidth 390.

OBSERVATIONS (possible defects found while exploring - scenarios below are designed to detect them, not to assume them)
- O1. /collections/all lists only 10 products ('10 products') while /collections/all/products.json returns 17 (it also contains meal-one-v2, the 14-day starter kit, the Daily Duo bundle, two Skio subscription products, Meal One Blueberry Banana pouch and the-kreature-kontainer). The main products Meal One and the Daily Duo are not on the grid, the page title promises 'Protein Oats, Protein Bars & Sleep Aid' and the meta description 'natural melatonin free sleep aids' but there is no sleep product (see O10). P3 content/merchandising question; scenario 2.1 records the list.
- O2. /collections/all has no H1 (SEO/accessibility); FAQ, contact, stores and podcast pages also have no H1, and the homepage H1 is the empty logo wrapper. P3.
- O3. Three $0.00 items are sellable: 'Kreatures Glass Mug' (/products/glass-cup), 'DAILY BAR 2-Pack Mailer' and 'Kreature Routine Box' / '[10% Off]' show 'Regular price $0.00 USD' with a working 'ADD TO CART' on /collections/all, the Mug PDP shows 'Add to cart' at '$0.00 USD' (a customer can add a free mug without subscribing). The two Routine Box cards have no image. P2 candidate (merchant intent: these look like internal/gift products that should be hidden or unavailable).
- O4. The cart drawer line does not show the chosen variant: 'Black Scripted Hoodie $45' for size M and 'Oat Scripted Hoodie $45' for size L, while /cart.js has 'Black Scripted Hoodie - M' and the checkout summary shows 'Oat Scripted Hoodie L'. Customers cannot confirm their size in the drawer. P2/P3.
- O5. Gift teaser in non-subscription carts: for a cart holding only a hoodie/beanie/snapback the drawer shows 'Your Free Gifts | Add a subscription to unlock your free gift! | Kreatures Glass Mug | with subscription | Free Gift | REMOVE | FREE' although /cart.js has no mug; a REMOVE button is offered for an item that is not in the cart and the label 'Free Gift'/'FREE' is shown before it is unlocked. Also makes '#ns-hybrid-cart li' count 3 for one product. P3.
- O6. Drawer 'minus' at quantity 1 removes the hoodie line (cart goes to 0), whereas for builder lines the bundle plan records that 'minus' does not delete at 1 (specs/koh-bundle-builder.md). Inconsistent behaviour; scenario 4.2 records the actual one.
- O7. Intermittent: in 2 of 4 runs the FIRST drawer 'plus' click on a freshly added hoodie left the cart empty (cart.js item_count 0 and 'Your cart is empty') instead of quantity 2; in the other 2 runs it worked (POST /cart/update.js with the line key and quantity 2). Not explained (maybe stale line key after a delay or a race with the gift-row logic). Scenario 4.2 repeats it with a request log; if it reproduces it is a P1 candidate (cart emptied by plus).
- O8. Empty cart: the drawer still shows the free-shipping bar 'Only $119 left to get free shipping!', its 'Continue Shopping' link goes to /pages/bundle-builder (not the shop grid), and after removing the last line the header badge text in the DOM still read '1' / '1 items' until the page was reloaded (visibility of the bubble not verified). P3.
- O9. Free-shipping messaging is price based for these products ($119 threshold: 'Only $74 left...') while the builder uses a box count ('Add 1 more...'), and the FAQ says shipping takes 3 to 7 business days with no thresholds. Record only (merchant rule).
- O10. Unknown /pages/* URLs 301-redirect to the homepage (soft 404; no 'Page not found'), while /products/* and /collections/* return real 404 pages. The header's hidden SLEEP link and handle /products/kreatures-sleep-v2 also 301 to the homepage, yet the FAQ ('KREATURE'S SLEEP' section), the About page, the homepage meta description and the collection title still advertise Sleep. P3.
- O11. /pages/stores (nav link 'NOW AT SPROUTS', footer-independent) shows 'No locations found' and 'This page can't load Google Maps correctly. Do you own this website?' (Google Maps API key/billing error) so the Sprouts store finder is unusable. P2.
- O12. Accessibility: FAQ questions are div[data-faq-button] without role=button/tabindex (not keyboard reachable); homepage has 21 of 72 images with empty alt and the About page's 2 images have no alt; the hoodie size radios have a malformed name 'Size-1' + CRLF (harmless but visible in /cart/add as 'Size-1%0D%0A'); the homepage reviews anchor id is misspelled '#reviwes-home-show'.
- O13. Untranslated accessible names 'Translation missing: en.general.slider.previous' and 'Translation missing: en.general.slider.next' on the homepage testimonial slider arrows. P3.
- O14. Content inconsistencies: homepage step 02 says 'The Daily Bar ... 0g protein. 3g creatine' (elsewhere 20g protein); 'THE PROBLEM' says 91K+ customers, hero says 58,100+ Happy Customers and the reviews section says '3,275+ customers'; FAQ mentions boxes of 7 pouches and an '8-pack' while the builder sells 7 meals per box; 'Finish the Year Strong' blog titles are truncated with '...' literally. P3.
- O15. Mobile tap targets below 44 px: header cart button 28x40, hamburger 40x40, hoodie Size labels 36 px high, drawer plus/minus 32x28, remove and 'Close cart' 32x32. P3.
- O16. Third-party console errors on every page (2-5, up to 15 on a mobile PDP after add to cart). Noise only.
- O17. The hoodies are two separate products (Black / Oat) tagged _paired_group-hoodie but with no colour selector or cross link on the PDP, no breadcrumb and no sticky add-to-cart bar; the vendor 'A10 Agency' (a supplier name) is shown as the brand line. P3.
- O18. productPrice locator is ambiguous on sale items: '.price-item--regular' matches two nodes on the snapback PDP and the FIRST one reads '$22.50 USD' (the sale price) while the struck '$45.00 USD' is second, and on a card the order is the same; the PDP 'Sold out' badge is in the DOM while hidden.

Stale or risky selectors in merchants/koh/locators.js (verified live 2026-10-14)
- cartDrawer '#ns-hybrid-cart': NOT stale. The report that the drawer has no id is true for the HOST <ns-hybrid-cart> only; the id is on the inner role=dialog div inside the open shadow root and Playwright pierces it (count 1, visible when open). Keep it, but document that document.querySelector cannot see it.
- cartDrawerClose '#ns-hybrid-cart button:has-text("Close cart")': STALE, 0 matches (the button has aria-label 'Close cart' and no text). Use '#ns-hybrid-cart button[aria-label="Close cart"]' (1 match, visible) or getByRole('button',{name:'Close cart'}).
- miniCartDrawer '.cart-notification, .cart-drawer, #CartDrawer, [class*="cart-drawer"]': misleading. It matches one HIDDEN element (the Dawn 'Item added to your cart' notification) and never the real drawer. Point it at '#ns-hybrid-cart' or stop using it.
- cartItem '#ns-hybrid-cart li': matches 3 li for one product (product + 'Your Free Gifts' group + mug teaser); filter to rows containing a link to /products/ (as CartPage does) or use '#ns-hybrid-cart li:has(a[href^="/products/"])'.
- productPrice '...,.price-item--regular': ambiguous on sale products (see O18); for sale items read '.price-item--sale' and the struck '.price-item--regular:not(.text-xl)'.
- addToCartBtn 'button[name="add"], .pfp__atc, button.product-form__submit': correct on a PDP (1 visible match) but on /collections/all it matches 7 quick-add buttons (button.quick-add__submit[name=add]), so scope to the product form (form[action="/cart/add"]) on PDPs and use quickAddBtn on the grid.
- productTitle 'h1': no match on /collections/all, FAQ, contact, stores, podcast; on the homepage it is the logo wrapper. Use it on PDPs and the blog/policy pages only.
- hero '.hero, .hero-section, [class*="hero"]': 0 matches outside the homepage (1 region, class 'hero-banner ... home_page_hero_banner', on the homepage). promoBar '[class*="announcement"]' matches 5 elements on /collections/all (use '.announcement-bar-section').
- popupClose: 0 matches in about 25 page loads (no Klaviyo popup appeared); keep but it is unverified this session. searchButton and searchForm: 0 matches (consistent with features.search false). config.pages.search '/search?q=oats' was not loaded (no search UI) and config.pages.cart '/cart' redirects to '/?cart=open'.
- config.navLinks (Overnight Oats, Protein Bar) are right but incomplete: the visible header also has 'Bundle & Save' (/pages/bundle-builder) and 'NOW AT SPROUTS' (/pages/stores); the hidden 'SLEEP' li is a dead link (301 to /).
- OK as written (verified): header, logo 'img.header__heading-logo', productCard '.card-wrapper' (10), quickAddBtn (10 matches: 3 links 'Choose options' and 7 buttons), cartBadge '.cart-count-bubble' (hidden when 0), mobileMenu '#menu-drawer', hamburger 'summary[aria-label*="menu" i]' (0x0 on desktop, 40x40 on mobile), cartIcon '#cart-icon-bubble', cartQuantityInput, cartQtyPlus/Minus/Remove, cartSubtotal 'div:has(> p:text-is("Subtotal"))' (1 match), cartItemTitle 'p.line-clamp-2'.

Locators to add to merchants/koh/locators.js (verified 2026-10-14; do not inline these in specs)
- cartDrawerCloseBtn: '#ns-hybrid-cart button[aria-label="Close cart"]' (replaces cartDrawerClose); cartCheckoutLink: '#ns-hybrid-cart a[href="/checkout"]'; cartGiftRow: '#ns-hybrid-cart [data-koh-remove-gift]' (teaser, see O5); cartProductRow: '#ns-hybrid-cart li:has(a[href^="/products/"])'; cartHeader: '#ns-hybrid-cart-header'; cartBackdrop: '#ns-hybrid-cart-backdrop'; cartHost: 'ns-hybrid-cart' (for shadowRoot evaluate); cartEmptyText: '#ns-hybrid-cart :text("Your cart is empty")'; cartContinueShopping: '#ns-hybrid-cart a:has-text("Continue Shopping")'.
- headerNavLinks: 'header nav a' (filter by visibility; the SLEEP li is display:none); headerShopNow: 'header a:text-is("Shop Now")'; headerLogin: 'header a[href="/a/account/login"]'; announcementBar: '.announcement-bar-section'; menuSummary: 'header summary.header__icon--menu' (mobile only); menuClose: '#menu-drawer button:has-text("Close")'.
- productCount: '#ProductCount'; productGrid: '#product-grid'; sortSelect: '#SortBy' (desktop) / '#SortBy-mobile'; productCardTitle: '.card-wrapper h3.card__heading'; productCardPrice: '.card-wrapper .price'; productCardSaleBadge: '.card-wrapper .badge'.
- pdpSizeRadio: 'fieldset input[type="radio"]' (radiogroup 'Size'; sold-out ones have class 'disabled'); pdpSizeLabel: 'label[for$="main-1-<n>"]' or getByText(size, {exact:true}) inside the Size group; pdpVariantId: 'form[action="/cart/add"] input[name="id"]'; pdpAddToCart: 'form[action="/cart/add"] button.product-form__submit'; pdpQtyInput: 'input[name="quantity"]'; pdpQtyPlus: 'button[name="plus"]'; pdpQtyMinus: 'button[name="minus"]'; pdpPriceSale: '.price-item--sale'; pdpSoldOutBadge: '.badge:text-is("Sold out")'.
- faqButton: '[data-faq-button]' (attributes aria-expanded, aria-controls); faqGroup: '[data-faq-group]'.
- footerNewsletterInput: 'footer input[type="email"], footer textbox "Your Best Email"' (DO NOT SUBMIT); socialLinks: 'footer a[href*="facebook.com"], footer a[href*="instagram.com"], footer a[href*="tiktok.com"]'.
- Config additions (config.js): pages.faq '/pages/faqs', pages.contact '/pages/contact', pages.about '/pages/about-us', pages.stores '/pages/stores', pages.blog '/blogs/habit-lab', pages.podcast '/pages/podcast', pages.wholesale '/pages/ws-account-create', pages.policies shipping/refund/privacy/terms under /policies/, pages.notFoundProduct '/products/zzz-not-a-real-product'; products.apparel black-hoodie/oatmeal-hoodie (sizes XS S M L XL, sold-out size XL, price 4500), products.simple beanie (4500 -> 2500), products.sale koh-new-york-colorway-snapback (2250/4500), products.free glass-cup (0); navLinks adding Bundle & Save and Now at Sprouts.

## Test Scenarios

### 1. 1. Homepage and navigation

**Seed:** `tests/seed.spec.ts`

#### 1.1. 1.1. Homepage loads with title, meta, header, logo, cart button and no broken images

**File:** `tests/generated/koh-core-storefront/homepage-navigation.spec.ts`

**Steps:**
  1. Open the homepage (merchant.pages.homepage), close the Klaviyo popup via 'Close dialog' if it appears, and read title, canonical, meta description and headings.
    - expect: HTTP 200, title 'Kreatures of Habit - Wellness Solutions For Healthy Habits', canonical https://kreaturesofhabit.com/, meta description non-empty and starting 'MEAL ONE overnight oats (30g protein)'.
    - expect: Exactly one H1 (class header__heading) that holds the logo image alt 'Kreatures of Habit' and has no text; log it (O2/O12). Page scrollWidth is at most 1280.
  2. Inspect the header (desktop).
    - expect: Logo link to /, nav links 'OVERNIGHT OATS' (/products/meal-one-v2), 'PROTEIN BAR' (/products/daily-bar), 'Bundle & Save' (/pages/bundle-builder), 'NOW AT SPROUTS' (/pages/stores) are visible (match case-insensitively); link 'Shop Now' (/pages/bundle-builder), link 'Log in' (/a/account/login) and button 'Cart' (#cart-icon-bubble) are visible.
    - expect: There is no search icon or search form (searchButton/searchForm count 0), the hamburger is not visible on desktop, the cart badge .cart-count-bubble is hidden when the cart is empty, and no visible image has naturalWidth 0.
  3. Click the logo from /collections/all (separate load) and click button 'Cart' on the homepage, then close the drawer with the 'Close cart' button.
    - expect: The logo returns to path '/' with the hero visible.
    - expect: The drawer (#ns-hybrid-cart) opens showing 'Your cart (0)', 'Your cart is empty' and 'Continue Shopping'; after 'Close cart' it is no longer visible. Never touch the footer 'Your Best Email' / 'SUBMIT'.

#### 1.2. 1.2. Announcement bar and hero calls to action lead to the bundle builder

**File:** `tests/generated/koh-core-storefront/homepage-navigation.spec.ts`

**Steps:**
  1. Read the region 'Announcement' on the homepage.
    - expect: Single link 'SAVE 41% ON FIRST-TIME SUBSCRIPTION ORDERS' with href /pages/bundle-builder (no carousel, no '1 / 3' groups).
  2. Read all CTA hrefs in the hero and in 'THE SOLUTION' / 'THE CHOICE' without clicking each one: 'SAVE 41% + FREE GIFT', the hero image link, 'SHOP MEAL ONE', 'SHOP BAR', 'BUNDLE & SAVE', 'SUBSCRIBE & SAVE 41%', 'TRY A ONE-TIME ORDER', 'Read Michael's Story →'.
    - expect: Hrefs are /pages/bundle-builder (SAVE 41% + FREE GIFT, image link, BUNDLE & SAVE, SUBSCRIBE & SAVE 41%, TRY A ONE-TIME ORDER), /products/meal-one-v2 (SHOP MEAL ONE), /products/daily-bar (SHOP BAR) and /pages/about-us (Read Michael's Story →). The Meal One card text includes 'Starting at $3.37/MEAL' and the Bar card 'Starting at $1.97/BAR'.
  3. Click 'SHOP MEAL ONE' (noWaitAfter) and wait for the URL, then go back and click the announcement link.
    - expect: URL is /products/meal-one-v2 with H1 'MEAL ONE.' (builder PDP, not tested further here); the announcement link lands on /pages/bundle-builder with H1 'BUNDLE & SAVE' (title contains 'Bundle Builder'). No 404 title on either.

#### 1.3. 1.3. Header navigation links reach live pages and the hidden SLEEP link is dead

**File:** `tests/generated/koh-core-storefront/homepage-navigation.spec.ts`

**Steps:**
  1. From merchant.navLinks plus the extra visible links, open each of 'OVERNIGHT OATS', 'PROTEIN BAR', 'Bundle & Save' and 'NOW AT SPROUTS' with one goto each (via a click from the homepage or a direct URL).
    - expect: Each URL matches (/meal-one-v2, /daily-bar, /pages/bundle-builder, /pages/stores), responds 200 and has a non-empty title without '404'.
  2. Read the hidden header li 'SLEEP' (display:none) and request /products/kreatures-sleep-v2 once with page.request.get(maxRedirects:0).
    - expect: The link exists with href /products/kreatures-sleep-v2 but is not visible (bounding width 0); the request returns 301 with location '/' (O10). Log that a dead link remains in the DOM; do not assert that it is visible.
  3. Click 'Log in' in the header and assert only the URL, then go back.
    - expect: URL path is /a/account/login, the H1 is 'Welcome!' and the title is 'Kreatures of Habit'. Type and click nothing (no 'Get login code').

#### 1.4. 1.4. Footer columns, policy links and social links

**File:** `tests/generated/koh-core-storefront/homepage-navigation.spec.ts`

**Steps:**
  1. Scroll to the footer (contentinfo) on the homepage and read headings and links without submitting anything.
    - expect: Headings 'Where you can find us!', 'Stay Connected with Us!', 'SHOP', 'HELP', 'COMPANY', 'Let's Get in Touch!'.
    - expect: Links with hrefs: MEAL ONE /products/meal-one-v2, DAILY BAR /products/daily-bar, BUNDLE & SAVE /pages/bundle-builder, FAQs /pages/faqs, Contact Us /pages/contact, Shipping Policy /policies/shipping-policy, Refund Policy /policies/refund-policy, About /pages/about-us, Habit Lab Blog /blogs/habit-lab, Podcast /pages/podcast, Wholesale /pages/ws-account-create, Privacy policy /policies/privacy-policy, Terms of service /policies/terms-of-service, and '© 2026, Kreatures of Habit' linking to /.
    - expect: Social links Facebook (facebook.com/OfficialKreaturesofHabit), Instagram (instagram.com/kreaturesofhabit/) and TikTok (tiktok.com/@kreaturesofhabit) are present (assert the hrefs, do not follow them); the text Info@kreaturesofhabit.com is visible; the textbox 'Your Best Email' and 'SUBMIT' exist but are untouched.
  2. Verify every internal footer href once with fetch() from the page (1.2 s apart) and compare the status.
    - expect: Every internal footer link returns 200 (after redirects) and none lands on the homepage title unexpectedly; list any that redirect.

### 2. 2. Collection /collections/all

**Seed:** `tests/seed.spec.ts`

#### 2.1. 2.1. Product grid renders complete cards

**File:** `tests/generated/koh-core-storefront/collection.spec.ts`

**Steps:**
  1. Open merchant.pages.collection (/collections/all) and wait for .card-wrapper.
    - expect: Title 'Shop All Products - Protein Oats, Protein Bars & Sleep Aid – Kreatures of Habit', canonical https://kreaturesofhabit.com/collections/all, no H1 (log O2), #ProductCount matches /^\d+ products$/ and equals the number of .card-wrapper elements (10 on 2026-10-14, O1), no pagination control.
  2. Read every card: title, price block, link, image and quick-add control.
    - expect: Each card has a non-empty h3.card__heading, a link to /products/<handle>, a price matching /\$\d+\.\d\d USD/, and exactly one quick-add control ('Choose options' link for THE DAILY BAR, Oat Scripted Hoodie and Black Scripted Hoodie, 'ADD TO CART' button for the rest).
    - expect: Visible images have naturalWidth greater than 0 after scrolling them into view; the two 'Kreature Routine Box' cards have no image (record, O3). The Snapback card shows badge 'Sale', 'Sale price $22.50 USD' and struck 'Regular price $45.00 USD'. Record the $0.00 cards (Mug, Mailer, two Routine Boxes) as O3.

#### 2.2. 2.2. Card data matches the product page and product JSON

**File:** `tests/generated/koh-core-storefront/collection.spec.ts`

**Steps:**
  1. For the cards Black Scripted Hoodie, Oat Scripted Hoodie, KOH Knit Beanie, KOH New York Colorway Snapback and Kreature Kontainer - Glass, fetch /products/<handle>.js in the same context.
    - expect: Card title equals the JSON title; card price equals JSON price/100 (45.00, 45.00, 25.00, 22.50 with 45.00 struck, 9.95); the Snapback compare_at_price (4500) equals the struck card price.
  2. Click the Black Scripted Hoodie card link (noWaitAfter) and wait for the URL.
    - expect: URL path /products/black-hoodie, H1 'Black Scripted Hoodie' equals the card title, PDP price '$45.00 USD' equals the card, document title 'Black Scripted Hoodie - Kreatures of Habit'. Browser Back returns to the grid with the cards rendered.
  3. Click 'Choose options' on the Oat Scripted Hoodie card (separate load).
    - expect: It navigates to /products/oatmeal-hoodie (not a modal) and the Size group is shown with XS preselected.

#### 2.3. 2.3. Sort by price, title and date reorders the grid

**File:** `tests/generated/koh-core-storefront/collection.spec.ts`

**Steps:**
  1. Read #SortBy (use the id, name=sort_by matches two selects) on a fresh load.
    - expect: Options Featured, Most relevant, Best selling (selected), Alphabetically A-Z, Alphabetically Z-A, Price low to high, Price high to low, Date old to new, Date new to old.
  2. Select 'Price, low to high' and wait for the URL.
    - expect: URL is /collections/all?sort_by=price-ascending; the numeric price of the cards is non-decreasing using the sale price for the Snapback (0,0,0,0,9.95,22.50,25.00,39.99,45,45 on 2026-10-14); #ProductCount unchanged.
  3. Select 'Price, high to low' then 'Alphabetically, A-Z' (one change per page state).
    - expect: High to low is non-increasing (first card is a $45 hoodie, last a $0 item); A-Z titles are sorted case-insensitively; URL parameters sort_by=price-descending / title-ascending; the same 10 products in every order (no product lost or duplicated).

#### 2.4. 2.4. Quick add from a card adds the product and opens the drawer

**File:** `tests/generated/koh-core-storefront/collection.spec.ts`

**Steps:**
  1. On a fresh /collections/all click button 'Add to cart KOH Knit Beanie' once.
    - expect: /cart.js shows exactly one line 'KOH Knit Beanie', variant_id 40307356991653, quantity 1, price 2500, sku APRL_BEAN11001_BLK_OS; the drawer (#ns-hybrid-cart) opens with 'Your cart (1)', 'KOH Knit Beanie', '$25' and 'Only $94 left to get free shipping!'; the URL stays on /collections/all; header badge 1.
  2. Close the drawer ('Close cart'), reload and verify persistence; do NOT add a second item on this load.
    - expect: After the reload the badge reads 1 and /cart.js still has the beanie. Clear the cart at the end (item_count 0).

### 3. 3. Hoodie product pages and variants

**Seed:** `tests/seed.spec.ts`

#### 3.1. 3.1. Hoodie product page content matches the product JSON

**File:** `tests/generated/koh-core-storefront/hoodie-pdp.spec.ts`

**Steps:**
  1. Open /products/black-hoodie and fetch /products/black-hoodie.js.
    - expect: H1 and JSON title 'Black Scripted Hoodie'; title 'Black Scripted Hoodie - Kreatures of Habit'; canonical https://kreaturesofhabit.com/products/black-hoodie; meta description starts 'Cozy up in our scripted black hoodie'; price '$45.00 USD' equals the preselected XS variant (JSON price 4500); the Size group lists XS, S, M, L, XL equal to the JSON option values; JSON-LD contains Product and ProductGroup.
  2. Inspect the gallery, bullets and reviews area.
    - expect: 5 'Load image N in gallery view' thumbs plus 'Play video 1 in gallery view'; visible images load (naturalWidth greater than 0); bullets 'Custom Heavyweight Sweatshirt' ... 'SIZE RUN: XS, S, M, L, XL' present; link 'Shipping' -> /policies/shipping-policy; a Junip rating link ('3.5 stars, 2 reviews') and the 'Customer reviews' section exist (assert shape, not the count); vendor line 'A10 Agency' (log O17).
  3. Repeat the same checks on /oatmeal-hoodie (separate load) for title 'Oat Scripted Hoodie - Kreatures of Habit', H1 'Oat Scripted Hoodie', price $45.00 USD, 5 thumbs.
    - expect: All checks pass; XL is the only radio with class 'disabled'.

#### 3.2. 3.2. Size selection updates variant id, URL and price

**File:** `tests/generated/koh-core-storefront/hoodie-pdp.spec.ts`

**Steps:**
  1. On /products/black-hoodie click the Size label 'M' (label[for$="main-1-2"]; do not use hasText /^M$/).
    - expect: Radio M is checked; URL becomes /products/black-hoodie?variant=40307357548709 without a reload; hidden form input[name=id] = 40307357548709; price '$45.00 USD' equals the M variant price in /products/black-hoodie.js (4500); main button 'Add to cart' enabled.
  2. Click each of XS, S, L in turn (one selection at a time).
    - expect: Each gives its variant id (40550833193125, 40307357515941, 40307357581477) in both the URL and the hidden input, and the price stays '$45.00 USD' (all variants 4500); only one radio checked at a time.
  3. Open /products/black-hoodie?variant=40307357581477 directly (separate load).
    - expect: Radio L is checked on load and the hidden id is 40307357581477 (deep link works).

#### 3.3. 3.3. Sold-out size XL is selectable but cannot be added

**File:** `tests/generated/koh-core-storefront/hoodie-pdp.spec.ts`

**Steps:**
  1. Read the XL radio and label on /products/black-hoodie before clicking.
    - expect: Radio XL has class 'disabled' and its label contains the text 'Variant sold out or unavailable' (visually hidden); /products/black-hoodie.js reports variant 40307357614245 available=false.
  2. Click the XL label.
    - expect: URL ?variant=40307357614245, hidden id 40307357614245, the main button text becomes 'Sold out' and is disabled; price remains '$45.00 USD'; /cart.js item_count stays 0 (do not click the disabled button with force).
  3. Click the S label afterwards.
    - expect: The button returns to 'Add to cart' and is enabled (state recovers).
  4. Repeat the XL check on /products/oatmeal-hoodie (variant 40476193292453).
    - expect: Same 'Sold out' disabled state.

#### 3.4. 3.4. Add to cart with a chosen size adds exactly that variant

**File:** `tests/generated/koh-core-storefront/hoodie-pdp.spec.ts`

**Steps:**
  1. Clear the cart, open /products/black-hoodie, click label M, set nothing else and click 'Add to cart' once.
    - expect: The drawer opens; /cart.js has exactly one line: title 'Black Scripted Hoodie - M', variant_id 40307357548709, quantity 1, price 4500, sku APRL_HOOD21001_BLK_MD, url '/products/black-hoodie?variant=40307357548709'; header badge 1.
  2. Read the drawer line and its title link.
    - expect: The line shows 'Black Scripted Hoodie' and '$45' and a link to /products/black-hoodie?variant=40307357548709; record that the size 'M' is not displayed (O4); the number input shows 1.
  3. Close the drawer, reload /products/black-hoodie?variant=40307357548709 (separate load), set Quantity to 2 using the 'Increase quantity for Black Scripted Hoodie' button and add once.
    - expect: /cart.js shows the same variant with quantity 3 (1 + 2) or two lines only if the line key differs; record which. Total 13500. Clear the cart at the end (item_count 0).

### 4. 4. Cart for non-builder products

**Seed:** `tests/seed.spec.ts`

#### 4.1. 4.1. Drawer shows line, totals, free-shipping bar and gift teaser after adding a hoodie

**File:** `tests/generated/koh-core-storefront/cart.spec.ts`

**Steps:**
  1. Clear the cart, add Black Scripted Hoodie M from its PDP once and read the drawer.
    - expect: Drawer text contains 'Your cart (1)', 'Only $74 left to get free shipping!', 'Black Scripted Hoodie', '$45', 'Subtotal', '$45', 'Shipping + tax calculated at checkout' and a link 'CHECKOUT' (href /checkout); remaining amount equals 119 minus the subtotal.
    - expect: The 'Your Free Gifts' teaser ('Add a subscription to unlock your free gift!', 'Kreatures Glass Mug', 'with subscription') is present while /cart.js contains no mug: record O5 and do not click the gift REMOVE button.
  2. Click the product title link or thumbnail inside the drawer.
    - expect: The browser opens /products/black-hoodie?variant=40307357548709 and the Size M radio is checked.

#### 4.2. 4.2. Drawer plus, minus and remove keep the line, total and /cart.js in sync

**File:** `tests/generated/koh-core-storefront/cart.spec.ts`

**Steps:**
  1. With one hoodie M line, attach a request log for /cart/update.js|change.js, wait 3 s, click 'plus' once and wait with auto-retrying expects.
    - expect: Quantity input 2, line '$90', 'Your cart (2)', 'Only $29 left to get free shipping!', badge 2, /cart.js 2 / 9000. If instead /cart.js becomes 0 items, capture the request and response and report it as O7 (P1 candidate: plus emptied the cart).
  2. Click 'plus' again, then 'minus' twice.
    - expect: 3 -> '$135' and 'Congratulations! You have free shipping!' (/cart.js 3 / 13500); minus returns to 2 then 1 with the matching text and totals.
  3. At quantity 1 click 'minus' once more.
    - expect: Record the actual behaviour (on 2026-10-14 the line was REMOVED and the drawer showed the empty state, O6) and that /cart.js item_count equals the drawer.
  4. Add the hoodie again on a fresh load and click 'remove'.
    - expect: /cart.js 0 / 0; drawer 'Your cart (0)', 'Your cart is empty', 'Continue Shopping' (href /pages/bundle-builder, O8), no 'CHECKOUT' link; reload shows the badge hidden.

#### 4.3. 4.3. /cart redirects to the homepage with the drawer open, and the cart persists

**File:** `tests/generated/koh-core-storefront/cart.spec.ts`

**Steps:**
  1. With an empty cart navigate to merchant.pages.cart (https://kreaturesofhabit.com/cart).
    - expect: The browser ends on https://kreaturesofhabit.com/?cart=open (homepage title) and the drawer #ns-hybrid-cart is visible with 'Your cart is empty' (there is no standalone cart page; assert the URL or the open drawer).
  2. Add the KOH Knit Beanie from /collections/all (quick add), then navigate to /cart and reload.
    - expect: The drawer opens automatically on /?cart=open with the beanie line and '$25'; after a reload the cart (badge 1, /cart.js 1 / 2500) persists. Clear the cart at the end.

#### 4.4. 4.4. Mixed cart and the hand-off to Shopify checkout (STOP at the checkout URL)

**File:** `tests/generated/koh-core-storefront/cart.spec.ts`

**Steps:**
  1. Clear the cart; quick-add the KOH Knit Beanie on /collections/all (one add), then load /products/oatmeal-hoodie?variant=40476193259685 (separate load) and add the preselected size L once.
    - expect: /cart.js: 2 items, total_price 7000, lines 'Oat Scripted Hoodie - L' (40476193259685, 4500) and 'KOH Knit Beanie' (40307356991653, 2500); drawer 'Your cart (2)', 'Only $49 left to get free shipping!', Subtotal '$70', newest line (hoodie) first; badge 2.
  2. Optional (if time allows): on /products/daily-bar add 2 boxes with the builder (see specs/koh-bundle-builder.md) in the same cart and re-read the drawer.
    - expect: Hoodie, beanie and builder lines coexist; subtotal equals the sum of line prices; record any layout or free-shipping text conflicts. Skip if the builder is flaky.
  3. Click the drawer link 'CHECKOUT' (noWaitAfter, then waitForURL up to 45 s). Do not touch any field.
    - expect: URL matches /\/checkouts\/cn\/[^/]+\/en-us/ on kreaturesofhabit.com with title 'Checkout - Kreatures of Habit'. The visible summary lists 'Oat Scripted Hoodie L 1 $45.00', 'KOH Knit Beanie 1 $25.00' and 'Subtotal · 2 items $70.00' (read-only). STOP: no email, address, discount code, wallet or 'Pay now' interaction.
  4. Navigate back with page.goBack() and clear the cart.
    - expect: Storefront loads again and /cart.js still has 2 items before the clear; after the clear item_count is 0.

### 5. 5. Content pages and forms (read-only)

**Seed:** `tests/seed.spec.ts`

#### 5.1. 5.1. Policy and company pages return 200 with correct titles and headings

**File:** `tests/generated/koh-core-storefront/content-pages.spec.ts`

**Steps:**
  1. Visit (or fetch with 1.2 s spacing) /policies/shipping-policy, /policies/refund-policy, /policies/privacy-policy and /policies/terms-of-service.
    - expect: Each returns 200; titles 'Shipping policy – Kreatures of Habit', 'Refund policy – ...', 'Privacy policy – ...', 'Terms of service – ...'; H1 equals the policy name; the body text is longer than 500 characters; no broken main images.
  2. Visit /pages/about-us.
    - expect: 200, title 'About Us - Kreatures of Habit | Health and Wellness', one visible H1 'About Us | Kreatures of Habit | Health and Wellness', H2 'ABOUT US' and 'MEET MICHAEL', at least 2 visible images with naturalWidth greater than 0 (log that they lack alt, O12), scrollWidth at most the viewport.
  3. Visit /pages/podcast.
    - expect: 200, title 'Our Podcast - Kreatures of Habit', main content renders (no H1: log O2).

#### 5.2. 5.2. FAQ accordion expands, collapses and is exclusive

**File:** `tests/generated/koh-core-storefront/content-pages.spec.ts`

**Steps:**
  1. Open /pages/faqs and count [data-faq-button] and [data-faq-group].
    - expect: Title 'FAQs - Your Questions Answered - Kreatures of Habit'; group labels MEAL ONE, KREATURE'S SLEEP, THE DAILY BAR, ORDERS, SHIPPING, SUBSCRIPTIONS are visible; at least 40 items (52 on 2026-10-14); every item starts with aria-expanded 'false'.
  2. Click 'What are net carbs?', then click 'Is this high in sugar?', then click 'Is this high in sugar?' again.
    - expect: First click: aria-expanded 'true' and the answer '(Carbs minus fiber)' becomes visible (panel height greater than 0); second question opens and the first closes (exclusive, exactly one 'true' at any time); the third click closes everything.
  3. Open 'How do I change my order?' and read the links in its answer.
    - expect: Link 'Send us a note' -> https://kreaturesofhabit.com/pages/contact. Log that the question rows are divs without role=button (O12) and the 'boxes of 7 pouches' / '8-pack' copy (O14).

#### 5.3. 5.3. Contact, wholesale and login pages load (forms are inspected, never submitted)

**File:** `tests/generated/koh-core-storefront/content-pages.spec.ts`

**Steps:**
  1. Open /pages/contact.
    - expect: 200, title 'Contact Us - Kreatures of Habit', H2 'CONTACT', textboxes 'Name', 'Email', 'Message', hCaptcha text with links Privacy Policy and Terms of Service (/policies/privacy-policy, /policies/terms-of-service) and button 'Submit Message' visible and enabled. Do NOT type or click the button.
  2. Open /pages/ws-account-create.
    - expect: 200, title 'Wholesale Registration Form – Kreatures of Habit', H1 'Wholesale Registration Form', 'Already have an account? Login here.', H2 'Customer Information' and fields First Name, Last Name, Email, Company; button 'Continue' exists. Do NOT fill or submit.
  3. Open merchant.pages.account (/a/account/login).
    - expect: 200, H1 'Welcome!', H2 'Access your account and manage your orders', textbox 'Email' with placeholder 'Your email', button 'Get login code (sends SMS and email)' and link 'Log in with Shopify instead' (href .../account/login?return_url=/a/account/shopify-login). Assert presence only: never type or click the code button.

#### 5.4. 5.4. Habit Lab blog lists articles with working links and paging

**File:** `tests/generated/koh-core-storefront/content-pages.spec.ts`

**Steps:**
  1. Open /blogs/habit-lab.
    - expect: 200, title 'Habit Lab – Kreatures of Habit', H1 'Habit Lab', H2 'THE KREATURES OF HABIT PODCAST', at least 6 article cards with a title, a date (for example 'SEPTEMBER 29, 2026') and a link to /blogs/habit-lab/<slug>, no broken images, pagination links ?page=2 and ?page=3.
  2. Click the first article card (noWaitAfter) and read the page.
    - expect: URL equals the card href, HTTP 200, a non-empty H1 and title ending with 'Kreatures of Habit'; Back returns to the list.
  3. Open /blogs/habit-lab?page=2 (separate load).
    - expect: 200, different first article from page 1, no duplicates of the page 1 slugs.

#### 5.5. 5.5. Sprouts store locator and unknown URLs

**File:** `tests/generated/koh-core-storefront/content-pages.spec.ts`

**Steps:**
  1. Open /pages/stores, wait 5 s and read the widget without typing or selecting anything.
    - expect: Title 'Kreatures of Habit | THE DAILY BAR | Now At Your Local Sprouts', H2 'Find Daily Bar at Your Local Sprouts', comboboxes 'Enter Address or Zip Code' and the distance list (5/10/25/50/100 miles), 'Powered by H1 Apps'.
    - expect: The locator should list stores or an empty-state hint; record O11: on 2026-10-14 it showed 'No locations found' plus the Google Maps error 'This page can't load Google Maps correctly'. The test fails (reports a defect) if the Google Maps error text is visible.
  2. Request /pages/this-page-does-not-exist-qa and /products/zzz-not-a-real-product (one load each).
    - expect: The page URL redirects to '/' with HTTP 301 then 200 (soft 404, O10) while the product URL responds HTTP 404 with title '404 Not Found – Kreatures of Habit', paragraph '404', H1 'Page not found' and link 'Continue shopping' -> /collections/all; /collections/zzz-not-real also returns 404.
  3. Click 'Continue shopping' on the product 404.
    - expect: URL /collections/all with product cards rendered.

### 6. 6. Mobile (390x844)

**Seed:** `tests/seed.spec.ts`

#### 6.1. 6.1. Mobile homepage has no overflow and the hamburger menu works

**File:** `tests/generated/koh-core-storefront/mobile.spec.ts`

**Steps:**
  1. Set the viewport to 390x844 and open the homepage.
    - expect: document.documentElement.scrollWidth is at most 390 (375 observed); the logo, hamburger (summary[aria-label='Menu'], about 40x40) and 'Cart' button (about 28x40) are inside the viewport; log their sizes under 44 px (O15).
  2. Tap the hamburger (summary.header__icon--menu).
    - expect: #menu-drawer opens full screen (390x844) with links OVERNIGHT OATS (/products/meal-one-v2), PROTEIN BAR (/products/daily-bar), BUNDLE & SAVE (/pages/bundle-builder), NOW AT SPROUTS (/pages/stores), My Account (/a/account/login), Log in, Facebook, Instagram, TikTok; the SLEEP link is not shown; the button 'Close' and Escape close it.
  3. Tap 'PROTEIN BAR' in the menu.
    - expect: Navigates to /products/daily-bar with the page scrollWidth at most 390. Never tap 'My Account' or 'Log in' in this test.

#### 6.2. 6.2. Mobile collection page layout

**File:** `tests/generated/koh-core-storefront/mobile.spec.ts`

**Steps:**
  1. At 390x844 open /collections/all and wait for the cards.
    - expect: Single column (all cards share the same x, about 345 px wide), no horizontal scroll (scrollWidth at most 390), quick-add controls about 321x47 and tappable, the 'Sort by:' combobox is reachable.
  2. Choose 'Price, low to high' with the sort combobox that is visible on mobile (check #SortBy vs #SortBy-mobile; the second sits off screen at x 592 until the Sort drawer opens).
    - expect: URL ?sort_by=price-ascending, the first card is a $0.00 item, no layout break.

#### 6.3. 6.3. Mobile hoodie PDP: pick a size, add to cart, drawer is usable

**File:** `tests/generated/koh-core-storefront/mobile.spec.ts`

**Steps:**
  1. At 390x844 clear the cart, open /products/black-hoodie, tap the Size label 'L' and read control sizes.
    - expect: scrollWidth at most 390; URL ?variant=40307357581477; Size labels about 36 px high (O15), quantity buttons about 45x47, 'Add to cart' about 345x60 and fully inside the viewport width.
  2. Tap 'Add to cart' once (scroll it into view first) and inspect the drawer.
    - expect: /cart.js 1 item 'Black Scripted Hoodie - L'; the drawer is a card inside the viewport (about 372x826 at x 9, y 9) with plus/minus (about 32x28), remove and 'Close cart' (about 32x32; log under 44 px) and the CHECKOUT link (about 348x52 at y 775) fully visible and not covered by other overlays; page scrollWidth at most 390.
  3. Tap 'plus' once, wait, then tap 'Close cart'.
    - expect: Quantity 2 and '$90' (or record the O7 empty-cart behaviour); the drawer closes and the page scrolls again. Clear the cart at the end (item_count 0). Do not tap CHECKOUT.

### 7. 7. Other products and selector audit

**Seed:** `tests/seed.spec.ts`

#### 7.1. 7.1. Simple products: beanie, sale snapback and Kontainer

**File:** `tests/generated/koh-core-storefront/simple-products.spec.ts`

**Steps:**
  1. Open /products/koh-new-york-colorway-snapback.
    - expect: Title 'KOH New York Colorway Snapback Hat - Kreatures of Habit', H1 'KOH New York Colorway Snapback', no Size radios, price block 'Regular price $45.00 USD Sale price $22.50 USD' with badge 'Sale' visible, hidden id 45562942750938, JSON-LD offers 22.5; button 'Add to cart' enabled.
  2. Add to cart once and read the drawer line.
    - expect: /cart.js 1 item price 2250 (variant 45562942750938); drawer line shows 'Sale price', '$22.50', 'Original price', '$45', '$22.50 off' and Subtotal '$22.50' with 'Only $96 left to get free shipping!' (119 minus 22.50, rounded as the UI shows). Clear the cart.
  3. Open /products/beanie and /products/kreature-kontainer-glass (one load each, no add).
    - expect: Beanie: title 'KOH Knit Beanie Hat - Kreatures of Habit', H1 'KOH Knit Beanie', '$25.00 USD', single variant 40307356991653, no Size group. Kontainer: H1 'Kreature Kontainer - Glass', '$9.95 USD', 'Add to cart' enabled.

#### 7.2. 7.2. Free ($0.00) products are visible and purchasable

**File:** `tests/generated/koh-core-storefront/simple-products.spec.ts`

**Steps:**
  1. Open /products/glass-cup and read the price and button (no add), then fetch /products/kreature-routine-box.js and /products/daily-bar-2-pack.js.
    - expect: Mug H1 'Kreatures Glass Mug', price '$0.00 USD', button 'Add to cart' enabled (O3); the Routine Box and Mailer JSON report price 0 and available true.
  2. Assert the merchant intent as a documented expectation.
    - expect: The test records (does not hide) that free products are listed on /collections/all with a working ADD TO CART; mark as a P2 finding for merchant review. It does not add the item to the cart.

#### 7.3. 7.3. Cart drawer selector audit against merchants/koh/locators.js

**File:** `tests/generated/koh-core-storefront/locator-audit.spec.ts`

**Steps:**
  1. After adding the snapback once, count each drawer locator through page.locator (cartDrawer, cartItem, cartItemTitle, cartQuantityInput, cartQtyPlus, cartQtyMinus, cartItemRemove, cartSubtotal, cartDrawerClose) and the host element ns-hybrid-cart.
    - expect: cartDrawer '#ns-hybrid-cart' count 1 and visible; the host element ns-hybrid-cart has an open shadowRoot and no id (document.querySelector('#ns-hybrid-cart') is null); cartQtyPlus/Minus/Remove, cartQuantityInput and cartSubtotal each count 1; cartItem counts 3 (product + gift group + mug teaser) while cartItemTitle returns 'KOH New York Colorway Snapback' and 'Kreatures Glass Mug'; the old cartDrawerClose (':has-text("Close cart")') counts 0 and the aria-label version counts 1. The test reports stale selectors rather than hiding them.
  2. On /collections/all and on the PDP count miniCartDrawer, addToCartBtn, productTitle, productPrice and hero.
    - expect: miniCartDrawer matches 1 hidden element and never the real drawer; addToCartBtn matches 7 quick-add buttons on the grid but 1 on a PDP; productTitle h1 matches 0 on the grid; productPrice matches 2 nodes on the sale PDP with $22.50 first; hero matches 0 outside the homepage. These results are logged as the stale-locator report in the plan.
