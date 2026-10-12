// Sun Ocean Realty — OneHome data-feed reader (runs in the page's own JS world at document_start).
// OneHome's map/list views load properties from its API. This watches those JSON responses for
// property ids so a share/search link can be imported even when the list isn't on screen.
// It only reads responses; nothing is sent anywhere. The content script asks for the results
// with window.postMessage({ __sorNetReq: 1 }).
(function () {
  'use strict';
  if (window.__sorNet) return;
  window.__sorNet = true;

  const AOTF_RE = /aotf~\d{5,}~[A-Za-z0-9]+/gi;
  const aotf = new Set();
  const generic = new Map();   // "id|osn" → { id, osn }
  const samples = [];

  function looksJson(text) {
    const t = text.trimStart();
    return t[0] === '{' || t[0] === '[';
  }

  // Objects that look like a listing: an id, a price/rent and an address-ish field.
  function walk(node, depth) {
    if (!node || typeof node !== 'object' || depth > 9) return;
    if (Array.isArray(node)) { for (let i = 0; i < node.length && i < 3000; i++) walk(node[i], depth + 1); return; }
    const keys = Object.keys(node);
    const idKey = keys.find(k => /^(id|listingid|listingkey|listingkeynumeric|propertyid|aotfid|listing_id|listingId)$/i.test(k));
    const priceKey = keys.find(k => /price|rent/i.test(k) && Number(node[k]) >= 300);
    const addrKey = keys.find(k => /address|street|city|unparsed/i.test(k));
    if (idKey && priceKey && addrKey && (typeof node[idKey] === 'string' || typeof node[idKey] === 'number')) {
      const osnKey = keys.find(k => /^(osn|originatingsystemname|mlssource|sourcesystemname|mlsid|mls)$/i.test(k));
      const id = String(node[idKey]);
      const osn = osnKey && typeof node[osnKey] === 'string' ? node[osnKey] : '';
      generic.set(`${id}|${osn}`, { id, osn });
    }
    for (const k of keys) walk(node[k], depth + 1);
  }

  function scan(url, text) {
    if (typeof text !== 'string' || text.length < 20) return;
    const found = text.match(AOTF_RE);
    if (found) found.forEach(x => aotf.add(x));
    if (!looksJson(text)) return;
    try { walk(JSON.parse(text), 0); } catch (_) { /* not JSON after all */ }
    if (text.length > 300) {
      samples.push({
        url: String(url || '').split('?')[0].slice(0, 200),
        size: text.length,
        head: text.slice(0, 1500).replace(/("?(token|access_token|authorization|email|phone)"?\s*:\s*")[^"]*/gi, '$1…'),
      });
      samples.sort((a, b) => b.size - a.size);
      samples.length = Math.min(samples.length, 6);
    }
  }

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function () {
      const args = arguments;
      return origFetch.apply(this, args).then((res) => {
        try {
          const ct = (res.headers && res.headers.get('content-type')) || '';
          if (/json|text/i.test(ct)) {
            const url = args[0] && typeof args[0] === 'object' ? args[0].url : args[0];
            res.clone().text().then(t => scan(url, t)).catch(() => {});
          }
        } catch (_) { /* never break the page */ }
        return res;
      });
    };
  }

  const XHR = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
  if (XHR) {
    const origOpen = XHR.open;
    const origSend = XHR.send;
    XHR.open = function (method, url) { this.__sorUrl = url; return origOpen.apply(this, arguments); };
    XHR.send = function () {
      this.addEventListener('load', function () {
        try {
          if (this.responseType === '' || this.responseType === 'text') scan(this.__sorUrl, this.responseText);
          else if (this.responseType === 'json' && this.response) scan(this.__sorUrl, JSON.stringify(this.response));
        } catch (_) { /* ignore */ }
      });
      return origSend.apply(this, arguments);
    };
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__sorNetReq !== 1) return;
    window.postMessage({
      __sorNetRes: 1,
      aotf: Array.from(aotf),
      generic: Array.from(generic.values()).slice(0, 2000),
      samples,
    }, '*');
  });
})();
