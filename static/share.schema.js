/* Starflow Local — Share + Schema (external, CSP-friendly) */
(function () {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const heading = $('h2') || $('h1');
  const pageTitle = (heading?.textContent || document.title).trim();
  const isEventsPage = /free this weekend/i.test(pageTitle);

  // ===== Enhance Share Bar (works even without JS; this just upgrades links) =====
  (function enhanceShare(){
    const wrap = $('.sharebar'); if (!wrap) return;

    const u = new URL(window.location.href);
    if (!u.searchParams.get('utm_source')) {
      u.searchParams.set('utm_source','site');
      u.searchParams.set('utm_medium','share');
      u.searchParams.set('utm_campaign', wrap.dataset.utmcampaign || 'page');
    }
    const shareUrl = u.toString();
    const shareTitle = pageTitle;

    const wa = $('#share-whatsapp');
    if (wa) wa.href = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(shareTitle + ' — ' + shareUrl);

    const fb = $('#share-facebook');
    if (fb) fb.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl);

    const cp = $('#share-copy');
    if (cp) {
      cp.addEventListener('click', function (e) {
        e.preventDefault();
        (async () => {
          try { await navigator.clipboard.writeText(shareUrl); alert('Link copied'); }
          catch { prompt('Copy link:', shareUrl); }
        })();
      }, { passive:false });
    }

    const nat = $('#share-native');
    if (nat) {
      nat.addEventListener('click', function (e) {
        e.preventDefault();
        if (navigator.share) {
          navigator.share({ title: shareTitle, url: shareUrl }).catch(()=>{});
        } else {
          window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl), '_blank', 'noopener,noreferrer');
        }
      }, { passive:false });
    }
  })();

  // ===== Build Schema JSON-LD from visible list =====
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
      if (dateStr) obj.startDate = dateStr;
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
