// Sun Ocean Realty — OneHome scraper v4
// Adds a floating "Scrape" button on OneHome property pages; polls storage for photo progress.
(function () {
  'use strict';
  if (window.__sorOneHome) return;
  window.__sorOneHome = true;

  const ICON_PLUS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  const ICON_CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';

  const isPropertyPage = () => window.location.pathname.includes('/property/');

  function injectFloatingButton() {
    if (!isPropertyPage() || document.getElementById('sor-scrape-fab')) return;
    const fab = document.createElement('div');
    fab.id = 'sor-scrape-fab';
    fab.innerHTML = `
      <button id="sor-scrape-btn" type="button" title="Save this listing to Sun Ocean">${ICON_PLUS}<span>Scrape</span></button>
      <div id="sor-scrape-status" class="sor-hidden"></div>`;
    document.body.appendChild(fab);
    document.getElementById('sor-scrape-btn').addEventListener('click', handleScrape);
  }

  function showStatus(message, type) {
    const el = document.getElementById('sor-scrape-status');
    if (!el) return;
    el.textContent = message;
    el.className = `sor-status-${type || 'info'}`;
    if (type === 'success') setTimeout(() => { el.className = 'sor-hidden'; }, 6000);
  }

  function setButton(html, disabled, busy) {
    const btn = document.getElementById('sor-scrape-btn');
    if (!btn) return;
    btn.innerHTML = html;
    btn.disabled = !!disabled;
    btn.classList.toggle('sor-scraping', !!busy);
  }

  let scraping = false;
  async function handleScrape() {
    if (scraping) return;
    scraping = true;
    setButton(`${ICON_PLUS}<span>Scraping…</span>`, true, true);
    showStatus('Reading listing details…', 'info');

    try {
      await expandDescription();
      const data = extractListingData();
      if (!data.mlsNumber) throw new Error('Could not find the MLS number on this page.');

      const photoUrls = extractPhotoUrls();
      data.sourceUrl = window.location.href;
      showStatus(`MLS# ${data.mlsNumber}\nSaving ${photoUrls.length} photos… 0 / ${photoUrls.length}`, 'info');

      await chrome.storage.local.set({ _scrapeProgress: null });
      chrome.runtime.sendMessage({ action: 'SCRAPE_LISTING', listing: data, photos: photoUrls });

      const id = data.mlsNumber;
      const started = Date.now();
      await new Promise((resolve) => {
        const poll = setInterval(async () => {
          try {
            const { _scrapeProgress: p } = await chrome.storage.local.get('_scrapeProgress');
            if (Date.now() - started > 300000) { clearInterval(poll); showStatus('Still working — check the extension popup.', 'info'); resolve(); return; }
            if (!p || p.mls !== id) return;
            if (p.status === 'downloading') showStatus(`MLS# ${id}\nSaving photos: ${p.current} / ${p.total}`, 'info');
            if (p.status === 'done') {
              clearInterval(poll);
              showStatus(`✅ MLS# ${id} saved with ${p.current} photos.\nOpen Craigslist to post it.`, 'success');
              await chrome.storage.local.remove('_scrapeProgress');
              resolve();
            }
          } catch (_) { /* extension reloaded */ }
        }, 800);
      });
      setButton(`${ICON_CHECK}<span>Saved!</span>`, true, false);
      setTimeout(() => setButton(`${ICON_PLUS}<span>Scrape</span>`, false, false), 3000);
    } catch (err) {
      showStatus(`Error: ${err.message}`, 'error');
      setButton(`${ICON_PLUS}<span>Scrape</span>`, false, false);
    } finally {
      scraping = false;
    }
  }

  // ── Data extraction ──────────────────────────────────────────
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const qa = (name) => text(document.querySelector(`[data-qa="${name}"]`));

  // Every OneHome feature row looks like <div data-qa="SomethingColon-feature"><… class="detail">value</…></div>.
  function extractFeatureMap() {
    const out = {};
    document.querySelectorAll('[data-qa$="Colon-feature"]').forEach(el => {
      const key = el.getAttribute('data-qa').replace(/Colon-feature$/, '');
      const value = text(el.querySelector('.detail')) || text(el).replace(/^[^:]*:\s*/, '');
      if (key && value && !(key in out)) out[key] = value;
    });
    return out;
  }

  function extractListingData() {
    const data = {};
    const mlsText = text(document.querySelector('.mls')) || qa('mls') || (document.body.innerText.match(/MLS\s*#?\s*:?\s*([A-Z0-9-]{5,})/i) || [])[0] || '';
    const m = mlsText.match(/MLS\s*#?\s*:?\s*([A-Z0-9-]+)/i);
    data.mlsNumber = m ? m[1] : '';

    const line1 = qa('address-line1');
    const line2 = qa('address-line2');
    data.fullAddress = [line1, line2 && !line1.includes(line2) ? line2 : ''].filter(Boolean).join(', ').replace(/\s+/g, ' ');
    // "123 SW 4th Ave, Hollywood, FL 33020" or "123 SW 4th Ave Hollywood, FL 33020" (no comma):
    // split off state + ZIP, then let the city list decide where the street ends.
    const addr = data.fullAddress.match(/^(.*?)[,\s]+([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$/);
    if (addr) {
      data.state = addr[2];
      data.zip = addr[3];
      data.city = SOR.cleanCity(addr[1]);
      data.streetAddress = SOR.cleanStreet(addr[1], data.city);
    }

    const pm = qa('house-price').match(/\$[\d,]+/);
    data.price = pm ? pm[0] : '';
    data.bedrooms = qa('beds');
    data.bathrooms = qa('baths');
    data.sqft = qa('sqft');
    data.daysOnMarket = qa('days');
    data.description = Array.from(document.querySelectorAll('.overview-container p')).map(text).filter(Boolean).join(' ');

    const features = extractFeatureMap();
    data.features = features;
    const gf = (...keys) => keys.map(k => features[k]).find(Boolean) || '';
    data.propertyType = gf('PropertySubType', 'PropertyType');
    data.yearBuilt = gf('YearBuilt');
    data.petsAllowed = gf('PetsAllowed');
    data.furnished = gf('Furnished');
    data.county = gf('CountyOrParish');
    data.subdivision = gf('SubdivisionName');
    data.pool = gf('PoolFeatures', 'PoolPrivateYN');
    data.heating = gf('Heating');
    data.cooling = gf('Cooling');
    data.lotSize = gf('LotSizeAreaOrRange', 'LotSizeArea');
    data.parking = gf('ParkingFeatures', 'GarageParkingFeatures');
    const featureCity = SOR.cleanCity(gf('City', 'PostalCity'));
    if (featureCity) {
      data.city = featureCity;
      data.streetAddress = SOR.cleanStreet(data.streetAddress, featureCity);
    }

    data.additionalDetails = {};
    document.querySelectorAll('aotf-property-details').forEach(section => {
      const header = text(section.querySelector('h3'));
      if (!header) return;
      const pairs = {};
      section.querySelectorAll('dt').forEach(dt => {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === 'DD') pairs[text(dt).replace(/:$/, '')] = text(dd);
      });
      if (Object.keys(pairs).length) data.additionalDetails[header] = pairs;
    });

    // Fill gaps from the detail sections when the headline widgets were missing.
    const flat = Object.assign({}, ...Object.values(data.additionalDetails));
    const pickFlat = (re) => { const k = Object.keys(flat).find(x => re.test(x)); return k ? flat[k] : ''; };
    if (!data.bedrooms) data.bedrooms = pickFlat(/^bedrooms?( total)?$/i);
    if (!data.bathrooms) data.bathrooms = pickFlat(/^(bathrooms?|baths)( total)?$/i);
    if (!data.propertyType) data.propertyType = pickFlat(/property (sub )?type/i);
    if (!data.petsAllowed) data.petsAllowed = pickFlat(/pets? allowed/i);
    if (!data.county) data.county = pickFlat(/county/i);
    data.source = 'mls';
    return data;
  }

  function extractPhotoUrls() {
    const urls = [];
    const seen = new Set();
    const addUrl = (u) => {
      if (!u || !/^https:\/\//.test(u) || /placeholder|data:/.test(u)) return;
      const base = u.replace(/[?&](width|w|h|height|size)=\d+/g, '').replace(/\s+\d+w$/, '');
      if (seen.has(base)) return;
      seen.add(base);
      urls.push(u);
    };

    document.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)').forEach(slide => {
      const img = slide.querySelector('img.feature-pic, img');
      if (!img) return;
      const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      let chosen = null;
      if (srcset) {
        const hd = srcset.match(/(https:\/\/[^\s]+)\s+1024w/);
        const med = srcset.match(/(https:\/\/[^\s]+)\s+(?:640|512|480)w/);
        const sm = srcset.match(/(https:\/\/[^\s]+)\s+296w/);
        chosen = hd ? hd[1] : med ? med[1] : sm ? sm[1] : ((srcset.match(/(https:\/\/[^\s,]+)/) || [])[1] || null);
      }
      addUrl(chosen || src);
    });

    if (!urls.length) {
      document.querySelectorAll('.swiper-slide, [class*="slide"]').forEach(el => {
        const match = getComputedStyle(el).backgroundImage.match(/url\(["']?(https:\/\/[^"')]+)/);
        if (match) addUrl(match[1]);
      });
    }
    return urls;
  }

  async function expandDescription() {
    for (const sel of ['.btn-readmore button', 'button.read-more', '[data-qa="read-more"]']) {
      const more = document.querySelector(sel);
      if (more) { more.click(); await sleep(500); return; }
    }
  }

  // ── Share / search / collection pages ────────────────────────
  // e.g. https://portal.onehome.com/en-US/share/1145890F99332 → a list of the shared properties.
  // Property URLs need the page's token/searchId to open, so they are carried over.
  function pageAuthParams() {
    const p = new URLSearchParams(location.search);
    return { token: p.get('token'), searchId: p.get('searchId') };
  }

  function withAuth(href) {
    const u = new URL(href, location.href);
    const { token, searchId } = pageAuthParams();
    if (token && !u.searchParams.get('token')) u.searchParams.set('token', token);
    if (searchId && !u.searchParams.get('searchId')) u.searchParams.set('searchId', searchId);
    return u.href;
  }

  // OneHome share/search tokens are base64 JSON that include the MLS source code (e.g. "OSN":"BEACH").
  function pageOsn() {
    const tryToken = (t) => {
      try { const j = JSON.parse(atob(decodeURIComponent(t))); return j.OSN || j.osn || ''; } catch (_) { return ''; }
    };
    const fromUrl = tryToken(pageAuthParams().token || '');
    if (fromUrl) return fromUrl;
    for (const store of [sessionStorage, localStorage]) {
      try {
        for (let i = 0; i < store.length; i++) {
          const v = store.getItem(store.key(i)) || '';
          const m = v.match(/"OSN"\s*:\s*"([A-Za-z0-9]+)"/);
          if (m) return m[1];
        }
      } catch (_) { /* storage blocked */ }
    }
    return '';
  }

  // Property ids seen in OneHome's own API responses (collected by onehome-net.js in the page).
  let net = { aotf: [], generic: [], samples: [] };
  function refreshNet() {
    return new Promise((resolve) => {
      const done = (data) => { window.removeEventListener('message', onMsg); if (data) net = data; resolve(net); };
      const onMsg = (e) => { if (e.source === window && e.data && e.data.__sorNetRes === 1) done(e.data); };
      window.addEventListener('message', onMsg);
      window.postMessage({ __sorNetReq: 1 }, '*');
      setTimeout(() => done(null), 800);
    });
  }

  // Exact OneHome property ids ("aotf~123~BEACH") seen in the data feed.
  function netUrls() {
    return net.aotf.map(x => { const [, id, osn] = x.split('~'); return propertyUrl(id, osn); });
  }

  // Best guess from listing-shaped records in the feed (id + price + address). Used last.
  function guessedNetUrls() {
    const osn = pageOsn();
    return net.generic.map(g => {
      if (/^aotf~/i.test(g.id)) { const [, id, o] = g.id.split('~'); return propertyUrl(id, o); }
      const o = g.osn || osn;
      return /^\d{5,}$/.test(g.id) && o ? propertyUrl(g.id, o) : null;
    }).filter(Boolean);
  }

  function propertyUrl(id, osn) {
    const lang = (location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})\//) || [])[1] || 'en-US';
    return withAuth(`${location.origin}/${lang}/property/aotf~${id}~${osn}`);
  }

  // Every property id on the page: real links first, then OneHome "aotf~<id>~<MLS>" ids found
  // anywhere in the markup (router links, data attributes, image keys).
  function harvestPropertyUrls() {
    const out = new Map();
    document.querySelectorAll('a[href*="/property/"]').forEach(a => {
      try {
        const u = new URL(a.getAttribute('href'), location.href);
        if (u.hostname !== location.hostname || !/\/property\//.test(u.pathname)) return;
        const key = (u.pathname.match(/aotf~[^/]+/i) || [u.pathname])[0];
        if (!out.has(key)) out.set(key, withAuth(u.href));
      } catch (_) { /* bad href */ }
    });
    const html = document.documentElement.innerHTML;
    for (const m of html.matchAll(/aotf(?:~|%7E)(\d{5,})(?:~|%7E)([A-Za-z0-9]+)/gi)) {
      const key = `aotf~${m[1]}~${m[2]}`;
      if (!out.has(key)) out.set(key, propertyUrl(m[1], m[2]));
    }
    netUrls().forEach(u => {
      const key = (new URL(u).pathname.match(/aotf~[^/]+/i) || [u])[0];
      if (!out.has(key)) out.set(key, u);
    });
    return Array.from(out.values());
  }

  // Listing cards: the outermost element holding exactly one rent and a bed count.
  function findCards() {
    const priceRe = /\$\s?\d[\d,]{2,}/g;
    const bedRe = /\b\d+\s*(bd|bds|beds?|br|bedrooms?)\b|\bstudio\b/i;
    const cands = [];
    document.querySelectorAll('a, div, li, article, section, mat-card, [class*="card"]').forEach(el => {
      if (el.closest('#sor-scrape-fab')) return;
      const t = el.innerText || '';
      if (t.length < 15 || t.length > 900 || !bedRe.test(t)) return;
      if ((t.match(priceRe) || []).length !== 1) return;
      cands.push(el);
    });
    return cands.filter(el => !cands.some(o => o !== el && o.contains(el)));
  }

  function scrollEverything() {
    window.scrollTo(0, document.documentElement.scrollHeight);
    document.querySelectorAll('div, section, ul, main, mat-sidenav-content, cdk-virtual-scroll-viewport').forEach(el => {
      if (el.scrollHeight > el.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight;
    });
  }

  function clickLoadMore() {
    const btn = Array.from(document.querySelectorAll('button, a')).find(b =>
      /^(load|show|view|see) more( (results|homes|properties|listings))?$/i.test((b.textContent || '').trim()) && b.offsetParent !== null && !b.disabled);
    if (btn) { btn.click(); return true; }
    const next = Array.from(document.querySelectorAll('[aria-label*="next page" i], [class*="pagin"] button, [class*="pagin"] a'))
      .find(b => /next/i.test(b.getAttribute('aria-label') || b.textContent || '') && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && b.offsetParent !== null);
    if (next) { next.click(); return true; }
    return false;
  }

  async function waitFor(fn, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (fn()) return true; await sleep(250); }
    return false;
  }

  // Last resort when cards aren't links: click each card, note the property URL, go back.
  async function clickThroughCards(deadline) {
    const urls = [];
    const total = findCards().length;
    for (let i = 0; i < total && Date.now() < deadline; i++) {
      const cards = findCards();
      const card = cards[i];
      if (!card) break;
      const target = card.querySelector('a[href], img, h2, h3, [class*="address" i]') || card;
      target.scrollIntoView({ block: 'center' });
      target.click();
      if (await waitFor(isPropertyPage, 8000)) {
        urls.push(withAuth(location.href));
        history.back();
        await waitFor(() => !isPropertyPage() && findCards().length > i, 12000);
        await sleep(500);
      }
    }
    return Array.from(new Set(urls));
  }

  // OneHome's map view can have the property list closed ("Toggle properties list").
  const LIST_TOGGLES = ['[data-qa="show-or-hide-properties"]', '[aria-label*="properties list" i]', '[data-qa*="list-view" i]',
    'button[aria-label*="list view" i]', '[data-qa="toggle-list"]'];
  async function revealList() {
    const found = () => harvestPropertyUrls().length || findCards().length;
    if (found()) return true;
    for (const sel of LIST_TOGGLES) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const target = el.matches('button, a, [role="button"]') ? el : (el.querySelector('button, a, [role="button"]') || el);
      for (let i = 0; i < 2; i++) {
        target.click();
        if (await waitFor(found, 6000)) return true;
      }
    }
    return false;
  }

  async function collectListPage(deadline) {
    let last = -1;
    let stable = 0;
    for (let round = 0; round < 60 && Date.now() < deadline; round++) {
      await refreshNet();
      if (round === 0 || (last <= 0 && (round === 3 || round === 8))) await revealList();
      const n = harvestPropertyUrls().length + findCards().length * 1000;
      // List never appeared but the data feed has the properties: stop waiting.
      if (n === 0 && round >= 8 && guessedNetUrls().length) break;
      if (n === last && n > 0) stable++; else { stable = 0; last = n; }
      if (stable >= 3) break;
      scrollEverything();
      clickLoadMore();
      await sleep(1200);
    }
    await refreshNet();
    let urls = harvestPropertyUrls();
    if (!urls.length && findCards().length) urls = await clickThroughCards(deadline);
    if (!urls.length) urls = guessedNetUrls();
    return urls;
  }

  function diagnostics() {
    const cards = findCards();
    return {
      url: location.origin + location.pathname,
      title: document.title,
      links: document.querySelectorAll('a').length,
      propertyLinks: document.querySelectorAll('a[href*="/property/"]').length,
      aotfIdsInPage: (document.documentElement.innerHTML.match(/aotf(?:~|%7E)\d{5,}/gi) || []).length,
      cardsFound: cards.length,
      dataQa: Array.from(new Set(Array.from(document.querySelectorAll('[data-qa]')).map(e => e.getAttribute('data-qa')))).slice(0, 80),
      firstCard: (cards[0] ? cards[0].outerHTML : '').replace(/token=[^"&\s]+/g, 'token=…').slice(0, 4000),
      pageText: (document.body.innerText || '').slice(0, 800),
      visibility: document.visibilityState,
      queryKeys: Array.from(new URLSearchParams(location.search).keys()),
      osn: pageOsn(),
      buttons: Array.from(document.querySelectorAll('button, [role="button"], a')).filter(b => b.offsetParent !== null)
        .map(b => (b.getAttribute('aria-label') || b.getAttribute('data-qa') || b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50))
        .filter(Boolean).slice(0, 60),
      net: { aotfIds: net.aotf.length, listingLikeObjects: net.generic.length, sampleGeneric: net.generic.slice(0, 5), responses: net.samples },
    };
  }

  // Import: wait for OneHome's app to render, then hand back the data.
  async function extractForImport() {
    const started = Date.now();
    const fail = (error) => ({ success: false, error, debug: diagnostics(), retryVisible: document.visibilityState === 'hidden' });
    // Property page, or a share/search/map page that lists several properties?
    while (Date.now() - started < 45000) {
      if (isPropertyPage()) {
        if (document.querySelector('.mls, [data-qa="house-price"]')) {
          await sleep(1200); // let the photo carousel and feature sections finish rendering
          await expandDescription();
          const listing = extractListingData();
          if (!listing.mlsNumber) return fail('Could not find the MLS number on this page.');
          listing.sourceUrl = location.href;
          return { success: true, kind: 'property', listing, photos: extractPhotoUrls() };
        }
      } else if (!/\/share\//.test(location.pathname) && (Date.now() - started > 6000 || harvestPropertyUrls().length || findCards().length)) {
        break;
      }
      await sleep(1000);
    }
    if (isPropertyPage()) return fail('The OneHome property page never finished loading.');
    if (/\/share\//.test(location.pathname)) return fail('The OneHome share link didn’t open a property list (expired or needs sign-in?).');

    await refreshNet();
    const links = await collectListPage(started + 6 * 60000);
    if (links.length) return { success: true, kind: 'list', links };
    await refreshNet();
    if (/sign in|log in|create (an )?account/i.test((document.body.innerText || '').slice(0, 400)) && !findCards().length) {
      return fail('OneHome is asking to sign in. Open the link once in Chrome, then import again.');
    }
    return fail('Opened the OneHome page but couldn’t find the properties. Use “Copy debug info” and send it over.');
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'EXTRACT_FOR_IMPORT') {
      extractForImport().then(sendResponse, (e) => sendResponse({ success: false, error: e.message }));
      return true;
    }
    if (msg.action === 'GET_LISTING_PREVIEW') {
      try {
        const d = extractListingData();
        sendResponse({
          success: true,
          preview: {
            mlsNumber: d.mlsNumber || '', address: d.fullAddress || 'Unknown address', price: d.price || '',
            beds: d.bedrooms || '?', baths: d.bathrooms || '?', sqft: d.sqft || '', photoCount: extractPhotoUrls().length,
          },
        });
      } catch (err) { sendResponse({ success: false, error: err.message }); }
      return true;
    }
    if (msg.action === 'TRIGGER_SCRAPE') { handleScrape(); sendResponse({ success: true }); return true; }
    return false;
  });

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // OneHome is a single-page app: watch for navigation between properties.
  let lastPath = '';
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      if (!isPropertyPage()) document.getElementById('sor-scrape-fab')?.remove();
    }
    if (isPropertyPage() && document.querySelector('.mls, [data-qa="house-price"]')) injectFloatingButton();
  }, 1000);
})();
