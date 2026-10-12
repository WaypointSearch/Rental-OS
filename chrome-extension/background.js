// Sun Ocean Realty — Background service worker v4
// Photo downloads, listing storage, OpenAI rewrites and Craigslist widget refresh.
'use strict';

importScripts('lib/ad-engine.js', 'lib/store.js');

const OPENAI_BASE = 'https://api.openai.com/v1';

let keepAliveTimer = null;
function startKeepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => { chrome.storage.local.get('_ka', () => {}); }, 15000);
}
function stopKeepAlive() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
}

const HANDLERS = {
  SCRAPE_LISTING(msg) {
    startKeepAlive();
    handleScrape(msg.listing, msg.photos || []).finally(stopKeepAlive);
    return { started: true };
  },
  async IMPORT_LINKS(msg) { return queueImports(msg.text || ''); },
  async CLEAR_IMPORTS() {
    const q = await getImportQueue();
    await chrome.storage.local.set({ _importQueue: q.filter(x => x.status === 'queued' || x.status === 'working') });
    return {};
  },
  async GET_ALL_LISTINGS() { return { listings: await SOR.store.getAllListings() }; },
  async GET_LISTING(msg) { return { listing: await SOR.store.getListing(msg.mlsNumber) }; },
  async GET_PHOTOS(msg) { return { photos: await SOR.store.getPhotos(msg.mlsNumber) }; },
  async DELETE_LISTING(msg) { await SOR.store.deleteListing(msg.mlsNumber); return {}; },
  async CLEAR_ALL_LISTINGS() { await SOR.store.clearListings(); return {}; },
  async AI_REWRITE(msg) {
    const listing = msg.listing || await SOR.store.getListing(msg.mlsNumber);
    if (!listing) throw new Error('Listing not found');
    const ad = await aiRewrite(listing);
    if (msg.save !== false && listing.mlsNumber && !msg.listing) {
      const fresh = await SOR.store.getListing(listing.mlsNumber);
      if (fresh) { fresh.ad = ad; await SOR.store.saveListing(fresh); }
    }
    return { ad };
  },
  async AI_TEST(msg) { return testOpenAI(msg.apiKey); },
  async OPEN_EDITOR(msg) {
    const url = chrome.runtime.getURL('editor.html') + (msg.mlsNumber ? `?mls=${encodeURIComponent(msg.mlsNumber)}` : '?new=1');
    await chrome.tabs.create({ url });
    return {};
  },
  async OPEN_OPTIONS() { await chrome.runtime.openOptionsPage(); return {}; },
  // Lets the assistant delete carried-over photos without a page "are you sure?" dialog blocking it.
  async CL_AUTO_CONFIRM(msg, sender) {
    if (!sender.tab || !sender.tab.id) return {};
    await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id }, world: 'MAIN',
      func: () => { window.confirm = () => true; },
    });
    return {};
  },
  // jQuery UI widgets on Craigslist live in the page's own JS world; the content script
  // can't reach them, so refresh them from the MAIN world after a fill.
  async CL_REFRESH_WIDGETS(msg, sender) {
    if (!sender.tab || !sender.tab.id) return { refreshed: false };
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, frameIds: sender.frameId ? [sender.frameId] : undefined },
      world: 'MAIN',
      func: () => {
        const $ = window.jQuery;
        if (!$) return 'no-jquery';
        let n = 0;
        $('select').each(function () {
          try { if ($(this).selectmenu && $(this).selectmenu('instance')) { $(this).selectmenu('refresh'); n++; } } catch (e) { /* not a widget */ }
        });
        $('input[type=checkbox], input[type=radio]').each(function () {
          try { if ($(this).checkboxradio && $(this).checkboxradio('instance')) { $(this).checkboxradio('refresh'); n++; } } catch (e) { /* not a widget */ }
        });
        return 'refreshed ' + n;
      },
    });
    return { refreshed: true, result: res && res.result };
  },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = HANDLERS[msg && msg.action];
  if (!handler) return false;
  Promise.resolve()
    .then(() => handler(msg, sender))
    .then(
      (r) => sendResponse(Object.assign({ success: true }, r)),
      (e) => sendResponse({ success: false, error: (e && e.message) || String(e) })
    );
  return true;
});

chrome.runtime.onInstalled.addListener(async (details) => {
  // Persist merged defaults so agents (Eric + Brittini) exist from the start.
  await SOR.store.saveSettings(await SOR.store.loadSettings());
  // v3 stored Facebook flags; drop them.
  const listings = await SOR.store.getAllListings();
  for (const l of listings) {
    if (l.posted && 'facebook' in l.posted) { delete l.posted.facebook; await SOR.store.saveListing(l); }
  }
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
  updateBadge();
});

