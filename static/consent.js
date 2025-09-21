// static/consent.js — simple analytics consent (temporary until CMP)
(function () {
  const KEY = "hlinConsent";

  // Already decided? apply and exit
  const saved = (localStorage.getItem(KEY) || "").toLowerCase();
  if (saved) {
    if (saved === "granted") {
      try { gtag('consent', 'update', { analytics_storage: 'granted' }); } catch (e) {}
    }
    return;
  }

  // Styles
  const css = `
  #consent-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;
    background:#0f172a;color:#e5e7eb;padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,.12);
    box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:860px;margin:0 auto}
  #consent-banner p{margin:0 0 .75rem 0}
  #consent-banner .btn{display:inline-block;padding:.55rem .9rem;margin-right:.5rem;border-radius:10px;
    border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;text-decoration:none}
  #consent-banner .btn.primary{background:#2563eb;border-color:#2563eb}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Banner
  const el = document.createElement('div');
  el.id = 'consent-banner';
  el.innerHTML = `
    <p>We use cookies for basic analytics after you consent. No personalisation. See our <a href="/privacy/">Privacy Policy</a>.</p>
    <button class="btn" data-decline>Decline</button>
    <button class="btn primary" data-accept>Accept analytics</button>
  `;
  document.body.appendChild(el);

  function apply(val) {
    localStorage.setItem(KEY, val);
    try { gtag('consent', 'update', { analytics_storage: val }); } catch (e) {}
    el.remove();
  }

  el.querySelector('[data-accept]').onclick = () => apply('granted');
  el.querySelector('[data-decline]').onclick = () => apply('denied');

  // helper to reset quickly in console
  window.resetConsent = () => { localStorage.removeItem(KEY); location.reload(); };
})();
