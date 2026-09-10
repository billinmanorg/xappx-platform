(function () {
  'use strict';
  var CONFIG = {
    endpoint: 'https://xappxchat.srv1456914.hstgr.cloud/api/plugins/custom-webhook/webhook',
    accessKey: '77ec3b93dab59de8ba4d4320e25c730e214fef06f1ed7cda', /* replace this text with the key Jim sent you, keep the quotes */
    name: 'XAPPY',
    tagline: "XAPPX's AI guide",
    greeting: 'Hi! What would you like to build?',
    chips: ['I want an app', 'I need an AI agent', "I'm not sure yet"],
    notice: 'XAPPY uses AI. Please do not enter passwords, payment details, or sensitive information.',
    avatarUrl: '/xappy-face.png' /* URL of the approved XAPPY artwork. Leave empty to use the built-in mark. */
  };
  if (document.getElementById('xappy-root')) return;
  /* Session id so the conversation keeps context across messages on this visit */
  var senderId;
  try {
    senderId = sessionStorage.getItem('xappy-sid');
    if (!senderId) {
      senderId = 'v-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      sessionStorage.setItem('xappy-sid', senderId);
    }
  } catch (e) {
    senderId = 'v-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  var host = document.createElement('div');
  host.id = 'xappy-root';
  var root = host.attachShadow({ mode: 'open' });
  var css = [
    ':host{all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.45;-webkit-font-smoothing:antialiased}',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}',
    '.launch{width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#22d3ee 0%,#3b82f6 50%,#8b5cf6 100%);box-shadow:0 10px 30px rgba(59,130,246,.35),0 2px 6px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform .18s ease}',
    '.launch:hover{transform:translateY(-2px)}',
    '.launch:focus-visible,.send:focus-visible,.close:focus-visible,.chip:focus-visible{outline:3px solid #fff;outline-offset:2px}',
    '.launch svg{width:28px;height:28px}',
    '.launch.hidden{display:none}',
    '.panel{position:absolute;right:0;bottom:0;width:372px;max-width:calc(100vw - 40px);height:560px;max-height:calc(100vh - 40px);background:#0b1230;color:#eef2ff;border-radius:18px;box-shadow:0 24px 60px rgba(3,7,18,.6);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;transition:opacity .2s ease,transform .2s ease}',
    '.panel.open{opacity:1;transform:none;pointer-events:auto}',
    '.head{display:flex;align-items:center;gap:12px;padding:16px 16px 14px;border-bottom:1px solid rgba(255,255,255,.08)}',
    '.avatar{width:40px;height:40px;border-radius:50%;flex:0 0 40px;background:linear-gradient(135deg,#22d3ee,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;overflow:hidden}',
    '.avatar img{width:100%;height:100%;object-fit:cover;display:block}',
    '.avatar svg{width:24px;height:24px}',
    '.title{font-weight:700;font-size:16px;letter-spacing:.2px}',
    '.sub{font-size:12.5px;color:#a9b4cc;margin-top:1px}',
    '.close{margin-left:auto;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#a9b4cc}',
    '.close:hover{background:rgba(255,255,255,.08);color:#fff}',
    '.log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}',
    '.msg{max-width:84%;padding:10px 13px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}',
    '.bot{align-self:flex-start;background:#161f45;border-bottom-left-radius:5px}',
    '.me{align-self:flex-end;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;border-bottom-right-radius:5px}',
    '.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}',
    '.chip{padding:8px 13px;border-radius:999px;border:1px solid rgba(139,92,246,.6);color:#dbe4ff;font-size:13.5px;background:rgba(139,92,246,.12);transition:background .15s ease}',
    '.chip:hover{background:rgba(139,92,246,.28)}',
    '.typing{display:inline-flex;gap:5px;padding:12px 14px}',
    '.typing i{width:7px;height:7px;border-radius:50%;background:#8ea0c9;animation:xb 1s infinite ease-in-out}',
    '.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}',
    '@keyframes xb{0%,80%,100%{opacity:.35;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}',
    '.err{align-self:flex-start;color:#ffb4b4;font-size:13.5px}',
    '.foot{padding:10px 12px 12px;border-top:1px solid rgba(255,255,255,.08)}',
    '.row{display:flex;gap:8px;align-items:flex-end}',
    'textarea{flex:1;resize:none;min-height:44px;max-height:120px;padding:11px 13px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#111a3d;color:#fff;font:inherit;outline:none}',
    'textarea:focus{border-color:#3b82f6}',
    'textarea::placeholder{color:#7d89a8}',
    '.send{width:44px;height:44px;border-radius:12px;flex:0 0 44px;background:linear-gradient(135deg,#22d3ee,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff}',
    '.send:disabled{opacity:.45;cursor:default}',
    '.send svg{width:20px;height:20px}',
    '.notice{font-size:11.5px;color:#7d89a8;margin-top:8px;line-height:1.35}',
    '@media (max-width:480px){:host{right:12px;bottom:12px}.panel{position:fixed;inset:0;width:100vw;max-width:100vw;height:100vh;max-height:100vh;height:100dvh;border-radius:0}}',
    '@media (prefers-reduced-motion:reduce){.panel,.launch,.chip{transition:none}.typing i{animation:none;opacity:.7}}'
  ].join('');
  var markSvg = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5c-3.9 0-7 2.6-7 6 0 2.2 1.3 4.1 3.3 5.2L7.5 19l3.4-2.1c.4 0 .7.1 1.1.1 3.9 0 7-2.6 7-6s-3.1-5.5-7-5.5z" fill="#fff" fill-opacity=".95"/><circle cx="9.6" cy="9.6" r="1.25" fill="#3b82f6"/><circle cx="14.4" cy="9.6" r="1.25" fill="#3b82f6"/><path d="M9.8 12.6c.6.7 1.4 1 2.2 1s1.6-.3 2.2-1" stroke="#3b82f6" stroke-width="1.3" stroke-linecap="round"/></svg>';
  var sendSvg = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12 20 4l-4 16-4-6.5L4 12z" fill="currentColor"/></svg>';
  var closeSvg = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var avatarInner = CONFIG.avatarUrl ? '<img src="' + esc(CONFIG.avatarUrl) + '" alt="">' : markSvg;
  root.innerHTML =
    '<style>' + css + '</style>' +
    '<button class="launch" type="button" aria-label="Open chat with ' + esc(CONFIG.name) + '" aria-expanded="false">' + markSvg + '</button>' +
    '<div class="panel" role="dialog" aria-modal="false" aria-label="' + esc(CONFIG.name) + ' chat" aria-hidden="true">' +
      '<div class="head">' +
        '<div class="avatar">' + avatarInner + '</div>' +
        '<div><div class="title">' + esc(CONFIG.name) + '</div><div class="sub">' + esc(CONFIG.tagline) + '</div></div>' +
        '<button class="close" type="button" aria-label="Close chat">' + closeSvg + '</button>' +
      '</div>' +
      '<div class="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<div class="foot">' +
        '<div class="row"><textarea rows="1" placeholder="Type your message" aria-label="Your message"></textarea>' +
        '<button class="send" type="button" aria-label="Send">' + sendSvg + '</button></div>' +
        '<div class="notice">' + esc(CONFIG.notice) + '</div>' +
      '</div>' +
    '</div>';
  var launch = root.querySelector('.launch');
  var panel = root.querySelector('.panel');
  var closeBtn = root.querySelector('.close');
  var log = root.querySelector('.log');
  var input = root.querySelector('textarea');
  var sendBtn = root.querySelector('.send');
  var busy = false;
  var greeted = false;
  function addMsg(text, who) {
    var el = document.createElement('div');
    el.className = 'msg ' + who;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function addChips() {
    var wrap = document.createElement('div');
    wrap.className = 'chips';
    CONFIG.chips.forEach(function (label) {
      var b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', function () { wrap.remove(); send(label); });
      wrap.appendChild(b);
    });
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }
  function showTyping() {
    var t = document.createElement('div');
    t.className = 'msg bot typing';
    t.setAttribute('aria-label', CONFIG.name + ' is typing');
    t.innerHTML = '<i></i><i></i><i></i>';
    log.appendChild(t);
    log.scrollTop = log.scrollHeight;
    return t;
  }
  function setBusy(v) { busy = v; sendBtn.disabled = v; input.disabled = v; }
  function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    var existing = root.querySelector('.chips');
    if (existing) existing.remove();
    addMsg(text, 'me');
    input.value = '';
    autosize();
    setBusy(true);
    var typing = showTyping();
    fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.accessKey },
      body: JSON.stringify({ senderId: senderId, text: text, page: location.pathname, device: (window.matchMedia && window.matchMedia('(max-width: 480px)').matches) ? 'mobile' : 'desktop' })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        typing.remove();
        if (d && d.ok && typeof d.reply === 'string' && d.reply.trim()) {
          addMsg(d.reply.replace(/\s*[—–]\s*|\s*--\s*/g, ', ').trim(), 'bot');
        } else {
          fail();
        }
      })
      .catch(function () { typing.remove(); fail(); })
      .then(function () { setBusy(false); input.focus(); });
  }
  function fail() {
    var e = document.createElement('div');
    e.className = 'err';
    e.textContent = 'Something went wrong sending that. Please try again in a moment.';
    log.appendChild(e);
    log.scrollTop = log.scrollHeight;
  }
  function open() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    launch.setAttribute('aria-expanded', 'true');
    launch.classList.add('hidden');
    if (!greeted) { greeted = true; addMsg(CONFIG.greeting, 'bot'); addChips(); }
    setTimeout(function () { input.focus(); }, 60);
  }
  function close() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    launch.setAttribute('aria-expanded', 'false');
    launch.classList.remove('hidden');
    launch.focus();
  }
  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  launch.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  sendBtn.addEventListener('click', function () { send(input.value); });
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); }
    if (e.key === 'Escape') close();
  });
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  document.body.appendChild(host);
})();