// ── Scrape: fetch photos, write progress to storage ───────────
async function handleScrape(listing, photoUrls) {
  const id = listing.mlsNumber;
  const urls = photoUrls.slice(0, 50);
  await chrome.storage.local.set({ _scrapeProgress: { mls: id, status: 'downloading', current: 0, total: urls.length } });

  const photos = [];
  for (let i = 0; i < urls.length; i++) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await fetchPhotoAsDataUrl(urls[i]);
        if (data) { photos.push(data); break; }
      } catch (err) {
        console.warn(`[SOR] Photo ${i + 1} attempt ${attempt + 1} failed:`, err.message);
        if (attempt === 0) await sleep(500);
      }
    }
    await chrome.storage.local.set({ _scrapeProgress: { mls: id, status: 'downloading', current: i + 1, total: urls.length } });
    if (i < urls.length - 1) await sleep(100);
  }

  // Re-scrapes keep the agent's work: overrides, CL history, and a hand-edited/AI ad
  // as long as the rent didn't change.
  const prev = await SOR.store.getListing(id);
  listing.source = listing.source || 'mls';
  listing.scrapedAt = new Date().toISOString();
  listing.posted = (prev && prev.posted) || { craigslist: false };
  if (prev && prev.overrides) listing.overrides = prev.overrides;
  if (prev && prev.ad && (prev.ad.edited || prev.ad.source === 'ai') && prev.price === listing.price) listing.ad = prev.ad;
  listing.photoCount = 0;
  await SOR.store.saveListing(listing, { toFront: true });
  if (photos.length || !prev) await SOR.store.setPhotos(id, photos);
  else await SOR.store.saveListing(Object.assign(listing, { photoCount: prev.photoCount || 0 }));

  const saved = await SOR.store.getListing(id);
  await chrome.storage.local.set({
    _scrapeProgress: { mls: id, status: 'done', current: saved.photoCount || 0, total: urls.length },
    _activeMLS: id,
  });
}

