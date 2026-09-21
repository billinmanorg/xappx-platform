/* XAPPX cookie consent banner. Self-contained: injects its own styles + markup,
   remembers the choice in localStorage, and shows once per visitor. Privacy-first:
   nothing non-essential should load until "Accept all" is chosen; "Essential only"
   is given equal weight. Add via: <script src="/cookies.js" defer></script> */
(function () {
  'use strict';
  var KEY = 'xappx_cookie_consent';
  try { if (localStorage.getItem(KEY)) return; } catch (e) { /* storage blocked: still show once */ }

  var css = ''
    + '#xappx-cookies{position:fixed;left:0;right:0;bottom:0;z-index:2147482000;'
    + 'background:#0C1119;border-top:1px solid #1C2636;color:#EDF2FA;'
    + 'font-family:"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;'
    + 'font-size:14px;line-height:1.5;display:flex;flex-wrap:wrap;align-items:center;'
    + 'gap:12px 20px;padding:14px 22px;box-shadow:0 -8px 30px rgba(0,0,0,.45)}'
    + '#xappx-cookies p{margin:0;flex:1;min-width:240px;color:#C7D2E4}'
    + '#xappx-cookies a{color:#00C2FF;text-decoration:none}'
    + '#xappx-cookies a:hover{text-decoration:underline}'
    + '#xappx-cookies .cbtns{display:flex;gap:10px;flex-wrap:wrap}'
    + '#xappx-cookies button{font:inherit;font-weight:600;cursor:pointer;border-radius:10px;'
    + 'padding:10px 16px;border:1px solid #28344a;background:none;color:#EDF2FA}'
    + '#xappx-cookies button.primary{border:0;background:linear-gradient(100deg,#00C2FF,#2f7bff,#8A73FF);color:#00131f}'
    + '#xappx-cookies button:hover{filter:brightness(1.08)}'
    + '#xappx-cookies button:focus-visible{outline:2px solid #00C2FF;outline-offset:2px}'
    + '@media(max-width:560px){#xappx-cookies{flex-direction:column;align-items:stretch}'
    + '#xappx-cookies .cbtns{justify-content:flex-end}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var bar = document.createElement('div');
  bar.id = 'xappx-cookies';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Cookie consent');
  bar.innerHTML =
    '<p>We use essential cookies to run XAPPX, and — only with your consent — analytics to improve it. '
    + 'See our <a href="/privacy.html">Privacy Policy</a>.</p>'
    + '<div class="cbtns">'
    + '<button type="button" data-essential>Essential only</button>'
    + '<button type="button" class="primary" data-all>Accept all</button>'
    + '</div>';
  document.body.appendChild(bar);

  function choose(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ }
    bar.remove();
  }
  bar.querySelector('[data-essential]').addEventListener('click', function () { choose('essential'); });
  bar.querySelector('[data-all]').addEventListener('click', function () { choose('all'); });
})();
