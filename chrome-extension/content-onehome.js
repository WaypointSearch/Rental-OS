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
    const addr = data.fullAddress.match(/^(.+?),\s*([^,]+?),\s*([A-Z]{2})\s*(\d{5})(?:-\d{4})?\s*$/) ||
      data.fullAddress.match(/^(.+?),?\s+([A-Za-z.\s'-]+),\s*([A-Z]{2})\s+(\d{5})/);
    if (addr) {
      data.streetAddress = addr[1].trim();
      data.city = addr[2].trim();
      data.state = addr[3].trim();
      data.zip = addr[4].trim();
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

  // Search results / collections / saved-search pages: every link to a property detail page.
  function collectPropertyLinks() {
    const out = new Set();
    document.querySelectorAll('a[href*="/property/"]').forEach(a => {
      try {
        const u = new URL(a.getAttribute('href'), location.href);
        if (u.hostname === location.hostname && /\/property\//.test(u.pathname)) out.add(u.href);
      } catch (_) { /* bad href */ }
    });
    return Array.from(out);
  }

  // Background import: wait for OneHome's app to render, then hand back the data.
  async function extractForImport() {
    const deadline = Date.now() + 45000;
    let lastLinkCount = -1;
    while (Date.now() < deadline) {
      if (isPropertyPage() && document.querySelector('.mls, [data-qa="house-price"]')) {
        await sleep(1200); // let the photo carousel and feature sections finish rendering
        await expandDescription();
        const listing = extractListingData();
        if (!listing.mlsNumber) return { success: false, error: 'Could not find the MLS number on this page.' };
        listing.sourceUrl = location.href;
        return { success: true, kind: 'property', listing, photos: extractPhotoUrls() };
      }
      if (!isPropertyPage()) {
        const links = collectPropertyLinks();
        // Wait until the result list stops growing before returning it.
        if (links.length && links.length === lastLinkCount) return { success: true, kind: 'list', links };
        lastLinkCount = links.length;
      }
      await sleep(1500);
    }
    if (/sign in|log in/i.test(document.body.innerText.slice(0, 3000))) {
      return { success: false, error: 'OneHome is asking to sign in. Open the link once in Chrome, then import again.' };
    }
    return { success: false, error: 'Timed out waiting for the OneHome page to load.' };
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
