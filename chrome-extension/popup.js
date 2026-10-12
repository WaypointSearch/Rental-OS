// Sun Ocean Realty — popup v4
'use strict';

const $ = (sel) => document.querySelector(sel);
let settings = null;
let tab = null;
let activeMLS = '';
let picks = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  settings = await SOR.store.loadSettings();
  const st = await chrome.storage.local.get(['_activeMLS', '_picks']);
  activeMLS = st._activeMLS || '';
  picks = Array.isArray(st._picks) ? st._picks : [];
  $('#version').textContent = 'v' + chrome.runtime.getManifest().version;
  renderAgents();
  await renderContext();
  await renderListings();
  await renderImports();
  await renderQueue();

  $('#agent-select').addEventListener('change', async (e) => {
    settings = await SOR.store.setActiveAgent(e.target.value);
    toast(`Posting as ${SOR.getAgent(settings).name}`);
  });
  $('#btn-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('#btn-new').addEventListener('click', () => openEditor());
  $('#btn-clear').addEventListener('click', clearAll);
  $('#btn-import').addEventListener('click', importLinks);
  $('#import-links').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) importLinks(); });
  $('#btn-clear-imports').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'CLEAR_IMPORTS' }));
  $('#btn-post').addEventListener('click', postSelected);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes._importQueue) renderImports();
    if (changes._postQueue || changes.listing_index || Object.keys(changes).some(k => k.startsWith('listing_'))) { renderListings(); renderQueue(); }
  });
}

