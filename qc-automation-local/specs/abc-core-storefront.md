# ABC Carpet & Home Core Storefront Test Plan

## Application Overview

Test plan for the core storefront of merchant abc (ABC Carpet & Home, https://abchome.com): homepage and navigation, search (Searchspring), the /collections/furniture collection page (Searchspring filters, sort, infinite scroll), product pages (/products/alessia-coffee-table and /products/delancey-2-piece-sectional), the cart drawer, the hand-off to the Shopify checkout URL and the mobile (390px) experience. Theme: Shopify "section groups" header (site-header.nav__wrapper), Searchspring grid (.main-product-card), custom cart drawer (#cartSlideout), Yotpo reviews. Project: abc-desktop-chromium (mobile scenarios use a 390x844 viewport, Pixel 7 class), seed: tests/seed.spec.ts (fixtures/base closes popups, paces Cloudflare 429s and handles storefront passwords). Merchant data comes from merchants/abc/config.js (pages, products, features); anything not there must be added to config.js / locators.js, never inlined in specs. Not planned here (out of scope for core storefront): accounts/login, wishlist, abcTrade program, newsletter, store locator content, reviews submission.

GLOBAL RULES FOR EVERY SCENARIO
- Start from a fresh browser context (empty cart). To reset the cart use fetch('/cart/clear.js', {method:'POST'}) and then reload the page (clearing does not refresh an open drawer). Each scenario is independent and must clear what it adds.
- NEVER place an order: stop at the Shopify checkout URL (https://abchome.com/checkouts/cn/<token>/en-us?_r=...). Do not fill or touch any checkout field. NEVER submit any form that creates data: footer newsletter ('Enter Email' + 'Submit'), contact, account sign-in / sign-up (the 'Login' link goes to https://account.abchome.com/authentication/login: only assert the URL, do not type), abcTrade, wishlist, and reviews. Do not click 'Be the first to write a review!' or the 'Write a review' link next to the price.
- Be gentle with the site (Cloudflare 429): one navigation per step, no reload loops, no more than one cart add per page load. Use the rateLimitGuard fixture; do not add ad-hoc waitForTimeout to dodge 429s (short waits for UI settle are fine). Collection and search pages are heavy (100+ console errors accumulate from 404 swatch images and analytics): do not fail tests on console errors, see O3.
- CLICK TRAP: on this theme a plain locator.click() frequently hangs ('performing click action' / 'waiting for scheduled navigations') even though the page reacted, for example on the PDP quantity '+', the Size dropdown, filter checkboxes, the chip remove button and the drawer's 'Check Out' button. Use click({noWaitAfter:true}) followed by an expect on the resulting state (URL, value, class), scroll the element into view first, and where that still hangs click at the element's boundingBox centre with page.mouse.click (boundingBox is viewport-relative: scroll first). After any cart change wait for the UI to settle: the drawer line quantity text updates about 1 second after the cart.js value (it reads the old number for roughly the first second), so use expect(...).toHaveText with auto-retry, never a single immediate read.
- Popups: features.popup is false and no marketing popup was seen, but the fixture closes any dialog with a 'Close popup' control anyway. An accessiBe widget ('Open accessiBe: accessibility options, statement and help', 'Use Website In a Screen-Reader Mode') and a 'Live chat' iframe (button 'Chat', bottom of the page) are always present: ignore them and make sure they never intercept a click.
- Hero and footer: the homepage has a hero slideshow whose last slide holds the site footer (footer.footer). There are two <footer> elements on every page (the first is the cart drawer's contentinfo), so always use footer.footer / the 'Visit Our Showrooms' link as the anchor.
- Prices: the storefront shows prices with cents on PDPs and in the drawer line ('$999.00', '$749.00') but without cents in the card grid, drawer totals and checkout button ('$749', '$1,498', 'from $749'). /cart.js and /products/<handle>.js use cents (74900). Compare numerically (strip $ , and .00), not as strings.
- Never assert on product counts that change daily (602 Items, 2816 Items, 1000 results, 143 Items): assert shape (integer, greater than 0, consistent with each other) unless a scenario says otherwise.
- Selectors: prefer getByRole / getByLabel / getByText as listed per scenario. Selectors that have no semantic equivalent are listed under 'Locators to add to merchants/abc/locators.js' below.

VERIFIED PAGE FACTS (live, 2026-10-14)
- Homepage / : title 'Rugs, Furniture & Home Decor Online: abc carpet & home', canonical https://abchome.com/, meta description starts 'Explore curated rugs, modern furniture, & unique home decor online.' The only H1 is the logo (h1.nav__logoWrapper, heading name 'abc carpet & home', no text, inline SVG, not a link on the homepage). On inner pages (PDP, search, collection) the logo is a link named 'Go to the homepage' with href /. Skip links: 'Skip to content' (#main-content) and 'Skip to Content' (#acsbContent). main has accessible name 'main-content'.
- Announcement bar (region 'Announcement Bar'): a 3-item rotating carousel (groups '1 / 3', '2 / 3', '3 / 3'; the visible order rotates): 'The Custom Upholstery Sale-' + link 'Up to 25% Off' -> /collections/the-custom-upholstery-sale; link 'Free Ground Shipping On Orders $250+*' -> https://abchome.com/pages/promotions; link 'Free White Glove On Orders $5K+*' -> https://abchome.com/pages/promotions.
- Header (desktop): buttons 'Open desktop menu' (button.nav__desktopBurger) and 'Open desktop search' (label text 'Search'), logo, link 'Wishlist' (/pages/wishlist, shows a counter '0'), link 'Login' (/account -> redirects to https://account.abchome.com/authentication/login, title 'Sign in - abc carpet & home', H1 'Sign in'), button 'Open cart' (badge .js-cart-count, '0' when empty). navigation 'Main Nagivation' (sic: typo in the accessible name) is empty/collapsed on desktop: the category nav lives in the hamburger mega menu. Mega menu ([desktop-mega-menu], has a 'Close menu' button and a backdrop that intercepts clicks while open) top-level entries: New Arrivals, Rugs & Carpet, Furniture, Lighting, Kitchen & Dining, Pillows & Throws, Bed & Bath, Décor & Gift, Jewelry, Sale. Its link hrefs include /collections/new-arrivals-1, /collections/rugs, /collections/furniture, /collections/lighting, /collections/kitchen-dining, /collections/pillows-throws, /collections/bed-bath, /collections/gifts-decor, /collections/shop-all-jewelry, /collections/on-sale-2, /collections/sofas-sectionals, /collections/coffee-side-tables-1 and the guides /pages/rug-guide, /pages/custom-rugs, /pages/broadloom, /pages/the-upholstery-guide. Furniture panel entries: 'All Furniture', 'In-Stock Furniture', 'Sofas & Sectionals', 'Accent & Lounge Chairs', 'Dining Tables & Chairs', 'Beds & Bedroom', 'Coffee & Side Tables', 'Ottomans & Poufs', 'Storage & Shelving', 'Outdoor Furniture', 'Vintage Furniture', 'Sale'. aria-expanded on 'Open desktop menu' stays 'false' even while the menu is open (O6).
- Hero slideshow (6 slides, links with accessible names '1 / 6' ... '6 / 6'): H2 'The Custom Upholstery Sale 25% Off*' -> /collections/the-custom-upholstery-sale ('Shop Now'); H2 'Warmth, Woven In' -> /collections/rugs ('Shop Rugs'); H2 'Savor the Season' -> /collections/kitchen-dining ('Shop Kitchen & Dining'); H2 'The Feeling of Fall' -> /collections/pillows-throws ('Shop Pillows & Throws'); H2 'Artisan Crafted, Cherished Forever' -> /collections/shop-all-jewelry ('Shop Jewelry'). 'Slide navigation' group links: 'Furniture' -> /collections/the-custom-upholstery-sale (NOT /collections/furniture), 'Rugs' -> /collections/rugs, 'Kitchen & Dining' -> /collections/kitchen-dining, 'Pillows & Throws' -> /collections/pillows-throws, 'Jewelry' -> /collections/shop-all-jewelry. 11 images on the homepage have an empty alt (O5).
- Footer (footer.footer): 'Visit Our Showrooms' -> /pages/abc-stores; social links (no text) facebook.com/abccarpetandhome, pinterest.com/abccarpetandhome/, instagram.com/abccarpetandhome/, tiktok.com/@abccarpetandhome; columns 'Our Story' (About Us -> /pages/about-us, abc Restaurants -> /pages/restaurants, Careers -> /pages/careers, Press -> /pages/press, Affiliates -> /pages/affiliates), 'Explore' (Locations -> /pages/abc-stores, Interior Design -> /pages/interior-design-services, abcTrade™ -> /pages/abctrade, Our Rug Guide -> /pages/our-rug-guide, abcStories -> /blogs/abc-stories, Current Promotions -> /pages/promotions, Events -> /pages/events, Catalogs -> issuu.com external), 'Customer Service' (Contact Us -> /pages/contact, Returns & Exchanges -> /policies/refund-policy, My Account -> /account/login, Gift Cards -> /products/abc-carpet-home-gift-card), 'Policies' (Privacy Policy -> /policies/privacy-policy, Terms & Conditions -> /policies/terms-of-service, Shipping Policy -> /policies/shipping-policy, Refund Policy -> /policies/refund-policy, Accessibility Statement -> /pages/accessibility-statement). Newsletter block 'Stay Connected' with textbox 'Enter Email' and button 'Submit' (DO NOT SUBMIT). Currency picker 'United States (USD $)' / 'Canada (CAD $)'. Text '© All Rights Reserved 2026'.
- Status checks (HTTP 200, one load each): /pages/abc-stores (title 'abc home Store Locations | Furniture & Rug Stores – abc carpet & home'), /pages/contact (title 'Contact – abc carpet & home'), /pages/wishlist (title 'Wishlist – abc carpet & home'), /collections/rugs (title 'Shop Rugs Online | Luxury & One-of-A-Kind Rugs | abc carpet & home', H1 'One-Of-A-Kind Rugs'). The store, contact and wishlist pages have no H1.
- 404: /pages/this-page-does-not-exist-qa and /products/zzz-not-a-real-product both return HTTP 404 with title '404 Not Found – abc carpet & home'. The page shows H2 '"Not all those who wander are lost" - J.R.R. Tolkien', text 'The road to magic is rarely linear. Still, we don't want to lead you astray. Click the button below to explore the world of abc carpet & home.', 'Shop By Category' and links Rugs -> /collections/rugs, Furniture -> /collections/furniture, Pillows + Throws -> /collections/pillows-throws, Decor & Gift -> /collections/gifts-decor, Bed + Bath -> /collections/bed-bath, Lighting -> /collections/lighting. The header and footer still render.
- Search UI: click 'Open desktop search' -> a combobox input (#search-input, class customSearch__input, type=search, name=q, placeholder 'What can we help you find?', aria-expanded stays 'false' even when suggestions are visible) inside form.customSearch__form (action /search). Typing 'sofa' (pressSequentially, 80 ms delay, wait about 2.5 s) shows a panel (.customSearch__content) with headings 'Popular Searches' (links like 'rugs' -> /search?q=rugs, 'pillows', 'sofa' -> /search?q=sofa, 'coffee table' -> /search?q=coffee%20table) and 'Product Suggestions' (links like 'Cove Slipped Sofa Cisco Home $6345.00' -> /products/cove-slipped-sofa, 'Essentiel Sofa Saba Italia $9640.00' -> /products/essential-86-6-sofa), then 'View all →' -> /search?q=sofa. Suggestion prices have cents and no thousands separator ('$6345.00'), unlike card prices ('$6,345').
- Search results /search?q=rug: the URL is rewritten to /search?q=rug&page=1; title 'Search results: 1000 results for "rug" – abc carpet & home'; H1 'Showing results for "rug"'; a 'Filter' button (.filter-toggle-btn) and sort control (.sort-by-dropdown, default 'Featured'); filter groups seen 'Product Type', 'Color'; a visible counter .items-count read '2816 Items' while the title says 1000 results (O1). Cards render a few seconds after load (0 cards at domcontentloaded, 24 after about 3 s). Card = .main-product-card (data-product-id, data-product-price in cents) with a wishlist button ('Add to Wishlist'), a.product-card__link (href /products/<handle>), img (alt = product name), .product-card__brand, .product-card__title, .product-card__price. First cards: 'Aura Alchemy Silk Rug - Varanasi from $3,900' -> /products/alchemy-silk-rug-6-x-9-vni17-a; 'Aura Alchemy Silk Rug - Jaipur from $3,900'; 'SALE ... Silver Transitional Indo Ikat Wool Art Silk Blend Rug $2,640 $4,400' (sale price first, struck price second); 'Cream Transitional Silk & Wool Rug | 11' x 15' $13,500'.
- Empty search /search?q=zzqxjk: title 'Search results: 0 results for "zzqxjk" – abc carpet & home'; message "No results could be found for 'zzqxjk'" followed by 'Trending Products' (cards such as 'abcdna Mohair Throw $279', 'abc carpet & home Gift Card $50', 'Premium Rug Pad $108'); 0 .main-product-card elements, no H1 (only an empty H2).
- Collection /collections/furniture: URL is rewritten to ?page=1; title 'Shop Luxury Furniture Online for Every Room | abc carpet & home'; H1 'Furniture', H2 'Furniture', 'Luxury Modern Furniture: Handcrafted Collections for Every Room', 'Manhattan and Brooklyn Furniture Showrooms', 'Related Searches'; breadcrumb 'Shop / Furniture'; counter '602 Items' (.items-count); 4 columns on desktop (cards about 375 px wide); sort control shows 'Featured'. Card texts: 'Best seller | Bond Street | Sunday's 4-Piece Sectional | from $10,255 | +13 Options' -> /products/sundays-sectional; 'Best seller | Saba Italia | New York Suite Sectional | from $13,415 | +10 Options' -> /products/new-york-suite-sectional; 'abc carpet & home | Alessia Glazed Coffee Table | from $749' -> /products/alessia-coffee-table; 'Best seller | Cobble Hill | Delancey Sofa | from $2,995 | +56 Options'. Every card in the first batch had an image (none broken) and a price. Clicking the first card (title 'Tanu Glazed C-Table', price '$229') opened /products/tanu-enamel-c-table whose H1 and title ('Tanu Glazed C-Table – abc carpet & home') match the card.
- Collection paging: infinite scroll, not a button. A div.load-more-wrapper--infinite-scroll and an invisible link 'Load More' (a.load-more-button, #infinite-scroll-load-more-...) exist; scrolling to the bottom appends the next batch and rewrites the URL to ?page=2 then ?page=3 with no duplicate data-product-id values (checked at 23 then 25 cards). The existing locator loadMoreBtn ('button:text-is("Show More")') matches the wrong element: 'Show More' on this page is the SEO description expander (button.textBlock__expand) (O2). 'View more' buttons (button.show-more-btn) expand long filter groups.
- Collection filters (Searchspring side panel, opened by .filter-toggle-btn; panel container .filters-container gets class 'active'): groups 'Brand', 'Price', 'Color', 'Product Type' (112 checkboxes in all, id like filter--mfield_new_my_fields_brand_name--CobbleHill-searchspring; each option label appears twice in the DOM). Choosing Brand 'Cobble Hill' changed the counter 602 -> '143 Items', the URL to ?page=1&filter.mfield_new_my_fields_brand_name=Cobble+Hill, showed a chip span.active-filter-tag 'Cobble Hill ×' (its remove control is button.remove-filter) and every visible card's .product-card__brand read 'Cobble Hill' (12 cards). Removing the chip restored '602 Items' and the plain ?page=1 URL. 'Reset all' links exist (2 matches).
- Collection sort: .sort-by-dropdown (a custom <ul>); options 'Featured', 'New', 'Price: Low to High', 'Price: High to Low', 'Best Selling', 'Percent: High to Low'. Choosing 'Price: Low to High' sets ?page=1&sort.ss_price=asc and the first prices read $229, from $229, from $231, $240, $249, $275, $279, $283.80, $283.80, $292.60, from $309, $349 (non-decreasing; the numeric part of 'from $x' is the lowest variant price). The High to Low option was not exercised live.
- PDP /products/alessia-coffee-table (simple product, 6 variants, all available): title 'Alessia Glazed Coffee Table – abc carpet & home'; H1 (h1.product-metas__title) 'Alessia Glazed Coffee Table'; vendor/brand line 'abc carpet & home'; breadcrumb nav 'breadcrumbs': 'Shop' (/) / 'Coffee & Side Tables' (/collections/coffee-side-tables-1) / 'Alessia Glazed Coffee Table'. Default variant Short / Deep Umber Brown (variant 49554137055370, sku 3112537) shows '$999.00' while /products/alessia-coffee-table.js reports price 74900 (the lowest variant, shown as 'from $749' on cards) and variant prices 99900 (Short) / 74900 (Tall). The URL gets no ?variant at load; it becomes ?variant=<id> after an option change. Option groups: 'Size' (custom dropdown: button.selectOption__select showing 'Short', aria-expanded toggles to 'true', options label.selectOption__option 'Short' / 'Tall'; the radios are visually hidden) and 'Color' swatches (label.swatch-input__label with values 'Deep Umber Brown', 'Latte Taupe', 'Obsidian Green'; the selected name is shown in [variant-selected-option]). Choosing Tall -> '$749.00', URL ?variant=49554137186442, hidden select[name=id] 'Tall / Deep Umber Brown'; then Latte Taupe -> '$749.00', ?variant=49554137153674, 'Tall / Latte Taupe' (sku 3112540). Info lines 'Arrives in 1-3 Weeks', 'White Glove', 'On Display at Brooklyn Store' (button). Quantity: input.product-form__quantityInput (aria-label 'Product quantity', min 1, value 1), buttons 'Decrease quantity' (disabled at 1) and 'Increase quantity' (the page also has drawer buttons with the same names: scope to the main region). Increase worked via a mouse click at the button centre (value 2); locator.click timed out (see CLICK TRAP). Main button: button.product-form__cart-submit 'Add to cart' (a second hidden .atc-button 'Add to cart' exists). A sticky bar #stickyAtc (class 'sticky-atc-unique-container visible' on desktop, 'hidden' with zero size on first paint on mobile) repeats the title and price. Tabs (role=tab inside a tablist): 'Description & Details' (selected by default), 'Shipping & Returns', 'MEASURING GUIDE' (opens a modal 'abc Furniture Measuring Guide' / 'WILL IT FIT?'), plus link 'Print Tear Sheet' and button 'Share'. Selecting 'Shipping & Returns' flips aria-selected on the tabs (no role=tabpanel element was found, so assert on the tabs' aria-selected and on visible panel text, not on a tabpanel role). Gallery: buttons 'Next slide' and 'Previous slide' (disabled at first slide) and a thumbnail strip (.product-gallery__thumbs .swiper-slide, 7 thumbs on this product); a live click on 'Next slide' did not visibly change the active slide in my probe (the button found first may belong to the thumbnail strip), so scenario 4.3 must identify the right control. Sections below: 'Customer Reviews' (Yotpo; for this product: 'We're looking for stars!' / 'Let us know what you think' / button 'Be the first to write a review!' = zero reviews, DO NOT CLICK), 'Frequently Purchased Together' (shows 'Loading products...' at first), 'Pairs Well With' lamp cards ('Beton Table Lamp $519.20' etc.), 'abcTrade™' banner (link 'Explore More' -> /pages/abctrade) and 'Recently Viewed'. No Shop Pay / Afterpay installment text was seen.
- PDP /products/delancey-2-piece-sectional (configurable, 116 variants, 233 images, vendor/brand 'Cobble Hill'): page is slow to hydrate (the H1 took longer than 20 s to become attached in one run; wait for h1.product-metas__title with a generous timeout). The URL becomes ?variant=42642387304586 right after load. Preselected variant 'Right Facing / Vickie, Performance Velvet / Charcoal' shows '$6,495.00' (/products/delancey-2-piece-sectional.js: that variant price 649500; product.price 629500 = lowest, price_max 749500). Option groups: 'Orientation' (Right Facing / Left Facing) and 'Fabric' with a 'Filter' control, stock filter chips 'In Stock', 'Made To Order', 'Sale', 'Lead time: 1-3 Weeks', swatch families 'Vickie, Performance Velvet', 'Charcoal'; actions 'Order a Sample Swatch', '+ Add', 'White Glove', 'Add to cart'. Tabs 'Description & Details', 'Shipping & Returns', 'MEASURING GUIDE'. JSON-LD blocks: BreadcrumbList, Product, ProductGroup. 2 gallery thumbs, 29 Yotpo elements, and again zero reviews ('Be the first to write a review!'). On the collection page and PDPs the console logs dozens of HTTP 404 responses for swatch images such as /cdn/shop/files/left-facing-lario-velvet-ochre_64x64.png (O3).
- Cart (verified with Alessia Tall / Latte Taupe and Short / Deep Umber Brown): clicking 'Add to cart' once opens the drawer (#cartSlideout gets class slideout--opened, role=dialog, accessible name 'Cart' / 'Cart (1)'). /cart.js after the add: item_count 1, total_price 74900, items[0].title 'Alessia Glazed Coffee Table - Tall / Latte Taupe', variant_id 49554137153674, quantity 1, price 74900, sku 3112540, url '/products/alessia-coffee-table?variant=49554137153674'. Drawer text: 'Cart | (1) | You're $4,251 away from free delivery | $5,000 | Alessia Glazed Coffee Table | $749.00 | Size: Tall | Color: Latte Taupe | 1 | Remove | In Stock - arrives in 1-3 weeks. | TOTAL | $749 | + est. tax | CHECK OUT 1 ITEM · $749 | OR EXPRESS CHECKOUT | Free returns within 30 days · Terms accepted at checkout'. Header badge .js-cart-count '1'. Line controls: 'Decrease quantity' / 'Increase quantity' (.slideoutItemListing__quantityButton--remove / --add), quantity text .slideoutItemListing__quantityValue, line price .slideoutItemListing__value, a 'Remove' button (.slideoutItemListing__actionLink--remove), title link (.slideoutItemListing__name a, href with ?variant=), a thumbnail link, close button 'Close' (.sideCart__closeButton). Increase -> quantity 2, TOTAL '$1,498', line '$1,498.00', /cart.js 2 / 149800, header badge 2, drawer title '(2)'; Decrease -> back to 1, '$749', 74900. Remove -> /cart.js 0 / 0, drawer 'Cart | (0) | 0 | Your cart is empty | Continue shopping' (link -> /collections/all) | TOTAL $0 | 'CHECK OUT 0 ITEMS · $0' and the Check Out button is STILL visible and enabled in the empty state (O7). Not verified live: the decrease button at quantity 1, a two-line cart, and the Continue shopping destination.
- /cart is not a page on this store: navigating to https://abchome.com/cart lands on https://abchome.com/#open-sidecart (the homepage with the drawer opened, title 'Rugs, Furniture & Home Decor Online: abc carpet & home'). The merchant config pages.cart '/cart' therefore means 'homepage + open drawer'. The empty drawer on any page shows 'Your cart is empty' and 'Continue shopping' -> /collections/all.
- Checkout hand-off: the drawer's 'Check Out' control is button.sideCart__mobileCheckoutButton (type=submit, name=checkout, inside a form POST to https://abchome.com/cart), not a link. Clicking it (mouse click at its centre) with a 2-unit cart (Alessia Tall / Latte Taupe x 2) landed on https://abchome.com/checkouts/cn/<token>/en-us?_r=... with title 'Checkout - abc carpet & home' (the navigation took a long time in one run: allow 45 s). Nothing was filled or submitted. 'OR EXPRESS CHECKOUT' wallet buttons are aria-hidden/lazy: do not click them. The checkout page content (summary) was not inspected.
- Mobile (390x844): homepage scrollWidth 390 (no horizontal overflow); the Alessia PDP scrollWidth 375 (<= 390). Header controls: 'Open mobile menu' 40x40, 'Wishlist' 40x40, 'Search' 30x30, 'Login' 40x40, 'Open cart' 40x40 (all below the 44 px target size, O8). Mobile menu (.drawerMenu, 390x756 at y=88 below the header): accordion buttons New Arrivals, Rugs & Carpet, Furniture, Lighting, Kitchen & Dining, Pillows & Throws, Bed & Bath, Décor & Gift, Jewelry, Sale, then plain links STORES -> /pages/abc-stores, RESTAURANTS -> /pages/restaurants, INTERIOR DESIGN -> /pages/interior-design-services, ABOUT US -> /pages/about-us, ABCTRADE -> /pages/abctrade, 'Sign In' -> /account. Mobile PDP: main 'Add to cart' button 191x48 (x 164, in the buy box), price '$999.00' for the default variant; after one add /cart.js = 1 item, 99900, 'Alessia Glazed Coffee Table - Short / Deep Umber Brown'; the drawer covers the full viewport (390x844) and its 'Check Out' button is 358x40 at y about 692 (inside the viewport, 40 px high), scrollWidth 390. The mobile collection page, mobile search and accordion expansion were not explored live.

OBSERVATIONS (possible defects found while exploring - scenarios below are designed to detect them, not to assume them)
- O1. Result counts disagree on the search page: the title says 'Search results: 1000 results for "rug"' (likely a Searchspring cap of 1000) while the visible .items-count reads '2816 Items'. Scenario 2.2 compares them.
- O2. merchants/abc/locators.js loadMoreBtn ('button:text-is("Show More")') does not match a product load-more control. On /collections/furniture the only 'Show More' button is the SEO text expander (button.textBlock__expand), and products load by infinite scroll with ?page=N. A test that clicks 'Show More' expands the description, not the grid; the generator must scroll instead (scenario 3.4).
- O3. Dozens to 100+ console errors per collection/PDP load: Shopify's Google Analytics stub message and repeated HTTP 404 on swatch thumbnails (e.g. /cdn/shop/files/left-facing-lario-velvet-ochre_64x64.png, /cdn/shop/files/banks-performance-velvet-denim_64x64.png) plus 404s on malformed URLs (/collections/none, /cdn/shop/files/left-facing-102.5). These are missing fabric swatch images (possibly visible as broken swatches) and noise for console-error assertions. Scenario 4.2 checks visible swatches.
- O4. Free-shipping messaging is inconsistent: the announcement bar says 'Free Ground Shipping On Orders $250+*' and 'Free White Glove On Orders $5K+*', but the drawer for a $749 cart says "You're $4,251 away from free delivery" with a $5,000 goal, as if only the White Glove threshold counted. Scenario 5.1 records it (P3 content question for the merchant).
- O5. Accessibility/semantics: the homepage H1 is an empty SVG logo wrapper (accessible name only), the 'Main Nagivation' landmark name is misspelled and empty on desktop, 11 homepage images have no alt, aria-expanded stays 'false' on 'Open desktop menu' and on the search combobox while open, the PDP tabs have no tabpanel element, the 404-adjacent pages (store, contact, wishlist) have no H1, and the hero 'Furniture' link goes to the upholstery sale, not /collections/furniture.
- O6. 'Open desktop menu' keeps aria-expanded='false' while the mega menu is open; while open, its backdrop and left panel intercept pointer events, so tests must close it (Escape or 'Close menu') before clicking anything else.
- O7. The empty drawer still shows a visible, enabled 'CHECK OUT 0 ITEMS · $0' button. Scenario 5.3 records its state (do not click it with an empty cart; its result was not verified).
- O8. Small tap targets on mobile: header 'Search' is 30x30, other header icons 40x40, drawer 'Check Out' 358x40, all under 44 px. P3.
- O9. Price display differs by surface: cards 'from $749' vs PDP default '$999.00' (the default variant is not the cheapest), and suggestions '$6345.00' vs cards '$6,345'. Scenario 4.1 asserts the PDP price equals the selected variant price from /products/<handle>.js (not product.price).
- O10. /cart is not a real page (redirect to /#open-sidecart; merchants/abc/config.js pages.cart is '/cart'). Any 'cart page' test must use the drawer; /cart.js is the only server-side cart view.
- O11. Slow/lazy pages: the Delancey PDP took over 20 s before h1.product-metas__title attached in one run, search/collection cards appear 2-4 s after domcontentloaded, and the checkout redirect was slow. Timing risks for tests (use generous auto-retrying expects) and possible performance findings.
- O12. After a drawer quantity change the line quantity text lags /cart.js by about 1 s (it showed the old number while the total and cart.js had already changed): tests must wait for it.

Locators to add to merchants/abc/locators.js (verified 2026-10-14; do not inline these in specs)
- desktopMenuButton: 'button.nav__desktopBurger'; megaMenu: '[desktop-mega-menu]'; megaMenuClose: 'button[aria-label="Close menu"]'
- searchInput: '#search-input'; searchSuggestionLinks: '.customSearch__content a' (the existing predictiveSearchResults only matches product suggestions); popularSearchLinks: '.customSearch__content a[href^="/search?q="]'
- itemsCount: '.items-count'; productCardTitle: '.product-card__title'; productCardPrice: '.product-card__price'; productCardBrand: '.product-card__brand'; productCardLink: 'a.product-card__link'
- infiniteScrollSentinel: '[id^="infinite-scroll-load-more"]' (replaces loadMoreBtn for abc; the existing loadMoreBtn targets the SEO expander); descriptionExpander: 'button.textBlock__expand'
- filterPanel: '.filters-container'; activeFilterRemove: 'button.remove-filter'; sortSelected: '.sort-by-dropdown .dropdown-selected'; sortOption: '.sort-by-dropdown li'
- pdpSizeDropdown: 'button.selectOption__select'; pdpSizeOption: 'label.selectOption__option'; pdpSwatch: 'label.swatch-input__label'; pdpSelectedOptionValue: '[variant-selected-option]'; pdpVariantSelect: 'select[name="id"]'
- cartCheckoutBtn: '.sideCart__mobileCheckoutButton'
- addToCartBtn: the existing selector list also matches the hidden .atc-button, so use 'button.product-form__cart-submit' (LocatorManager.preferred) for the visible main button.

## Test Scenarios

### 1. 1. Homepage and navigation

**Seed:** `tests/seed.spec.ts`

#### 1.1. 1.1. Homepage loads with header, logo, search, cart icon and hero

**File:** `tests/generated/abc-core-storefront/homepage-navigation.spec.ts`

**Steps:**
  1. Open the homepage (merchant.pages.homepage) on a fresh context and wait for the hero slideshow.
    - expect: HTTP 200, title 'Rugs, Furniture & Home Decor Online: abc carpet & home', canonical https://abchome.com/, meta description non-empty.
    - expect: Exactly one H1 (class nav__logoWrapper, accessible name 'abc carpet & home'); log that it has no visible text (O5).
    - expect: Header shows buttons 'Open desktop menu', 'Open desktop search', 'Open cart', links 'Wishlist' (/pages/wishlist) and 'Login' (/account); the cart badge .js-cart-count reads 0.
    - expect: Hero has slides with H2 'The Custom Upholstery Sale 25% Off*', 'Warmth, Woven In', 'Savor the Season', 'The Feeling of Fall', 'Artisan Crafted, Cherished Forever' and no loaded hero image with naturalWidth 0.
  2. Click 'Open cart' (noWaitAfter), read the drawer, then close it with 'Close'.
    - expect: #cartSlideout gets slideout--opened and shows 'Your cart is empty' and link 'Continue shopping' (href /collections/all); after Close the opened class is removed.
  3. On an inner page (merchant.pages.collection) click the logo link 'Go to the homepage'.
    - expect: URL path is '/' (a trailing hash or query is fine) and the hero is visible again. Never touch the footer 'Enter Email' / 'Submit'.

#### 1.2. 1.2. Announcement bar rotates and its links reach real pages

**File:** `tests/generated/abc-core-storefront/homepage-navigation.spec.ts`

**Steps:**
  1. Read the region 'Announcement Bar' on the homepage.
    - expect: Three items ('1 / 3', '2 / 3', '3 / 3') are present: 'The Custom Upholstery Sale-' with link 'Up to 25% Off' (/collections/the-custom-upholstery-sale), 'Free Ground Shipping On Orders $250+*' and 'Free White Glove On Orders $5K+*' (both https://abchome.com/pages/promotions). Only one is visible at a time; do not assert which.
  2. Open each distinct href once (one goto at a time), including /pages/promotions.
    - expect: Each returns HTTP 200, none has a '404 Not Found' title, and /pages/promotions has a non-empty title.

#### 1.3. 1.3. Mega menu and hero category links reach real collection pages

**File:** `tests/generated/abc-core-storefront/homepage-navigation.spec.ts`

**Steps:**
  1. Click 'Open desktop menu' (noWaitAfter) and wait for [desktop-mega-menu] aria-hidden to become 'false'.
    - expect: Menu lists New Arrivals, Rugs & Carpet, Furniture, Lighting, Kitchen & Dining, Pillows & Throws, Bed & Bath, Décor & Gift, Jewelry, Sale; the Furniture panel contains 'Sofas & Sectionals', 'Coffee & Side Tables' and 'All Furniture'. Record that aria-expanded on the button stays 'false' (O6).
  2. Click 'Sofas & Sectionals' (href /collections/sofas-sectionals).
    - expect: URL /collections/sofas-sectionals, HTTP 200, an H1 and at least one .main-product-card within 20 s, no '404 Not Found' title.
  3. Return to the homepage and, with the hero 'Slide navigation' links, click 'Rugs', then (separate load) 'Kitchen & Dining'.
    - expect: Rugs -> /collections/rugs (H1 'One-Of-A-Kind Rugs', title 'Shop Rugs Online | Luxury & One-of-A-Kind Rugs | abc carpet & home'); Kitchen & Dining -> /collections/kitchen-dining. Also assert the hero link 'Furniture' targets /collections/the-custom-upholstery-sale and log that it does not go to /collections/furniture (O5).

#### 1.4. 1.4. Footer links, Login link and custom 404 pages

**File:** `tests/generated/abc-core-storefront/homepage-navigation.spec.ts`

**Steps:**
  1. Scroll to footer.footer on the homepage and read its links without submitting anything.
    - expect: Link 'Visit Our Showrooms' (/pages/abc-stores), the four social links (facebook, pinterest, instagram, tiktok under /abccarpetandhome), and About Us, Careers, Press, Locations, Contact Us, Returns & Exchanges, Gift Cards, Privacy Policy, Terms & Conditions, Shipping Policy, Refund Policy, Accessibility Statement with the hrefs in the page facts; button 'United States (USD $)' and '© All Rights Reserved 2026' visible; the 'Enter Email' field is present but untouched.
  2. Visit /pages/abc-stores, /pages/contact, /policies/shipping-policy and /pages/press one at a time without filling any form.
    - expect: Each returns 200 with a non-empty title and no '404 Not Found' title (stores title 'abc home Store Locations | Furniture & Rug Stores – abc carpet & home', contact title 'Contact – abc carpet & home').
  3. Click the header link 'Login', assert only the URL, then go back.
    - expect: URL starts with https://account.abchome.com/authentication/login and the H1 is 'Sign in'. Type and submit nothing.
  4. Open /pages/this-page-does-not-exist-qa and /products/zzz-not-a-real-product (one load each).
    - expect: Both respond HTTP 404 with title '404 Not Found – abc carpet & home'; the first shows H2 '"Not all those who wander are lost" - J.R.R. Tolkien', 'Shop By Category' and links Rugs, Furniture, Pillows + Throws, Decor & Gift, Bed + Bath, Lighting; header and footer.footer still render; the Furniture link goes to /collections/furniture.

### 2. 2. Search

**Seed:** `tests/seed.spec.ts`

#### 2.1. 2.1. Header search opens and shows predictive suggestions

**File:** `tests/generated/abc-core-storefront/search.spec.ts`

**Steps:**
  1. On the homepage click 'Open desktop search'.
    - expect: A form with action /search and a combobox (#search-input) with placeholder 'What can we help you find?' is visible.
  2. Type 'sofa' with pressSequentially (about 80 ms per key) and wait for suggestions with an auto-retrying expect (up to 8 s).
    - expect: Headings 'Popular Searches' and 'Product Suggestions' appear; the popular list has links to /search?q=... (for example 'sofa'); at least 3 product suggestion links to /products/<handle> show a brand and a price like $6345.00; a 'View all →' link to /search?q=sofa is visible. Record that aria-expanded on the combobox stays 'false' (O5).
  3. Click the first product suggestion.
    - expect: URL path starts with /products/, HTTP 200, the H1 is non-empty, the document title ends with ' – abc carpet & home'. Do not add to cart here.

#### 2.2. 2.2. Search results page for 'rug' (merchant.pages.search)

**File:** `tests/generated/abc-core-storefront/search.spec.ts`

**Steps:**
  1. Open merchant.pages.search (/search?q=rug) and wait for .main-product-card to attach (cards appear 2-4 s after load; the URL is rewritten with &page=1).
    - expect: Title starts 'Search results:' and contains 'for "rug"'; H1 'Showing results for "rug"'; a 'Filter' button and the sort control 'Featured' are visible; at least 12 cards render.
  2. For the first 12 cards read image, title, brand and price.
    - expect: Each card has an img with a non-empty alt that loads (naturalWidth greater than 0 once scrolled into view), a non-empty .product-card__title, a price matching /\$[\d,]+(\.\d\d)?/ (optionally prefixed 'from') and a link starting /products/. At least one card title contains 'rug' (case-insensitive).
  3. Compare the number in the title (1000) with the visible .items-count (2816) using the numeric parts.
    - expect: Both are integers greater than 0. O1: they currently disagree; the test logs both, fails if the counter is 0 or the cards are empty while a count is greater than 0, and records the mismatch as a P3 finding (do not turn the check into a no-op).
  4. Click the first card.
    - expect: URL equals the card's href and the PDP H1 equals the card's title text.

#### 2.3. 2.3. Empty search shows a no-results message and trending products

**File:** `tests/generated/abc-core-storefront/search.spec.ts`

**Steps:**
  1. Open /search?q=zzqxjk (nonsense term from a constant, one load).
    - expect: Title 'Search results: 0 results for "zzqxjk" – abc carpet & home'; text "No results could be found for 'zzqxjk'" is visible; a 'Trending Products' section follows with at least 4 cards that have prices (for example 'Mohair Throw $279'); no HTTP 5xx or error page.
  2. Use the header search to type 'rug' and press Enter.
    - expect: The browser navigates to /search?q=rug (possibly with &page=1), H1 'Showing results for "rug"' and cards appear, confirming the form submit path.

### 3. 3. Collection page

**Seed:** `tests/seed.spec.ts`

#### 3.1. 3.1. Furniture collection grid renders complete product cards

**File:** `tests/generated/abc-core-storefront/collection.spec.ts`

**Steps:**
  1. Open merchant.pages.collection (/collections/furniture) and wait for .main-product-card and the counter (URL is rewritten to ?page=1).
    - expect: Title 'Shop Luxury Furniture Online for Every Room | abc carpet & home'; H1 'Furniture'; breadcrumb 'Shop / Furniture'; H2 'Luxury Modern Furniture: Handcrafted Collections for Every Room' further down; .items-count matches /^[\d,]+ Items$/ and is greater than 24 (602 on 2026-10-14).
    - expect: At least 8 cards are present; each of the first 12 has an image, brand, title, a price matching /\$[\d,]+(\.\d\d)?/, an 'Add to Wishlist' button and a link to /products/<handle>. Cards may carry 'Best seller', 'SALE' and '+N Options'.
  2. Check data consistency for the visible cards.
    - expect: data-product-id values are unique; no card has an empty title or '$0'; sale cards show the lower price first and the struck price second.

#### 3.2. 3.2. Sort by price orders the grid

**File:** `tests/generated/abc-core-storefront/collection.spec.ts`

**Steps:**
  1. Open the sort control (click .sort-by-dropdown .dropdown-selected with noWaitAfter) and read the options.
    - expect: Options 'Featured', 'New', 'Price: Low to High', 'Price: High to Low', 'Best Selling', 'Percent: High to Low' are listed.
  2. Choose 'Price: Low to High' and wait for the URL to contain sort.ss_price=asc and the first card to change.
    - expect: Selected label reads 'Price: Low to High'; numeric parts of the first 12 card prices are non-decreasing ('from' cards use the lowest price); the counter is unchanged.
  3. Choose 'Price: High to Low' (not yet exercised live).
    - expect: URL has a sort.ss_price parameter different from asc (expected desc: record the actual value); the first 12 prices are non-increasing and the first price is at least the last price seen under Low to High.

#### 3.3. 3.3. Brand filter narrows the grid and can be removed

**File:** `tests/generated/abc-core-storefront/collection.spec.ts`

**Steps:**
  1. Click the 'Filter' button (.filter-toggle-btn) on a fresh collection load and read the groups.
    - expect: The panel (.filters-container) gets class 'active'; groups 'Brand', 'Price', 'Color', 'Product Type' are visible and Brand includes 'Cobble Hill', 'Bond Street', 'Saba Italia'.
  2. Tick Brand 'Cobble Hill' (click its label with noWaitAfter) and wait for the counter to change.
    - expect: URL contains filter.mfield_new_my_fields_brand_name=Cobble+Hill; a chip 'Cobble Hill ×' (.active-filter-tag) appears; .items-count drops below the unfiltered number (143 on 2026-10-14); every card brand (.product-card__brand) reads 'Cobble Hill'.
  3. Remove the filter with the chip's × (button.remove-filter) or the 'Reset all' link.
    - expect: The chip disappears, the URL returns to /collections/furniture?page=1 without filter params, the counter returns to the original number and the card brands are mixed again.
  4. Apply a Color or Price option on its own (first option of the group).
    - expect: The counter changes from the unfiltered number, the URL contains a filter. parameter and no card contradicts the facet; if 0 cards are returned a no-results message is shown instead of a blank grid.

#### 3.4. 3.4. Infinite scroll appends the next page without duplicates

**File:** `tests/generated/abc-core-storefront/collection.spec.ts`

**Steps:**
  1. On a fresh collection load note the card count, then scroll to the bottom in steps (one page.mouse.wheel per step, wait for the card count to grow).
    - expect: More cards are appended (11-24 at first paint, 23 then 25 after scrolls were seen), the URL moves to ?page=2 then ?page=3 and no data-product-id appears twice.
  2. Click the SEO text expander button 'Show More' (button.textBlock__expand).
    - expect: Only the collection description expands; the product card count does not change (O2). The generator must use scrolling, not loadMoreBtn, for this collection.

#### 3.5. 3.5. Clicking a product card opens its product page

**File:** `tests/generated/abc-core-storefront/collection.spec.ts`

**Steps:**
  1. Read title, brand and price of the card linking to /products/alessia-coffee-table (merchant.products.secondary); if it is not in the first batch use the first card.
    - expect: The Alessia card price reads 'from $749' (lowest variant).
  2. Click the card's a.product-card__link (noWaitAfter) and wait for the URL.
    - expect: URL path equals the card's href; the PDP H1 (h1.product-metas__title) equals the card's title; the breadcrumb 'Shop / <category> / <title>' is shown; the document title is '<title> – abc carpet & home'. Browser Back returns to the collection with cards rendered.

### 4. 4. Product page

**Seed:** `tests/seed.spec.ts`

#### 4.1. 4.1. Product title, vendor and price match the product JSON

**File:** `tests/generated/abc-core-storefront/pdp.spec.ts`

**Steps:**
  1. Open merchant.products.secondary.path (/products/alessia-coffee-table) and in the same context fetch /products/alessia-coffee-table.js.
    - expect: H1 'Alessia Glazed Coffee Table' equals the JSON title; brand line 'abc carpet & home'; document title 'Alessia Glazed Coffee Table – abc carpet & home'; breadcrumb 'Shop' / 'Coffee & Side Tables' / the title.
    - expect: Displayed price '$999.00' equals the selected variant's price (99900/100 for Short / Deep Umber Brown), NOT product.price 74900 (O9): assert displayed price equals the price of the variant selected in select[name=id].
  2. Open merchant.products.default.path (/products/delancey-2-piece-sectional) with a generous wait for the H1 (O11).
    - expect: H1 'Delancey 2-Piece Sectional'; URL gains ?variant=<id>; displayed price '$6,495.00' equals that variant's price in /products/delancey-2-piece-sectional.js (649500 for variant 42642387304586 on 2026-10-14) and lies between the lowest (6295) and highest (7495) variant prices.

#### 4.2. 4.2. Size dropdown and Color swatches update variant, price and URL

**File:** `tests/generated/abc-core-storefront/pdp.spec.ts`

**Steps:**
  1. On /products/alessia-coffee-table click the Size dropdown button (button.selectOption__select, noWaitAfter) and read its options.
    - expect: aria-expanded becomes 'true'; options 'Short' and 'Tall' (label.selectOption__option) are listed with 'Short' selected.
  2. Choose 'Tall'.
    - expect: Button text 'Tall'; price '$749.00'; URL contains ?variant=49554137186442; select[name=id] reads 'Tall / Deep Umber Brown'.
  3. Click the swatch label 'Latte Taupe' (label.swatch-input__label).
    - expect: [variant-selected-option] reads 'Latte Taupe'; URL ?variant=49554137153674; select[name=id] 'Tall / Latte Taupe'; price stays '$749.00'; the H1 is unchanged.
  4. On /products/delancey-2-piece-sectional (separate load) count visible Fabric swatch images with naturalWidth 0.
    - expect: O3: many swatch thumbnails return 404 on this store. The test fails if any visible swatch image is broken and reports the count and the first 5 file names; if all are fine, record that.

#### 4.3. 4.3. Quantity stepper, gallery and tabs

**File:** `tests/generated/abc-core-storefront/pdp.spec.ts`

**Steps:**
  1. In the main region read input.product-form__quantityInput (aria-label 'Product quantity') and the buttons 'Decrease quantity' / 'Increase quantity' (scope to getByRole('main'); the drawer has same-named buttons).
    - expect: Value is 1 and 'Decrease quantity' is disabled.
  2. Scroll the main 'Increase quantity' into view and click it once (noWaitAfter or the bounding-box mouse click), then 'Decrease quantity' once.
    - expect: Value goes 1 -> 2 -> 1 and decrease is disabled again at 1; /cart.js item_count stays 0.
  3. Use the main gallery's next/previous controls and a thumbnail from .product-gallery__thumbs .swiper-slide (identify which 'Next slide' button belongs to the main gallery).
    - expect: 'Previous slide' is disabled on the first slide; the active main image changes after Next; thumbnails exist (7 on this product); visible gallery images load (naturalWidth greater than 0).
  4. Click the tabs 'Shipping & Returns' then 'Description & Details' (role tab). Do not click 'MEASURING GUIDE'.
    - expect: aria-selected flips (one tab 'true' at a time) and the visible panel text changes; there is no tabpanel role (O5) so assert on visible text. 'Print Tear Sheet' has an href containing ?variant=...&view=print.

#### 4.4. 4.4. Add to cart adds exactly the selected variant (verified with /cart.js)

**File:** `tests/generated/abc-core-storefront/pdp.spec.ts`

**Steps:**
  1. On /products/alessia-coffee-table choose Size 'Tall' and colour 'Latte Taupe' after clearing the cart and reloading once.
    - expect: Cart badge 0 and /cart.js item_count 0 before the add.
  2. Click button 'Add to cart' (button.product-form__cart-submit, not the hidden .atc-button) once.
    - expect: The drawer opens (#cartSlideout.slideout--opened); /cart.js has exactly one line: title 'Alessia Glazed Coffee Table - Tall / Latte Taupe', variant_id 49554137153674, quantity 1, price 74900, sku 3112540; badge 1; drawer shows 'Size: Tall', 'Color: Latte Taupe' and '$749.00'.
  3. Close the drawer and re-check the page.
    - expect: URL and selection unchanged; #stickyAtc shows the same title and price; /cart.js still has one line (no double add). Clear the cart at the end (item_count 0).

#### 4.5. 4.5. Reviews section, sticky bar and related products (read-only)

**File:** `tests/generated/abc-core-storefront/pdp.spec.ts`

**Steps:**
  1. Scroll to the 'Customer Reviews' region on /products/alessia-coffee-table. Do NOT click 'Be the first to write a review!' or 'Write a review'.
    - expect: The region exists. Either the zero-review state ('We're looking for stars!', 'Let us know what you think', button 'Be the first to write a review!', seen on both products on 2026-10-14) or a populated Yotpo widget; if reviews exist assert the average is between 1 and 5 and the count matches the cards.
  2. Scroll through the buy box and below with page.mouse.wheel and check the sticky bar and related sections.
    - expect: #stickyAtc is visible on desktop with the product title and '$999.00'; 'Pairs Well With' lists at least 3 cards with prices (for example 'Beton Table Lamp $519.20'); 'Frequently Purchased Together' leaves 'Loading products...' or stays empty without breaking the layout; 'Recently Viewed' is present.

### 5. 5. Cart

**Seed:** `tests/seed.spec.ts`

#### 5.1. 5.1. Cart drawer shows the line item, totals and shipping message after adding

**File:** `tests/generated/abc-core-storefront/cart.spec.ts`

**Steps:**
  1. Clear the cart; on /products/alessia-coffee-table add the default variant once and wait for the drawer.
    - expect: The drawer (role dialog, name starting 'Cart') lists one line with title link 'Alessia Glazed Coffee Table' (href contains ?variant=49554137055370), 'Size: Short', 'Color: Deep Umber Brown', line price '$999.00', quantity 1, buttons 'Decrease quantity', 'Increase quantity', 'Remove', 'In Stock - arrives in 1-3 weeks.' and footer 'TOTAL $999 + est. tax', 'CHECK OUT 1 ITEM · $999', 'OR EXPRESS CHECKOUT', 'Free returns within 30 days · Terms accepted at checkout'.
    - expect: Header badge 1; /cart.js total_price 99900 equals the drawer TOTAL.
  2. Read the free-delivery progress message.
    - expect: The drawer shows "You're $X away from free delivery" with a goal (observed $5,000): assert goal minus total equals the shown remainder. O4: the announcement bar promises free ground shipping at $250+, so log the mismatch as a content finding.
  3. Click the title link in the drawer.
    - expect: The browser opens the product page for the variant (URL /products/alessia-coffee-table?variant=49554137055370).

#### 5.2. 5.2. Drawer quantity increase and decrease keep line, total, badge and cart.js in sync

**File:** `tests/generated/abc-core-storefront/cart.spec.ts`

**Steps:**
  1. With one Alessia line (Tall / Latte Taupe, $749) click the drawer's 'Increase quantity' once and wait up to 5 s with auto-retrying expects (O12).
    - expect: Quantity text 2, line '$1,498.00', TOTAL '$1,498', drawer title '(2)', badge 2, /cart.js item_count 2 and total_price 149800.
  2. Click 'Decrease quantity' once.
    - expect: Quantity 1, line '$749.00', TOTAL '$749', badge 1, /cart.js 1 / 74900.
  3. At quantity 1 inspect 'Decrease quantity' (not exercised live).
    - expect: The line is not left in an invalid state: either the button is disabled and quantity stays 1, or the line is removed and the empty state shows; record which.

#### 5.3. 5.3. Removing the last item shows the empty state

**File:** `tests/generated/abc-core-storefront/cart.spec.ts`

**Steps:**
  1. With one line in the cart open the drawer and click 'Remove'.
    - expect: /cart.js item_count 0 and total_price 0; the drawer shows 'Your cart is empty' and a link 'Continue shopping' (href /collections/all); title '(0)'; TOTAL '$0'; badge 0.
  2. Click 'Continue shopping'.
    - expect: URL /collections/all, HTTP 200 (not 404) and product cards render (destination not yet clicked live).
  3. Record the state of the 'CHECK OUT 0 ITEMS · $0' button without clicking it.
    - expect: O7: it was visible and enabled in the empty state; log both attributes.

#### 5.4. 5.4. Two variants give two lines and a correct subtotal; /cart redirects to the drawer

**File:** `tests/generated/abc-core-storefront/cart.spec.ts`

**Steps:**
  1. Clear the cart, add the Alessia default variant on its PDP (one add), then load /products/delancey-2-piece-sectional (second page load, wait for the H1) and add its preselected variant once.
    - expect: /cart.js has 2 lines with different variant ids (Alessia 49554137055370 at 99900, Delancey 42642387304586 at 649500); total_price 749400; drawer TOTAL '$7,494' equals '$999.00' + '$6,495.00'; badge 2. (Two-line cart not yet seen live: record anything different.)
  2. Navigate to merchant.pages.cart (https://abchome.com/cart).
    - expect: O10: the browser ends on https://abchome.com/#open-sidecart (the homepage) and the drawer opens showing both lines; assert the URL contains #open-sidecart or the drawer is open, not that a separate cart page exists.
  3. Remove both lines or clear the cart.
    - expect: /cart.js item_count 0.

### 6. 6. Checkout

**Seed:** `tests/seed.spec.ts`

#### 6.1. 6.1. Drawer 'Check Out' reaches the Shopify checkout URL and stops

**File:** `tests/generated/abc-core-storefront/checkout.spec.ts`

**Steps:**
  1. Clear the cart, add the Alessia default variant once, open the drawer and click 'CHECK OUT' (button.sideCart__mobileCheckoutButton; mouse.click on its bounding box, or noWaitAfter then waitForURL).
    - expect: Within 45 s the browser lands on a URL matching /\/checkouts\/cn\/[^/]+\/en-us/ on abchome.com with title 'Checkout - abc carpet & home'. STOP: do not fill, tab into or submit any field; do not click express wallet buttons or 'Pay now'.
  2. Without interacting, read the visible heading or order summary text.
    - expect: No error or blocking interstitial is shown. The summary content was not inspected live: if it is readable, the Alessia item should appear; if the summary is lazy or in an iframe, skip this assertion and note it.

#### 6.2. 6.2. Cart contents survive the trip to checkout and back

**File:** `tests/generated/abc-core-storefront/checkout.spec.ts`

**Steps:**
  1. From the checkout URL reached in the same test use page.goBack().
    - expect: The browser returns to the storefront (product page or homepage); /cart.js still reports item_count 1, total_price 99900 and variant_id 49554137055370.
  2. Clear the cart at the end of the scenario.
    - expect: /cart.js item_count 0. If checkout redirects unexpectedly (for example back to the drawer URL), report a P1 candidate with the URL chain.

### 7. 7. Mobile (390x844)

**Seed:** `tests/seed.spec.ts`

#### 7.1. 7.1. Mobile homepage: no horizontal overflow and a working menu drawer

**File:** `tests/generated/abc-core-storefront/mobile.spec.ts`

**Steps:**
  1. Set the viewport to 390x844 and open the homepage.
    - expect: document.documentElement.scrollWidth is at most 390 (390 observed); header shows 'Open mobile menu', 'Wishlist', 'Search', 'Login', 'Open cart'. Log their sizes (30-40 px, O8); fail if a control is outside the viewport width.
  2. Tap 'Open mobile menu' (button.nav__burger / aria-label 'Open mobile menu'; mouse.click at its centre if click() hangs).
    - expect: .drawerMenu (390 px wide, starting near y 88) is visible with accordion buttons New Arrivals, Rugs & Carpet, Furniture, Lighting, Kitchen & Dining, Pillows & Throws, Bed & Bath, Décor & Gift, Jewelry, Sale and links STORES (/pages/abc-stores), RESTAURANTS, INTERIOR DESIGN, ABOUT US, ABCTRADE, 'Sign In' (/account).
  3. Tap the 'Furniture' accordion button, then the revealed 'Sofas & Sectionals' link; separately check the 'STORES' href. (Expansion not yet exercised live.)
    - expect: The accordion reveals its links (not interactable before); the link opens /collections/sofas-sectionals with cards rendered and scrollWidth at most 390; 'STORES' goes to /pages/abc-stores (HTTP 200). Never tap 'Sign In'.

#### 7.2. 7.2. Mobile collection and search are usable

**File:** `tests/generated/abc-core-storefront/mobile.spec.ts`

**Steps:**
  1. At 390x844 open /collections/furniture and wait for cards (not yet explored live).
    - expect: Cards are laid out in 2 columns (the grid class is product-grid--mobile-2), none wider than the viewport, no horizontal scroll, and the 'Filter' button and sort control are visible and tappable.
  2. Tap 'Filter', then close the panel (tap again or its close control) without selecting anything.
    - expect: The panel opens inside the viewport and closes; the page scrolls normally afterwards.
  3. Tap the header 'Search', type 'rug' and read the suggestions.
    - expect: The search field is visible, suggestions render inside the viewport width and the 'View all →' link is reachable.

#### 7.3. 7.3. Mobile product page: add to cart and the drawer are usable

**File:** `tests/generated/abc-core-storefront/mobile.spec.ts`

**Steps:**
  1. At 390x844 clear the cart, open /products/alessia-coffee-table (one load), scroll button.product-form__cart-submit into view and tap it once (mouse.click at its centre).
    - expect: Page scrollWidth at most 390 (375 observed); the button is inside the viewport (about 191x48); price '$999.00'; /cart.js has 1 item at 99900 titled 'Alessia Glazed Coffee Table - Short / Deep Umber Brown'.
  2. Inspect the drawer without clicking checkout.
    - expect: The drawer fills the viewport (390x844), shows the Alessia line, '$999.00', 'Increase quantity' / 'Decrease quantity' / 'Remove' inside the viewport width, and the CHECK OUT button is fully inside the viewport (about 358x40 at y near 692; log that it is under 44 px, O8) and not covered by the 'Live chat' iframe; scrollWidth stays 390.
  3. Tap 'Close' and check the sticky bar.
    - expect: The drawer closes and the page scrolls again; #stickyAtc, if shown after scrolling, repeats the title and price and does not cover the main button. Clear the cart at the end (item_count 0).
