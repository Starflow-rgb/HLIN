/* Starflow Local — Share dropdown + Schema (external, CSP-friendly) */
(function () {
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ===== Page context =====
  const heading = $('h2') || $('h1');
  const pageTitle = (heading?.textContent || document.title).trim();
  const isEventsPage = /free this weekend/i.test(pageTitle);

  // ===== Share dropdown (enhance only; dropdown itself is native <details>) =====
  (function shareDropdown(){
    const dd  = $('#share-dd'); if (!dd) return;
    const menu = $('#share-menu');
    const wa = $('#share-whatsapp');
    const fb = $('#share-facebook');
    const cp = $('#share-copy');

    // Build UTM’d URL
    const u = new URL(window.location.href);
    const campaign = dd.dataset.utmcampaign || 'page';
    if (!u.searchParams.get('utm_source')) {
      u.searchParams.set('utm_source','site');
      u.searchParams.set('utm_medium','share');
      u.searchParams.set('utm_campaign', campaign);
    }
    const shareUrl = u.toString();
    const shareTitle = pageTitle;

    // Upgrade links with final URLs
    if (wa) wa.href = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(shareTitle + ' — ' + shareUrl);
    if (fb) fb.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl);

    // Copy link (robust + toast)
    function toast(msg='Link copied'){
      const old = $('.share-snackbar'); if (old) old.remove();
      const el = document.createElement('div');
      el.className = 'share-snackbar'; el.textContent = msg;
      document.body.appendChild(el);
      requestAnimationFrame(()=> el.classList.add('show'));
      setTimeout(()=> { el.classList.remove('show'); setTimeout(()=>el.remove(), 180); }, 1400);
    }
    async function copyLink() {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast();
      } catch {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select(); input.setSelectionRange(0, shareUrl.length);
        try { document.execCommand('copy'); toast(); }
        catch { prompt('Copy link:', shareUrl); }
        input.remove();
      }
    }
    cp?.addEventListener('click', (e)=>{ e.preventDefault(); copyLink(); dd.open = false; });

    // Accessibility niceties
    dd.addEventListener('toggle', () => {
      const sum = dd.querySelector('summary');
      if (sum) sum.setAttribute('aria-expanded', String(dd.open));
    });
    document.addEventListener('click', (e) => {
      if (!dd.open) return;
      if (!e.target.closest('#share-dd')) dd.open = false;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dd.open = false;
    });
  })();

  // ===== Schema from visible list =====
  const lis = $$('.table-wrapper li');
  if (!lis.length) return;

  const firstLineOf = (li) =>
    (li.textContent || '').split('\n').map(s=>s.trim()).filter(Boolean)[0] || '';

  if (isEventsPage) {
    // Event schema for “Free this weekend”
    const events = lis.map(li => {
      const a = $('a[href^="http"]', li);
      const line1 = firstLineOf(li);
      const dateMatch = line1.match(/^(\d{4}-\d{2}-\d{2})/);
      const dateStr = dateMatch ? dateMatch[1] : '';
      const name = (a?.textContent?.trim()) || line1.replace(/^\d{4}-\d{2}-\d{2}\s*—\s*/,'').trim();

      const venueLine = (li.textContent || '')
        .split('\n').map(s=>s.trim()).filter(Boolean)
        .find(s => /·/.test(s)) || '';
      const venueName = venueLine ? venueLine.split('·')[0].trim() : '';

      const obj = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": name,
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "eventStatus": "https://schema.org/EventScheduled",
        "isAccessibleForFree": true
      };
      if (a) obj.url = a.href;
      if (dateStr) obj.startDate = dateStr; // date-only OK
      if (venueName) obj.location = { "@type": "Place", "name": venueName };
      return obj;
    });

    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify({ "@context":"https://schema.org", "@graph": events });
    document.head.appendChild(s);
    return;
  }

  // ItemList schema for venue lists
  const items = lis.map((li, i) => {
    const a = $('a[href^="http"]', li);
    let name = firstLineOf(li);
    name = name.replace(/\s+(soft_play|park|pharmacy|urgent_care|baby_group)\s*$/i, '').trim();
    return {
      "@type": "ListItem",
      "position": i + 1,
      "name": name || (a?.textContent?.trim()) || document.title,
      ...(a && { "url": a.href })
    };
  });

  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": pageTitle,
    "itemListElement": items
  };
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(data);
  document.head.appendChild(s);
})();