// ── Import from pasted links ─────────────────────────────────
async function importLinks() {
  const text = $('#import-links').value.trim();
  if (!text) { toast('Paste a OneHome link first'); return; }
  const btn = $('#btn-import');
  btn.disabled = true;
  try {
    const res = await chrome.runtime.sendMessage({ action: 'IMPORT_LINKS', text });
    if (!res || !res.success) throw new Error((res && res.error) || 'Import failed');
    $('#import-links').value = '';
    toast(res.added ? `Importing ${res.added} link${res.added === 1 ? '' : 's'}… you can close this` : 'Already importing those');
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
}

async function renderImports() {
  const { _importQueue: q = [] } = await chrome.storage.local.get('_importQueue');
  const rows = q.slice(-12).reverse();
  const icon = { queued: '…', working: '↻', done: '✓', error: '!' };
  $('#imports').innerHTML = rows.map(x => {
    let short = x.label || '';
    if (!short) { try { short = decodeURIComponent(new URL(x.url).pathname.split('/').pop()).replace(/^aotf~/, ''); } catch (_) { short = x.url; } }
    return `<div class="imp ${esc(x.status)}"><span class="i">${icon[x.status] || '·'}</span><span class="u" title="${esc(x.url)}">${esc(short)}</span>${x.msg ? `<span class="m">${esc(x.msg)}</span>` : ''}${x.debug ? `<button class="linkbtn dbg" type="button" data-debug="${esc(x.id)}">Copy debug info</button>` : ''}</div>`;
  }).join('');
  $('#imports').querySelectorAll('[data-debug]').forEach(b => b.addEventListener('click', async () => {
    const item = q.find(x => x.id === b.dataset.debug);
    await navigator.clipboard.writeText(item ? item.debug : '');
    toast('Debug info copied — paste it to your developer');
  }));
  $('#btn-clear-imports').classList.toggle('hidden', !q.some(x => x.status === 'done' || x.status === 'error'));
}

// Ticked listings become the posting queue (in list order) and Craigslist opens.
async function postSelected() {
  const order = (await SOR.store.getAllListings()).map(l => l.mlsNumber).filter(id => picks.includes(id));
  if (!order.length) return;
  await SOR.store.setQueue(order);
  await chrome.storage.local.set({ _activeMLS: order[0], _picks: [] });
  chrome.tabs.create({ url: SOR.CL_POST_URL });
  window.close();
}

function renderPostButton(listings) {
  picks = picks.filter(id => listings.some(l => l.mlsNumber === id));
  const btn = $('#btn-post');
  btn.disabled = !picks.length;
  btn.textContent = picks.length ? `Queue ${picks.length} & start posting →` : 'Tick listings to queue them for Craigslist';
}

// ── Posting queue summary ────────────────────────────────────
async function renderQueue() {
  const listings = await SOR.store.getAllListings();
  const box = $('#queue');
  if (!listings.length) { box.innerHTML = ''; return; }
  const q = await SOR.store.syncQueue(settings, listings);
  const ready = q.filter(id => SOR.isPostable(listings.find(l => l.mlsNumber === id)));
  const next = listings.find(l => l.mlsNumber === ready[0]);
  const today = SOR.postsToday(listings);
  const limit = settings.dailyLimit ? ` of ${settings.dailyLimit}` : '';
  const flagged = listings.filter(l => l.needsAttention).length;
  box.innerHTML = `
    <div class="queue-card">
      <div class="row"><span class="big grow">${ready.length ? `${ready.length} listing${ready.length === 1 ? '' : 's'} ready to post` : 'Posting queue is empty'}</span><span class="small muted">${today}${limit} posted today</span></div>
      ${next ? `<div class="small">Next up: <b>${esc(SOR.listingLabel(next))}</b></div>` : '<div class="small muted">Import listings or tick some below to fill the queue.</div>'}
      ${flagged ? `<div class="small" style="color:var(--bad)">⚠ ${flagged} listing${flagged === 1 ? '' : 's'} need${flagged === 1 ? 's' : ''} attention (see below)</div>` : ''}
      <div class="row">
        ${ready.length ? `<a class="btn small primary" href="${SOR.CL_POST_URL}" target="_blank">Open Craigslist ▶</a>` : ''}
        <span class="grow"></span>
        ${q.length ? '<button class="linkbtn danger" type="button" id="btn-clear-queue">Clear queue</button>' : ''}
        ${listings.some(l => SOR.isPostable(l) && !q.includes(l.mlsNumber)) ? '<button class="linkbtn" type="button" id="btn-queue-all">Queue all unposted</button>' : ''}
      </div>
    </div>`;
  const clear = $('#btn-clear-queue');
  if (clear) clear.addEventListener('click', async () => { await SOR.store.setQueue([]); renderQueue(); renderListings(); });
  const all = $('#btn-queue-all');
  if (all) all.addEventListener('click', async () => {
    await SOR.store.appendToQueue(listings.filter(l => SOR.isPostable(l) && !q.includes(l.mlsNumber)).map(l => l.mlsNumber));
    renderQueue(); renderListings();
  });
}

function renderAgents() {
  $('#agent-select').innerHTML = settings.agents.map(a =>
    `<option value="${esc(a.id)}" ${a.id === settings.activeAgentId ? 'selected' : ''}>${esc(a.name)} · ${esc(SOR.formatPhone(a.phone))}</option>`).join('');
}

async function renderContext() {
  const url = (tab && tab.url) || '';
  let host = '';
  try { host = new URL(url).hostname; } catch (_) { /* chrome:// pages */ }
  const ctx = $('#context');

  if (host === 'portal.onehome.com') {
    $('#page-context').textContent = 'OneHome · scrape mode';
    ctx.innerHTML = '<div class="ctx-card"><div class="muted small">Reading this page…</div></div>';
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { action: 'GET_LISTING_PREVIEW' });
      if (!res || !res.success || !res.preview.mlsNumber) throw new Error('no listing');
      const p = res.preview;
      const saved = await SOR.store.getListing(p.mlsNumber);
      ctx.innerHTML = `
        <div class="ctx-card">
          <div class="ctx-row"><span class="ctx-title">MLS# ${esc(p.mlsNumber)} ${saved ? '<span class="badge ok">Saved</span>' : ''}</span><b>${esc(p.price)}</b></div>
          <div class="small">${esc(p.address)}</div>
          <div class="small muted">${esc(p.beds)} bd · ${esc(p.baths)} ba${p.sqft ? ' · ' + esc(p.sqft) : ''} · ${p.photoCount} photos</div>
          <button id="btn-scrape" class="btn primary block" type="button">${saved ? 'Re-scrape listing' : 'Scrape this listing'}</button>
        </div>`;
      $('#btn-scrape').addEventListener('click', async () => {
        $('#btn-scrape').disabled = true;
        $('#btn-scrape').textContent = 'Scraping… (see the page)';
        await chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_SCRAPE' });
        waitForScrape(p.mlsNumber);
      });
    } catch (_) {
      ctx.innerHTML = '<div class="ctx-card"><div class="small muted">Open a OneHome property detail page to scrape it.</div></div>';
    }
    return;
  }

  if (host === 'post.craigslist.org') {
    $('#page-context').textContent = 'Craigslist · posting assistant';
    ctx.innerHTML = `
      <div class="ctx-card">
        <div class="small">The <b>Sun Ocean</b> panel on the page walks you through every step and fills the ad.</div>
        <button id="btn-show-panel" class="btn primary block" type="button">Show the panel</button>
      </div>`;
    $('#btn-show-panel').addEventListener('click', async () => {
      try { await chrome.tabs.sendMessage(tab.id, { action: 'CL_SHOW_PANEL' }); window.close(); }
      catch (_) { toast('Reload the Craigslist page, then try again.'); }
    });
    return;
  }

  $('#page-context').textContent = 'Import → write → post';
  if ((await SOR.store.getAllListings()).length) { ctx.innerHTML = ''; return; }
  ctx.innerHTML = `
    <div class="steps">
      <div class="step"><span class="n">1</span><div><strong>Add listings</strong><span>Paste OneHome links above (or click Scrape on a OneHome page), or add a <button class="linkbtn" id="ctx-new" type="button">by-owner listing</button>.</span></div></div>
      <div class="step"><span class="n">2</span><div><strong>Tick the ones to post</strong><span>Optional: Edit ad to tweak the title or rewrite with AI.</span></div></div>
      <div class="step"><span class="n">3</span><div><strong>Post</strong><span>The Craigslist panel picks each step, fills the ad and adds the right photos.</span></div></div>
    </div>`;
  $('#ctx-new').addEventListener('click', () => openEditor());
}