async function fetchPhotoAsDataUrl(url) {
  const response = await fetch(url, {
    headers: { Accept: 'image/webp,image/apng,image/*,*/*;q=0.8', 'Cache-Control': 'no-cache' },
    mode: 'cors',
    credentials: 'omit',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  // FileReader is not available in MV3 service workers — build base64 manually.
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 100) throw new Error(`Tiny image (${bytes.byteLength} bytes)`);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  const type = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return `data:${type};base64,${btoa(binary)}`;
}

// ── Import from pasted OneHome links ───────────────────────────
// Each link opens in a background tab; the OneHome content script reads the rendered page
// (property → data + photo URLs, search/collection page → property links) and the tab closes.
const IMPORT_TIMEOUT = 60000;
let importRunning = false;

function parseOneHomeLinks(text) {
  const found = String(text).match(/(?:https?:\/\/)?portal\.onehome\.com\/[^\s"'<>]+/gi) || [];
  return Array.from(new Set(found.map(u => u.replace(/^(?:https?:\/\/)?/i, 'https://').replace(/[).,;]+$/, ''))));
}

async function getImportQueue() {
  const r = await chrome.storage.local.get('_importQueue');
  return Array.isArray(r._importQueue) ? r._importQueue : [];
}

async function updateImport(id, patch) {
  const q = await getImportQueue();
  const item = q.find(x => x.id === id);
  if (item) Object.assign(item, patch);
  await chrome.storage.local.set({ _importQueue: q });
}

async function queueImports(text, parentLabel) {
  const urls = parseOneHomeLinks(text);
  if (!urls.length) throw new Error('No OneHome links found. Copy the address from the OneHome page (portal.onehome.com/…).');
  const q = await getImportQueue();
  const pending = new Set(q.filter(x => x.status === 'queued' || x.status === 'working').map(x => x.url));
  const add = urls.filter(u => !pending.has(u)).map((url, i) => ({
    id: Date.now().toString(36) + i + Math.random().toString(36).slice(2, 6),
    url, status: 'queued', label: parentLabel || '', msg: '', at: new Date().toISOString(),
  }));
  // Keep the 30 most recent finished rows for the progress list.
  const finished = q.filter(x => x.status === 'done' || x.status === 'error').slice(-30);
  const active = q.filter(x => x.status === 'queued' || x.status === 'working');
  await chrome.storage.local.set({ _importQueue: finished.concat(active, add) });
  runImportQueue();
  return { added: add.length };
}

async function runImportQueue() {
  if (importRunning) return;
  importRunning = true;
  startKeepAlive();
  try {
    for (;;) {
      const next = (await getImportQueue()).find(x => x.status === 'queued');
      if (!next) break;
      await updateImport(next.id, { status: 'working', msg: 'Opening OneHome…' });
      try {
        await importOne(next);
      } catch (e) {
        await updateImport(next.id, { status: 'error', msg: e.message || String(e) });
      }
    }
  } finally {
    importRunning = false;
    await closeImportWindow();
    stopKeepAlive();
  }
}

// Imports run in ONE small, visible OneHome window. Chrome barely renders hidden background tabs,
// and OneHome's property list/photo carousel don't appear there, so the window must stay visible.
let importWin = null; // { windowId, tabId }

async function openInImportWindow(url) {
  if (importWin) {
    try {
      const nav = waitForNavigation(importWin.tabId, IMPORT_TIMEOUT);
      await chrome.tabs.update(importWin.tabId, { url });
      await nav;
      return importWin.tabId;
    } catch (e) {
      if (!/closed|No tab/i.test(e.message)) throw e;
      importWin = null; // user closed it — open a fresh one
    }
  }
  const w = await createImportWindow();
  importWin = { windowId: w.id, tabId: w.tabs[0].id };
  const nav = waitForNavigation(importWin.tabId, IMPORT_TIMEOUT);
  await chrome.tabs.update(importWin.tabId, { url });
  await nav;
  return importWin.tabId;
}

// Size the window from the browser window the user is in, so it always fits their screen.
async function createImportWindow() {
  const opts = { url: 'about:blank', type: 'popup', focused: true };
  try {
    const cur = await chrome.windows.getLastFocused();
    if (cur && cur.width && cur.height) {
      Object.assign(opts, {
        width: Math.max(600, Math.min(1180, cur.width - 40)),
        height: Math.max(500, Math.min(860, cur.height - 40)),
        left: (cur.left || 0) + 20,
        top: (cur.top || 0) + 20,
      });
    }
    return await chrome.windows.create(opts);
  } catch (_) {
    return chrome.windows.create({ url: 'about:blank', type: 'popup', focused: true });
  }
}

async function closeImportWindow() {
  if (!importWin) return;
  const id = importWin.windowId;
  importWin = null;
  await chrome.windows.remove(id).catch(() => {});
}

async function importOne(item) {
  const tabId = await openInImportWindow(item.url);
  await updateImport(item.id, { msg: 'Reading OneHome page…' });
  let res = await sendToTab(tabId, { action: 'EXTRACT_FOR_IMPORT' }, IMPORT_TIMEOUT);
  if (res && !res.success && res.retryVisible && importWin) {
    // Page didn't render (window hidden behind others?) — bring it forward and try once more.
    await chrome.windows.update(importWin.windowId, { focused: true, state: 'normal' }).catch(() => {});
    await sleep(1500);
    res = await sendToTab(tabId, { action: 'EXTRACT_FOR_IMPORT' }, IMPORT_TIMEOUT);
  }
  if (!res || !res.success) {
    if (res && res.debug) await updateImport(item.id, { debug: JSON.stringify(res.debug, null, 2) });
    throw new Error((res && res.error) || 'Could not read this OneHome page.');
  }
  if (res.kind === 'list') {
    if (!res.links.length) throw new Error('No properties found on this OneHome page.');
    await updateImport(item.id, { status: 'done', msg: `Found ${res.links.length} properties — importing each` });
    await queueImports(res.links.join('\n'), 'from share link');
    return;
  }
  const listing = res.listing;
  if (!listing.sourceUrl || !/token=/.test(listing.sourceUrl)) listing.sourceUrl = item.url;
  await updateImport(item.id, { msg: `Saving ${res.photos.length} photos…`, mls: listing.mlsNumber });
  await handleScrape(listing, res.photos);
  const saved = await SOR.store.getListing(listing.mlsNumber);
  const settings = await SOR.store.loadSettings();
  if (settings.autoQueue && saved && SOR.isPostable(saved)) await SOR.store.appendToQueue([saved.mlsNumber]);
  await updateImport(item.id, {
    status: 'done', mls: listing.mlsNumber,
    label: SOR.listingLabel(saved || listing), msg: `${(saved && saved.photoCount) || 0} photos`,
  });
}

// Resolves once the tab has started AND finished loading a new document (avoids reading the
// previous page while the next one is still on its way).
function waitForNavigation(tabId, timeout) {
  return new Promise((resolve, reject) => {
    let sawLoading = false;
    const timer = setTimeout(() => { cleanup(); reject(new Error('OneHome took too long to load.')); }, timeout);
    const onUpdated = (id, info) => {
      if (id !== tabId) return;
      if (info.status === 'loading') sawLoading = true;
      if (info.status === 'complete' && sawLoading) { cleanup(); resolve(); }
    };
    const onRemoved = (id) => { if (id === tabId) { cleanup(); reject(new Error('The OneHome import window was closed.')); } };
    function cleanup() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
  });
}

// The content script may not be injected the instant the tab finishes loading — retry.
// A search/share page can take minutes (it clicks through every property), so the reply
// itself gets a generous cap.
async function sendToTab(tabId, msg, timeout) {
  const deadline = Date.now() + timeout;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      return await Promise.race([
        chrome.tabs.sendMessage(tabId, msg),
        sleep(8 * 60000).then(() => { throw new Error('Timed out reading the OneHome page.'); }),
      ]);
    } catch (e) {
      if (/Timed out/.test(e.message)) throw e;
      lastErr = e;
      await sleep(1000);
    }
  }
  throw new Error(lastErr && /Receiving end/.test(lastErr.message)
    ? 'OneHome page did not respond. If it asks you to sign in, open the link once, then import again.'
    : 'Timed out reading the OneHome page.');
}

