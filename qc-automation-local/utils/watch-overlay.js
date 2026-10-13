/**
 * utils/watch-overlay.js — "Watch mode" overlay for headed runs
 *
 * Playwright drives the browser with synthetic input, so a headed run shows no
 * cursor and no hint of which test is running. In watch mode (QC_WATCH=true,
 * see `--watch` in scripts/run-suite.js) every page gets:
 *
 *   - a banner naming the test case that is running right now
 *   - a red cursor dot that follows the mouse, with a ripple on every click
 *   - a label for the last action: the element clicked / typed into
 *
 * The overlay is pointer-events:none, so it never intercepts a click, but it
 * IS drawn on the page: don't use watch mode for screenshot/visual tests.
 * Wired in as the auto `watchOverlay` fixture in fixtures/base.js.
 */

/** Runs inside the browser (serialised by Playwright) -- must be self-contained. */
function installOverlay({ title, sub }) {
    if (window.__qcWatchOverlay) return;
    window.__qcWatchOverlay = true;

    const mount = () => {
        if (!document.documentElement || document.getElementById('__qc-watch')) return;

        const host = document.createElement('div');
        host.id = '__qc-watch';
        host.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483647;';

        const style = document.createElement('style');
        style.textContent =
            '@keyframes qcRipple{from{transform:translate(-50%,-50%) scale(.3);opacity:.9}' +
            'to{transform:translate(-50%,-50%) scale(2.6);opacity:0}}';

        const banner = document.createElement('div');
        banner.style.cssText =
            'position:absolute;left:50%;bottom:12px;transform:translateX(-50%);max-width:92%;' +
            'background:rgba(20,20,20,.92);color:#fff;font:600 13px/1.35 Arial,sans-serif;' +
            'padding:8px 14px;border-radius:8px;border-left:5px solid #ff3b30;box-shadow:0 2px 10px rgba(0,0,0,.4);';
        banner.innerHTML = '<div style="color:#ffb3ae;font-size:11px;font-weight:700;letter-spacing:.04em">NOW TESTING</div>';
        const t = document.createElement('div');
        t.textContent = title;
        const s = document.createElement('div');
        s.textContent = sub;
        s.style.cssText = 'font-weight:400;font-size:11px;color:#bbb;';
        const action = document.createElement('div');
        action.style.cssText = 'font-weight:400;font-size:12px;color:#7CFC9A;margin-top:3px;min-height:15px;';
        banner.append(t, s, action);

        const cursor = document.createElement('div');
        cursor.style.cssText =
            'position:absolute;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;' +
            'background:rgba(255,59,48,.55);border:2px solid #fff;box-shadow:0 0 0 2px #ff3b30;display:none;';

        host.append(style, banner, cursor);
        document.documentElement.appendChild(host);

        const describe = el => {
            const target = (el && el.closest && el.closest('a,button,[role="button"],input,select,textarea,summary,label')) || el;
            if (!target || !target.tagName) return '';
            const tag  = target.tagName.toLowerCase();
            const text = (target.getAttribute('aria-label') || target.innerText || target.value ||
                          target.getAttribute('name') || target.getAttribute('href') || '').replace(/\s+/g, ' ').trim();
            return '<' + tag + '> ' + text.slice(0, 60);
        };

        document.addEventListener('mousemove', e => {
            cursor.style.display = 'block';
            cursor.style.left = e.clientX + 'px';
            cursor.style.top  = e.clientY + 'px';
        }, true);

        document.addEventListener('mousedown', e => {
            const ripple = document.createElement('div');
            ripple.style.cssText =
                'position:absolute;width:46px;height:46px;border-radius:50%;border:3px solid #ff3b30;' +
                'left:' + e.clientX + 'px;top:' + e.clientY + 'px;animation:qcRipple .7s ease-out forwards;';
            host.appendChild(ripple);
            setTimeout(() => ripple.remove(), 800);
            action.textContent = '\u{1F5B1} click → ' + describe(e.target);
        }, true);

        document.addEventListener('input', e => {
            action.textContent = '⌨ typing → ' + describe(e.target);
        }, true);
    };

    if (document.documentElement) mount();
    document.addEventListener('DOMContentLoaded', mount);
    // Some themes rebuild <html> children; re-attach if the overlay is removed.
    setInterval(mount, 1000);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ title: string, sub: string }} info
 */
async function attachWatchOverlay(page, info) {
    await page.addInitScript(installOverlay, info);
}

module.exports = { attachWatchOverlay };