function waitForScrape(id) {
  const started = Date.now();
  const timer = setInterval(async () => {
    const { _scrapeProgress: p } = await chrome.storage.local.get('_scrapeProgress');
    const btn = $('#btn-scrape');
    if (p && p.mls === id && p.status === 'downloading' && btn) btn.textContent = `Saving photos ${p.current}/${p.total}…`;
    const saved = await SOR.store.getListing(id);
    if ((saved && (!p || p.status === 'done')) || Date.now() - started > 300000) {
      clearInterval(timer);
      activeMLS = id;
      await renderContext();
      await renderListings();
      toast('Listing saved');
    }
  }, 1000);
}

async function renderListings() {
  const listings = await SOR.store.getAllListings();
  const queue = await SOR.store.getQueue();
  $('#listing-count').textContent = listings.length;
  const box = $('#listings');
  renderPostButton(listings);
  if (!listings.length) {
    box.innerHTML = '<div class="empty">No listings yet — paste a OneHome link above.</div>';
    return;
  }
  box.innerHTML = listings.map(l => {
    const ad = SOR.getAd(l, settings);
    const published = l.posted && l.posted.clPublishedAt;
    const by = published && l.posted.clAgentId ? (settings.agents.find(a => a.id === l.posted.clAgentId) || {}).name : '';
    const qPos = queue.indexOf(l.mlsNumber);
    const meta = [
      l.needsAttention ? `<span class="badge warn" title="${esc(l.needsAttention.reason)}">⚠ Needs attention</span>` : '',
      qPos >= 0 ? `<span class="badge q">${qPos === 0 ? 'Next up' : `Queue #${qPos + 1}`}</span>` : '',
      l.source === 'manual' ? '<span class="badge sun">By owner</span>' : `<span>${esc(l.mlsNumber)}</span>`,
      `<span>${esc(SOR.listingLabel(l))}</span>`,
      `<span>${l.photoCount || 0} photos</span>`,
      ad.source === 'ai' ? '<span class="badge ai">AI ad</span>' : ad.edited ? '<span class="badge">Edited</span>' : '',
      published ? `<span class="badge ok" title="${esc(l.posted.clTitle || '')}">Posted ${esc(timeAgo(published))}${by ? ' · ' + esc(by.split(' ')[0]) : ''}</span>` : '',
    ].filter(Boolean).join('');
    return `
      <div class="item ${l.mlsNumber === activeMLS ? 'active' : ''}" data-mls="${esc(l.mlsNumber)}">
        <label class="head"><input type="checkbox" data-pick ${picks.includes(l.mlsNumber) ? 'checked' : ''} title="Post this one"><span class="t" title="${esc(ad.title)}">${esc(ad.title)}</span></label>
        <div class="meta">${meta}</div>
        ${l.needsAttention ? `<div class="small" style="color:var(--bad)">${esc(l.needsAttention.reason)}</div>` : ''}
        <div class="row">
          ${l.needsAttention ? '<button class="btn small" data-act="retry" type="button" title="Clear the flag and put it back in the queue">Retry</button>' : ''}
          <button class="btn small" data-act="edit" type="button">Edit ad</button>
          <button class="btn small" data-act="copy" type="button" title="Copy title + description">Copy</button>
          <span class="grow"></span>
          <button class="x" data-act="delete" type="button" title="Delete listing">×</button>
        </div>
      </div>`;
  }).join('');

  box.querySelectorAll('[data-pick]').forEach(cb => cb.addEventListener('change', () => {
    const id = cb.closest('.item').dataset.mls;
    picks = cb.checked ? picks.concat(id) : picks.filter(x => x !== id);
    chrome.storage.local.set({ _picks: picks });
    renderPostButton(listings);
  }));

  box.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.closest('.item').dataset.mls;
    const act = btn.dataset.act;
    if (act === 'retry') {
      await SOR.store.clearNeedsAttention(id, true);
      await renderListings(); await renderQueue();
    } else if (act === 'edit') {
      openEditor(id);
    } else if (act === 'copy') {
      const l = await SOR.store.getListing(id);
      const ad = SOR.getAd(l, settings);
      await navigator.clipboard.writeText(`${ad.title}\n\n${SOR.composeBody(ad.body, SOR.getAgent(settings), settings)}`);
      toast('Ad copied');
    } else if (act === 'delete') {
      if (!confirm('Delete this listing and its photos?')) return;
      await SOR.store.deleteListing(id);
      await renderListings();
    }
  }));
}

function openEditor(id) {
  const url = chrome.runtime.getURL('editor.html') + (id ? `?mls=${encodeURIComponent(id)}` : '?new=1');
  chrome.tabs.create({ url });
}

async function clearAll() {
  if (!confirm('Delete ALL saved listings and photos? (Agents and settings are kept.)')) return;
  await SOR.store.clearListings();
  activeMLS = '';
  await renderListings();
}

function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function esc(v) {
  return String(v === undefined || v === null ? '' : v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
}