// A worker restart mid-import leaves rows stuck on "working": requeue and resume.
(async () => {
  const q = await getImportQueue();
  if (!q.some(x => x.status === 'working' || x.status === 'queued')) return;
  q.forEach(x => { if (x.status === 'working') { x.status = 'queued'; x.msg = ''; } });
  await chrome.storage.local.set({ _importQueue: q });
  runImportQueue();
})();

// Keyboard shortcut (Alt+Shift+N by default): run the Craigslist "Next step" in the active tab.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'next-step') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { action: 'CL_NEXT' }).catch(() => {});
});

// ── OpenAI ─────────────────────────────────────────────────────
async function openaiRequest(path, apiKey, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(OPENAI_BASE + path, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign({ Authorization: `Bearer ${apiKey}` }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* non-JSON error page */ }
    if (!res.ok) {
      const err = new Error((json && json.error && json.error.message) || `OpenAI error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('OpenAI took too long to respond. Try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function aiRewrite(listing) {
  const settings = await SOR.store.loadSettings();
  const apiKey = await SOR.store.getApiKey();
  if (!apiKey) throw new Error('Add your OpenAI API key in Settings first.');
  const model = (settings.ai && settings.ai.model) || 'gpt-5-nano';
  const body = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SOR.aiPrompt(settings.titleStyle) },
      { role: 'user', content: 'Listing facts (JSON):\n' + JSON.stringify(SOR.aiFacts(listing, settings), null, 2) },
    ],
  };
  // Reasoning models (gpt-5*, o*) are faster/cheaper with low effort; others reject the field.
  if (/^(gpt-5|o\d)/i.test(model)) body.reasoning_effort = 'low';

  let json;
  try {
    json = await openaiRequest('/chat/completions', apiKey, body);
  } catch (e) {
    if (e.status === 400 && body.reasoning_effort && /reasoning/i.test(e.message)) {
      delete body.reasoning_effort;
      json = await openaiRequest('/chat/completions', apiKey, body);
    } else {
      throw e;
    }
  }
  const content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  let parsed;
  try { parsed = JSON.parse(content || ''); } catch (_) { throw new Error('The AI response was not valid JSON. Try again.'); }
  return SOR.normalizeAiAd(parsed, listing, settings);
}

async function testOpenAI(keyOverride) {
  const apiKey = String(keyOverride || await SOR.store.getApiKey() || '').trim();
  if (!apiKey) throw new Error('Enter an API key first.');
  const json = await openaiRequest('/models', apiKey);
  const models = ((json && json.data) || [])
    .filter(m => /^(gpt-|o\d|chatgpt)/i.test(m.id) && !/(audio|realtime|tts|transcribe|image|search|embedding|moderation|instruct|codex|vision|preview-\d{4})/i.test(m.id))
    .sort((a, b) => (b.created || 0) - (a.created || 0));
  const ids = models.map(m => m.id);
  const suggested = ids.find(id => /nano/i.test(id)) || ids.find(id => /mini/i.test(id)) || ids[0] || '';
  return { models: ids, suggested };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function updateBadge() {
  chrome.storage.local.get('listing_index', (r) => {
    const count = (r.listing_index || []).length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#0a3d5c' });
  });
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.listing_index) updateBadge();
});
updateBadge();
