// Sun Ocean Realty — Craigslist assistant v4
// Walks every post.craigslist.org step: picks "housing offered" → "apartments / housing for rent"
// → county, fills every ad field (with defaults when the listing is silent), reports anything it
// could not fill, injects photos, and checks the preview.
//
// Queue + "Next step": each new posting takes the next listing in the posting queue. The fixed
// NEXT STEP button (or Alt+Shift+N) performs whatever the current page needs, so the whole flow can
// be driven by clicking one spot. It never re-posts a listing inside Craigslist's 48-hour window,
// stops when the queue is finished, and flags (then skips) a listing it can't complete.
(function () {
  'use strict';
  if (window.__sorCL) return;
  window.__sorCL = true;

  const SOR = window.SOR;
  const PANEL_ID = 'sor-cl-panel';
  const state = {
    mode: '', settings: null, listings: [], mls: '', queue: [], nextId: '', postsToday: 0,
    titleIdx: 0, customTitle: null, report: null, status: null, busy: false, collapsed: false,
    photosAdded: false, nextBusy: false, nextNote: '', publishing: false,
  };
  const NEXT_ID = 'sor-next';
  let detectTimer = null;

  boot();

  async function boot() {
    try {
      const r = await chrome.storage.local.get('_panelCollapsed');
      state.collapsed = !!r._panelCollapsed;
      await refreshData();
    } catch (e) { console.warn('[SOR] init failed', e); }
    detect();
    new MutationObserver(scheduleDetect).observe(document.documentElement, { childList: true, subtree: true });
    ['pageshow', 'popstate', 'hashchange'].forEach(ev => window.addEventListener(ev, scheduleDetect));
    chrome.storage.onChanged.addListener(onStorageChanged);
    // Publishing by hand (Craigslist's own button) also counts as posted.
    document.addEventListener('click', (e) => {
      if (state.mode !== 'preview' || state.publishing || !state.mls) return;
      const b = e.target.closest && e.target.closest('button, input[type="submit"]');
      if (b && !b.closest('#' + PANEL_ID) && !b.closest('#' + NEXT_ID) && norm(b.textContent || b.value) === 'publish') {
        state.publishing = true;
        SOR.store.markPublished(state.mls);
      }
    }, true);
  }

  // Each Craigslist posting has its own id in the URL (/k/<key>/<id>). Binding it to a listing the
  // first time the panel sees it keeps the right photos going to the right ad, even with several
  // Craigslist tabs open at once.
  function postingId() {
    const m = location.pathname.match(/\/k\/[^/]+\/([^/?#]+)/);
    return m ? m[1] : '';
  }

  const boundMls = (v) => (v && typeof v === 'object' ? v.mls : v) || '';

  async function bindPosting(mls, force) {
    const pid = postingId();
    if (!pid || !mls) return;
    const { _clPostings: map = {} } = await chrome.storage.local.get('_clPostings');
    const cur = boundMls(map[pid]);
    if (cur === mls || (cur && !force)) return;
    map[pid] = { mls, at: Date.now() };
    const keys = Object.keys(map);
    keys.slice(0, Math.max(0, keys.length - 50)).forEach(k => delete map[k]);
    await chrome.storage.local.set({ _clPostings: map });
  }

  async function refreshData() {
    state.settings = await SOR.store.loadSettings();
    state.queue = await SOR.store.syncQueue(state.settings);
    state.listings = await SOR.store.getAllListings(); // read after the queue so it's never older
    const r = await chrome.storage.local.get(['_activeMLS', '_clPostings']);
    const has = (id) => !!id && state.listings.some(l => l.mlsNumber === id);
    state.nextId = SOR.store.nextPostable(state.queue, state.listings);
    state.postsToday = SOR.postsToday(state.listings);
    const bound = boundMls((r._clPostings || {})[postingId()]);
    if (has(bound)) { state.mls = bound; return; }
    // A new posting takes the next listing in the queue; with no queue, the listing picked last.
    state.mls = state.nextId ||
      (state.queue.length ? '' : has(r._activeMLS) ? r._activeMLS : (state.listings[0] ? state.listings[0].mlsNumber : ''));
    if (state.mls) await bindPosting(state.mls, true);
  }

  function limitReached() {
    const lim = state.settings && state.settings.dailyLimit;
    return lim > 0 && state.postsToday >= lim;
  }

  // Why this listing must not be posted right now ('' = fine).
  function blockReason(l) {
    if (!l) return state.queue.length
      ? 'Every queued listing was posted in the last 48 hours — nothing to post yet.'
      : 'All caught up — nothing left in the posting queue.';
    if (l.needsAttention) return `This listing is flagged: ${l.needsAttention.reason}`;
    if (SOR.isRecentlyPosted(l)) return 'This listing was posted in the last 48 hours (Craigslist allows one post per 48h).';
    return '';
  }

  async function startNextPosting() {
    await refreshData();
    if (limitReached()) return halt(`Daily limit reached (${state.postsToday} posts today). Change it in Settings.`);
    if (!state.nextId) return halt(blockReason(null));
    await chrome.storage.local.set({ _activeMLS: state.nextId });
    setStatus('Starting the next posting…', 'success');
    location.href = SOR.CL_POST_URL;
  }

  async function skipCurrent() {
    if (state.mls) await SOR.store.removeFromQueue(state.mls);
    await startNextPosting();
  }

  // Can't finish this listing unattended: flag it for a person and move on to the next one.
  async function giveUp(reason) {
    if (state.mls) await SOR.store.markNeedsAttention(state.mls, reason);
    halt(`Skipped: ${reason}. Moving to the next listing…`);
    await sleep(1500);
    await startNextPosting();
  }

  function halt(msg) {
    state.nextNote = msg;
    setStatus(msg, 'error');
  }

  function onStorageChanged(changes, area) {
    if (area !== 'local') return;
    const relevant = Object.keys(changes).some(k => k === SOR.SETTINGS_KEY || k === 'listing_index' || k === '_activeMLS' || k === '_postQueue' || k.startsWith('listing_'));
    if (!relevant || state.nextBusy) return;
    refreshData().then(() => {
      const panel = document.getElementById(PANEL_ID);
      if (panel && panel.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
      render();
    });
  }

  function scheduleDetect() {
    clearTimeout(detectTimer);
    detectTimer = setTimeout(detect, 200);
  }

  function detect() {
    if (!document.body) return;
    const mode = getMode();
    if (mode === state.mode && document.getElementById(PANEL_ID)) return;
    if (mode !== state.mode) { state.report = null; state.status = null; state.photosAdded = false; state.nextNote = ''; }
    state.mode = mode;
    render();
    // Landing on the "posted" page without our publish click (e.g. published by hand elsewhere).
    if (mode === 'done' && state.mls) {
      const l = activeListing();
      if (l && !SOR.isRecentlyPosted(l, 0.25)) SOR.store.markPublished(state.mls).then(refreshData).then(render);
    }
  }

  // ════════════════════════════════════════════════════════════
  // Page detection
  // ════════════════════════════════════════════════════════════
  const TITLE_ITEM = { kind: 'text', names: ['PostingTitle', 'posting_title'], labels: ['posting title'] };
  const BODY_ITEM = { kind: 'textarea', names: ['PostingBody', 'posting_body'], labels: ['description', 'posting body'] };

  function step() {
    try { return (new URL(location.href).searchParams.get('s') || '').toLowerCase(); } catch (_) { return ''; }
  }

  function getMode() {
    if (locate(TITLE_ITEM) && locate(BODY_ITEM)) return 'edit';
    const s = step();
    const bodyText = norm(document.body.innerText || '').slice(0, 5000);
    const fileInput = pageFileInput();
    if (s === 'editimage' || (fileInput && /add images|upload images|done with images|images of a maximum|drag and drop images/.test(bodyText))) return 'images';
    if (s === 'geoverify' || (/geoverify/.test(location.href))) return 'map';
    if (s === 'preview' || (/this is an unpublished draft|publish/.test(bodyText) && document.querySelector('.postingtitletext, #titletextonly, .posting-title'))) return 'preview';
    if (/re-?use (selected )?data|from your previous post/.test(bodyText) && reuseButton()) return 'reuse';
    const opts = radioOptions();
    if (opts.length) {
      const all = opts.map(o => o.text).join(' | ');
      if (/housing offered/.test(all)) return 'choose-type';
      if (/apartments \/ housing for rent|apts\/housing for rent|apartments \/ housing/.test(all)) return 'choose-category';
      if (/broward|palm beach|miami \/ dade|miami-dade/.test(all)) return 'choose-area';
      return 'choose-other';
    }
    if (/thanks for posting|your posting can be seen|is now live|posted successfully/.test(bodyText)) return 'done';
    return 'setup';
  }

  // ════════════════════════════════════════════════════════════
  // Panel
  // ════════════════════════════════════════════════════════════
  const MODE_LABEL = {
    reuse: 'Step: re-use data', edit: 'Ad details', images: 'Photos', map: 'Map', preview: 'Preview', done: 'Posted',
    'choose-type': 'Step: type', 'choose-category': 'Step: category', 'choose-area': 'Step: area',
    'choose-other': 'Step: choose', setup: 'Ready',
  };

  function activeListing() { return state.listings.find(l => l.mlsNumber === state.mls) || null; }

  function currentAd() {
    const l = activeListing();
    if (!l) return null;
    const ad = SOR.getAd(l, state.settings);
    const options = ad.titleOptions && ad.titleOptions.length ? ad.titleOptions : [ad.title];
    const title = state.customTitle !== null ? state.customTitle : options[state.titleIdx % options.length];
    return Object.assign({}, ad, { title: SOR.trimTitle(title), titleOptions: options });
  }

  function render() {
    if (!document.body) return;
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      document.body.appendChild(panel);
      panel.addEventListener('click', onPanelClick);
      panel.addEventListener('change', onPanelChange);
      panel.addEventListener('input', onPanelInput);
    }
    panel.classList.toggle('sor-collapsed', state.collapsed);
    renderNextButton();
    if (state.collapsed) {
      panel.innerHTML = `<button type="button" class="sor-fab" data-act="expand" title="Open Sun Ocean assistant">☀</button>`;
      return;
    }
    const s = state.settings || SOR.mergeSettings({});
    const l = activeListing();
    const agentOpts = s.agents.map(a => `<option value="${esc(a.id)}" ${a.id === s.activeAgentId ? 'selected' : ''}>${esc(a.name)} · ${esc(SOR.formatPhone(a.phone))}</option>`).join('');
    const mark = (x) => (x.needsAttention ? ' ⚠' : SOR.isRecentlyPosted(x) ? ' ✓ posted' : '');
    const listingOpts = (state.mls ? '' : '<option value="" selected>— choose a listing —</option>') +
      state.listings.map(x => `<option value="${esc(x.mlsNumber)}" ${x.mlsNumber === state.mls ? 'selected' : ''}>${esc(SOR.listingLabel(x))}${mark(x)}</option>`).join('');

    panel.innerHTML = `
      <div class="sor-head">
        <div class="sor-brand"><span class="sor-sun">☀</span> Sun Ocean</div>
        <span class="sor-mode">${esc(MODE_LABEL[state.mode] || 'Ready')}</span>
        <button type="button" class="sor-icon-btn" data-act="collapse" title="Minimize">–</button>
      </div>
      <div class="sor-body">
        <label class="sor-field"><span>Posting as</span><select data-role="agent">${agentOpts}</select></label>
        ${state.listings.length
          ? `<label class="sor-field"><span>Listing</span><select data-role="listing">${listingOpts}</select></label>`
          : `<div class="sor-empty">No saved listings yet. Scrape one on OneHome or add a by-owner listing.<br><button type="button" class="sor-link" data-act="new-listing">+ Add by-owner listing</button></div>`}
        ${renderQueue()}
        ${l ? renderStep(l) : (state.listings.length ? `<div class="sor-ok-box">${esc(blockReason(null))}</div>` : '')}
        ${renderStatus()}
        ${renderReport()}
      </div>`;
  }

  function renderTitleBox() {
    const ad = currentAd();
    if (!ad) return '';
    const len = ad.title.length;
    return `
      <div class="sor-title-box">
        <div class="sor-row"><span class="sor-small">Title</span><span class="sor-count ${len > SOR.TITLE_MAX ? 'sor-over' : ''}">${len}/${SOR.TITLE_MAX}</span></div>
        <input type="text" data-role="title" maxlength="${SOR.TITLE_MAX}" value="${esc(ad.title)}">
        <div class="sor-row sor-gap">
          <button type="button" class="sor-chip" data-act="next-title" title="Try another title">↻ Another title</button>
          ${state.settings && state.settings.ai && state.settings.ai.enabled ? '<button type="button" class="sor-chip" data-act="ai">✨ AI rewrite</button>' : ''}
          <button type="button" class="sor-chip" data-act="edit">✎ Edit ad</button>
        </div>
        <div class="sor-small sor-muted">${ad.source === 'ai' ? 'AI-written ad' : ad.edited ? 'Your edited ad' : 'Auto-written ad'} · ${esc(SOR.getAgent(state.settings).name)}'s signature</div>
      </div>`;
  }

  function renderStep(l) {
    const f = SOR.analyze(l, state.settings);
    switch (state.mode) {
      case 'reuse':
        return `${btn('reuse', 'Re-use selected data')}<div class="sor-hint">Contact info carries over; the ad details are replaced on the next pages and old photos are removed.</div>`;
      case 'choose-type':
        return `${btn('pick-type', 'Choose “housing offered”')}<div class="sor-hint">Craigslist posting type.</div>`;
      case 'choose-category':
        return `${btn('pick-category', 'Choose “apartments / housing for rent”')}`;
      case 'choose-area': {
        const c = SOR.subareaCandidates(f.county);
        return c.length
          ? `${btn('pick-area', `Choose “${c[0]}”`)}<div class="sor-hint">${esc(f.city)} is in ${esc(titleCase(f.county))} County.</div>`
          : `<div class="sor-hint">Pick the area for ${esc(f.city || 'this listing')} on the page.</div>`;
      }
      case 'choose-other':
        return `${btn('pick-other', `Choose “${esc(f.city || 'best match')}”`)}<div class="sor-hint">If nothing matches, pick the closest option or “bypass this step”.</div>`;
      case 'edit':
        return `${renderTitleBox()}${btn('fill', state.report ? 'Fill again' : 'Fill this ad')}<div class="sor-hint">Everything Craigslist asks for is filled — review the report below, then click Continue.</div>`;
      case 'map':
        return `${btn('continue', 'Continue past the map')}<div class="sor-hint">Location comes from the ZIP${state.settings.showStreet ? ' and street' : ''}.</div>`;
      case 'images': {
        const n = Math.min(l.photoCount || 0, SOR.MAX_PHOTOS);
        if (!n) return '<div class="sor-hint">This listing has no saved photos. Add photos in the ad editor.</div>';
        const old = carriedOverImages().length;
        if (old && !state.photosAdded) return `${btn('clear-old', `Remove ${old} old photo${old === 1 ? '' : 's'} first`)}<div class="sor-hint">These came from the previous ad.</div>`;
        return state.photosAdded
          ? `${btn('done-images', 'Done with images →')}<div class="sor-hint">Wait for every thumbnail to finish uploading first.</div>`
          : `${btn('photos', `Add ${n} photo${n === 1 ? '' : 's'}`)}${(l.photoCount || 0) > SOR.MAX_PHOTOS ? `<div class="sor-hint">Craigslist allows ${SOR.MAX_PHOTOS}; the first ${SOR.MAX_PHOTOS} are used.</div>` : ''}`;
      }
      case 'preview':
        return renderPreviewCheck(l);
      case 'done': {
        const nl = state.nextId && state.listings.find(x => x.mlsNumber === state.nextId);
        return `<div class="sor-ok-box">🎉 Posted! Craigslist will email a link to manage the ad.</div>${nl ? btn('next', `Post next: ${SOR.listingLabel(nl)}`) : `<div class="sor-hint">${esc(blockReason(null))}</div><a class="sor-link" href="${SOR.CL_POST_URL}">Post another listing →</a>`}`;
      }
      default:
        return `<div class="sor-hint">Assistant is on. Start a posting and it will guide every step.</div><a class="sor-link" href="${SOR.CL_POST_URL}">Start a new South Florida posting →</a>`;
    }
  }

  function renderQueue() {
    const postable = state.queue.filter(id => SOR.isPostable(state.listings.find(l => l.mlsNumber === id)));
    if (!postable.length) return '';
    const pos = postable.indexOf(state.mls);
    const left = postable.filter(x => x !== state.mls).length;
    const lim = state.settings && state.settings.dailyLimit;
    return `<div class="sor-queue"><span>${pos >= 0 ? `Queue: listing ${pos + 1} of ${postable.length}` : `${left} in your posting queue`}${lim ? ` · ${state.postsToday}/${lim} today` : ''}</span>${pos >= 0 && left && state.mode !== 'done' ? '<button type="button" class="sor-link" data-act="skip">Skip →</button>' : ''}</div>`;
  }

  // ── Fixed NEXT STEP button (same screen spot on every page, for a click macro) ──
  const NEXT_LABEL = {
    reuse: 're-use selected data', 'choose-type': 'choose “housing offered”', 'choose-category': 'choose “apartments / housing for rent”',
    'choose-area': 'choose the county', 'choose-other': 'choose the area', edit: 'fill, verify & continue',
    map: 'continue past the map', images: 'add photos & finish', preview: 'publish', done: 'start the next listing',
    setup: 'start the next listing',
  };

  function renderNextButton() {
    let el = document.getElementById(NEXT_ID);
    if (!state.settings || !state.settings.nextButton) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = NEXT_ID;
      document.body.appendChild(el);
      el.addEventListener('click', (e) => { if (e.target.closest('button')) nextStep(); });
    }
    const l = activeListing();
    const what = NEXT_LABEL[state.mode] || 'next';
    const note = state.nextNote || (l && !/^(done|setup)$/.test(state.mode) ? `${SOR.listingLabel(l)} → ${what}` : `Next: ${what}`);
    el.innerHTML = `<div class="sor-next-note">${esc(note)}</div><button type="button" ${state.nextBusy ? 'disabled' : ''}>${state.nextBusy ? 'WORKING…' : '▶ NEXT STEP'}</button>`;
  }

  function renderPreviewCheck(l) {
    const shown = text(document.querySelector('#titletextonly, .postingtitletext, .posting-title, h1, h2'));
    const sent = (l.posted && l.posted.clTitle) || '';
    const lostEmoji = sent && /\p{Extended_Pictographic}/u.test(sent) && shown && !/\p{Extended_Pictographic}/u.test(shown);
    const rawTags = /<\/?b>/i.test(text(document.querySelector('#postingbody, .postingbody, [class*="posting-body"], section, body')));
    return `
      <div class="sor-check">
        <div>✓ Check the title, rent and photos below.</div>
        <div>✓ Phone shows as ${esc(SOR.formatPhone(SOR.getAgent(state.settings).phone))}.</div>
        ${lostEmoji ? '<div class="sor-warn">⚠ Craigslist removed the emoji from your title. Switch “Title style” to Symbols (★) in Settings.</div>' : ''}
        ${rawTags ? '<div class="sor-warn">⚠ Craigslist is showing &lt;b&gt; tags as text. Turn off “Bold” for the reference code in Settings.</div>' : ''}
        <div>Then click <b>publish</b>.</div>
      </div>`;
  }

  function renderStatus() {
    if (!state.status) return '';
    return `<div class="sor-status sor-status-${state.status.type}">${esc(state.status.msg)}</div>`;
  }

  const SOURCE_NOTE = { default: 'default', rule: 'always on', override: 'your choice', guess: 'best guess', agent: 'agent' };

  function renderReport() {
    if (state.mode !== 'edit') return renderErrors();
    const r = state.report;
    if (!r) return renderErrors();
    const rows = r.results.map(x => {
      const it = x.item;
      let icon = '✓'; let cls = 'ok'; let detail = '';
      if (x.status === 'ok' || x.status === 'kept') {
        detail = it.display || (it.kind === 'checkbox' ? (it.value ? 'checked' : 'unchecked') : (x.shown || String(it.value)));
        if (it.source !== 'listing' && SOURCE_NOTE[it.source]) { icon = '•'; cls = 'note'; detail += ` (${SOURCE_NOTE[it.source]})`; }
      } else if (x.status === 'novalue') {
        if (it.optional) return '';
        icon = '!'; cls = 'warn'; detail = 'not in listing — fill it in';
      } else if (x.status === 'missing') {
        if (it.optional) return '';
        icon = '!'; cls = 'warn'; detail = 'field not on this page';
      } else {
        icon = '✗'; cls = 'bad'; detail = x.status === 'nomatch' ? `no option “${it.value}”` : 'could not set';
      }
      return `<li class="sor-r-${cls}"><span class="sor-r-icon">${icon}</span><span class="sor-r-label">${esc(it.label)}</span><span class="sor-r-val">${esc(detail)}</span></li>`;
    }).join('');
    const missing = r.missing.length
      ? `<div class="sor-warn">⚠ Still empty on the page (outlined in red):<br>${r.missing.map(m => esc(m.label)).join(', ')}</div>`
      : '<div class="sor-ok-box">All required Craigslist fields are filled.</div>';
    return `<div class="sor-report">${missing}<ul>${rows}</ul></div>${renderErrors()}`;
  }

  function renderErrors() {
    const errs = craigslistErrors();
    if (!errs.length) return '';
    return `<div class="sor-warn">Craigslist says:<br>${errs.map(esc).join('<br>')}</div>`;
  }

  function btn(act, label) {
    return `<button type="button" class="sor-primary" data-act="${act}" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Working…' : esc(label)}</button>`;
  }

  function setStatus(msg, type) { state.status = msg ? { msg, type: type || 'info' } : null; render(); }

  // ════════════════════════════════════════════════════════════
  // Panel events
  // ════════════════════════════════════════════════════════════
  async function onPanelChange(e) {
    const role = e.target.getAttribute('data-role');
    if (role === 'agent') {
      state.settings = await SOR.store.setActiveAgent(e.target.value);
      state.report = null;
      render();
    } else if (role === 'listing') {
      state.mls = e.target.value;
      state.titleIdx = 0; state.customTitle = null; state.report = null; state.photosAdded = false;
      await chrome.storage.local.set({ _activeMLS: state.mls });
      await bindPosting(state.mls, true);
      render();
    }
  }

  function onPanelInput(e) {
    if (e.target.getAttribute('data-role') !== 'title') return;
    state.customTitle = e.target.value;
    const counter = e.target.parentElement.querySelector('.sor-count');
    if (counter) counter.textContent = `${e.target.value.length}/${SOR.TITLE_MAX}`;
  }

  async function onPanelClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.getAttribute('data-act');
    const l = activeListing();
    try {
      switch (act) {
        case 'collapse': state.collapsed = true; chrome.storage.local.set({ _panelCollapsed: true }); render(); break;
        case 'expand': state.collapsed = false; chrome.storage.local.set({ _panelCollapsed: false }); render(); break;
        case 'new-listing': chrome.runtime.sendMessage({ action: 'OPEN_EDITOR' }); break;
        case 'edit': if (l) chrome.runtime.sendMessage({ action: 'OPEN_EDITOR', mlsNumber: l.mlsNumber }); break;
        case 'next-title': state.customTitle = null; state.titleIdx += 1; render(); break;
        case 'ai': await runAi(l); break;
        case 'reuse': if (!await reuseStep()) halt('Couldn’t find the re-use button.'); break;
        case 'pick-type': await pickRadio(['housing offered']); break;
        case 'pick-category': await pickRadio(['apartments / housing for rent', 'apts/housing for rent', 'apartments / housing', 'apartments']); break;
        case 'pick-area': await pickRadio(SOR.subareaCandidates(SOR.analyze(l, state.settings).county)); break;
        case 'pick-other': await pickRadio([norm(SOR.analyze(l, state.settings).city)].filter(Boolean)); break;
        case 'fill': await fillAd(); break;
        case 'continue': clickButton(['continue', 'next', 'accept']); break;
        case 'photos': await addPhotos(); break;
        case 'clear-old': state.busy = true; render(); await removeCarriedOverImages(); state.busy = false; render(); break;
        case 'done-images': clickButton(['done with images', 'done with image', 'done']); break;
        case 'next': await startNextPosting(); break;
        case 'skip': if (confirm('Skip this listing and start the next one in your queue?')) await skipCurrent(); break;
      }
    } catch (err) {
      state.busy = false;
      setStatus(err.message || String(err), 'error');
    }
  }

  async function runAi(l) {
    if (!l) return;
    state.busy = true; setStatus('Writing a fresh ad with AI…', 'info');
    const res = await chrome.runtime.sendMessage({ action: 'AI_REWRITE', mlsNumber: l.mlsNumber });
    state.busy = false;
    if (!res || !res.success) { setStatus((res && res.error) || 'AI rewrite failed', 'error'); return; }
    await refreshData();
    state.titleIdx = 0; state.customTitle = null;
    setStatus('AI ad ready — click Fill to use it.', 'success');
  }

  // ════════════════════════════════════════════════════════════
  // Choice steps
  // ════════════════════════════════════════════════════════════
  function radioOptions() {
    return Array.from(document.querySelectorAll('input[type="radio"]'))
      .filter(r => !r.closest('#' + PANEL_ID))
      .map(r => ({ el: r, text: norm(labelTextFor(r)) }))
      .filter(o => o.text);
  }

  async function pickRadio(candidates) {
    const opts = radioOptions();
    const cands = candidates.map(norm).filter(Boolean);
    let hit = null;
    for (const c of cands) { hit = opts.find(o => o.text === c) || opts.find(o => o.text.startsWith(c)) || opts.find(o => o.text.includes(c)); if (hit) break; }
    if (!hit) { setStatus(`Couldn't find “${candidates[0] || 'that option'}” — pick it on the page.`, 'error'); return false; }
    hit.el.click();
    if (!hit.el.checked) { hit.el.checked = true; hit.el.dispatchEvent(new Event('change', { bubbles: true })); }
    setStatus(`Selected “${hit.text}”…`, 'success');
    // Most Craigslist pickers submit on click; if this one doesn't, press its continue button.
    const form = hit.el.form;
    await sleep(900);
    if (document.contains(hit.el) && form) {
      const submit = Array.from(form.querySelectorAll('button, input[type="submit"]')).find(b => /continue|next|submit/i.test(b.textContent || b.value || '') || b.type === 'submit');
      if (submit) submit.click();
    }
    return true;
  }

  function findButton(words, root) {
    const buttons = Array.from((root || document).querySelectorAll('button, input[type="submit"], input[type="button"], a.button'))
      .filter(b => !b.closest('#' + PANEL_ID) && !b.closest('#' + NEXT_ID) && !b.disabled);
    for (const w of words) {
      const b = buttons.find(x => norm(x.textContent || x.value) === w) || buttons.find(x => norm(x.textContent || x.value).includes(w));
      if (b) return b;
    }
    return null;
  }

  function clickButton(words) {
    const b = findButton(words);
    if (b) { b.click(); setStatus(`Clicked “${norm(b.textContent || b.value)}”.`, 'success'); return true; }
    setStatus('Couldn\'t find that button — click it on the page.', 'error');
    return false;
  }

  // "Re-use selected data from your previous posting?" — re-use it (contact info), but never
  // the old photos: those belong to the previous listing.
  function reuseButton() {
    return findButton(['re-use selected data', 'reuse selected data', 're-use', 'reuse']);
  }

  async function reuseStep() {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.closest('#' + PANEL_ID) || !cb.checked) return;
      if (/image|photo|picture/i.test(labelTextFor(cb) + ' ' + (cb.name || ''))) cb.click();
    });
    const b = reuseButton();
    if (!b) return false;
    setStatus('Re-using saved contact data…', 'success');
    b.click();
    return true;
  }

  // Photos carried over from a previous posting (already on Craigslist's image server).
  function carriedOverImages() {
    return Array.from(document.querySelectorAll('img'))
      .filter(img => !img.closest('#' + PANEL_ID) && /images\.craigslist\.org/i.test(img.currentSrc || img.src || ''));
  }

  async function removeCarriedOverImages() {
    const imgs = carriedOverImages();
    if (!imgs.length) return 0;
    // Craigslist may ask "are you sure?"; answer yes from the page's own JS world.
    try { await chrome.runtime.sendMessage({ action: 'CL_AUTO_CONFIRM' }); } catch (_) { /* best effort */ }
    let removed = 0;
    for (const img of imgs) {
      let box = img.parentElement;
      let del = null;
      for (let d = 0; box && d < 4 && !del; d++, box = box.parentElement) {
        del = Array.from(box.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]')).find(b =>
          /^(delete|remove|x|×|✕)$|delete|remove/i.test((b.textContent || b.value || b.title || b.getAttribute('aria-label') || '').trim()) ||
          /del|remove/i.test(b.className || ''));
      }
      if (del && document.contains(del)) { del.click(); removed++; await sleep(400); }
    }
    await sleep(800);
    return removed;
  }

  // ════════════════════════════════════════════════════════════
  // NEXT STEP — one action per page, safe to click repeatedly
  // ════════════════════════════════════════════════════════════
  async function nextStep() {
    if (state.nextBusy || state.busy) return;
    state.nextBusy = true;
    state.nextNote = '';
    renderNextButton();
    try {
      await refreshData();
      state.mode = getMode();
      const l = activeListing();
      const f = l ? SOR.analyze(l, state.settings) : null;
      const mode = state.mode;
      if (mode === 'done' || (mode === 'setup' && !postingId())) return await startNextPosting();
      if (mode !== 'preview' && mode !== 'setup') {
        const block = blockReason(l);
        if (block) return halt(block);
      }
      switch (mode) {
        case 'reuse':
          if (limitReached()) return halt(`Daily limit reached (${state.postsToday} posts today).`);
          if (!await reuseStep()) halt('Couldn’t find the “re-use selected data” button.');
          return;
        case 'choose-type':
          if (limitReached()) return halt(`Daily limit reached (${state.postsToday} posts today).`);
          if (!await pickRadio(['housing offered'])) halt('Couldn’t find “housing offered”.');
          return;
        case 'choose-category':
          if (!await pickRadio(['apartments / housing for rent', 'apts/housing for rent', 'apartments / housing', 'apartments'])) halt('Couldn’t find “apartments / housing for rent”.');
          return;
        case 'choose-area':
          if (!await pickRadio(SOR.subareaCandidates(f.county))) halt(`Couldn’t tell which area ${f.city || 'this listing'} belongs to.`);
          return;
        case 'choose-other':
          if (!await pickRadio([norm(f.city), 'bypass this step', 'bypass', 'skip'].filter(Boolean))) return giveUp('Craigslist asked for an area option that wasn’t recognized');
          return;
        case 'edit': return await editStep();
        case 'map':
          if (!clickButton(['continue', 'next'])) halt('Couldn’t find Continue on the map page.');
          return;
        case 'images': return await imagesStep();
        case 'preview': return await publishStep();
        default:
          return halt('This Craigslist page needs a person (sign-in, verification or payment?).');
      }
    } catch (err) {
      halt(err.message || String(err));
    } finally {
      state.nextBusy = false;
      renderNextButton();
    }
  }

  async function editStep() {
    const key = `sor_edit_tries_${postingId() || 'x'}`;
    const tries = (Number(sessionStorage.getItem(key)) || 0) + 1;
    sessionStorage.setItem(key, String(tries));
    if (tries > 3) {
      const errs = craigslistErrors();
      return giveUp(`Craigslist kept rejecting the ad${errs.length ? ': ' + errs.join(' ') : ''}`);
    }
    await fillAd();
    const missing = (state.report && state.report.missing) || [];
    if (missing.length) {
      const labels = missing.map(m => m.label).join(', ');
      if (tries >= 3) return giveUp(`Craigslist still needs: ${labels}`);
      return halt(`Still empty: ${labels} (try ${tries} of 3).`);
    }
    setStatus('Every required field is filled — continuing…', 'success');
    await sleep(400);
    const form = postingForm();
    const go = (form && (findButton(['continue'], form) || form.querySelector('button[type="submit"], input[type="submit"]'))) || findButton(['continue']);
    if (!go) return halt('Couldn’t find the Continue button.');
    go.click();
  }

  async function imagesStep() {
    const l = activeListing();
    const key = `sor_photos_${postingId() || 'x'}`;
    const n = Math.min((l && l.photoCount) || 0, SOR.MAX_PHOTOS);
    if (n && !sessionStorage.getItem(key)) {
      if (carriedOverImages().length) {
        setStatus('Removing photos carried over from the previous ad…', 'info');
        await removeCarriedOverImages();
        if (carriedOverImages().length) return halt('Old photos from the previous ad are still here — delete them, then click Next step.');
      }
      await addPhotos();
      if (!state.photosAdded) return halt('Photos could not be added — refresh the page and click Next step again.');
      sessionStorage.setItem(key, String(Date.now()));
    }
    setStatus('Waiting for photo uploads to finish…', 'info');
    await waitForUploads();
    if (!clickButton(['done with images', 'done with image', 'done'])) halt('Couldn’t find “done with images”.');
  }

  // Done when no progress/spinner is visible for 3 seconds (max 2 minutes).
  async function waitForUploads() {
    const start = Date.now();
    let quietSince = Date.now();
    while (Date.now() - start < 120000) {
      const busy = Array.from(document.querySelectorAll('progress, .progress, [class*="progress"], [class*="uploading"], [class*="spinner"], [class*="loading"]'))
        .some(el => !el.closest('#' + PANEL_ID) && !el.closest('#' + NEXT_ID) && el.offsetParent !== null &&
          !(el.tagName === 'PROGRESS' && el.max && el.value >= el.max) && !/100\s*%|complete|done/i.test(el.textContent || ''));
      if (busy) quietSince = Date.now();
      if (Date.now() - quietSince >= 3000 && Date.now() - start >= 4000) return true;
      await sleep(500);
    }
    return false;
  }

  async function publishStep() {
    const l = activeListing();
    if (!l) return halt('No listing is tied to this posting.');
    if (SOR.isRecentlyPosted(l)) return halt('Already published in the last 48 hours — not publishing again.');
    const b = findButton(['publish']);
    if (!b) return halt('Couldn’t find the Publish button.');
    state.publishing = true;
    await SOR.store.markPublished(l.mlsNumber);
    b.click();
  }

  // ════════════════════════════════════════════════════════════
  // Ad fill
  // ════════════════════════════════════════════════════════════
  async function fillAd() {
    const l = activeListing();
    if (!l) { setStatus('Pick a listing first.', 'error'); return; }
    state.busy = true; setStatus('Filling…', 'info');
    const settings = state.settings;
    const agent = SOR.getAgent(settings);
    const ad = currentAd();
    const plan = SOR.clPlan(l, settings, agent, ad);

    // Checkboxes first: "show my phone number" unlocks the phone inputs on Craigslist.
    const ordered = plan.filter(p => p.kind === 'checkbox').concat(plan.filter(p => p.kind !== 'checkbox'));
    const results = new Map();
    for (const item of ordered) results.set(item, await applyItem(item));
    // Second pass for anything that was disabled until a checkbox enabled it.
    for (const item of ordered) {
      const r = results.get(item);
      if (r.status === 'disabled') results.set(item, await applyItem(item));
    }

    document.querySelectorAll('.sor-missing').forEach(el => el.classList.remove('sor-missing'));
    const missing = scanRequired();
    missing.forEach(m => highlight(m.el));
    try { await chrome.runtime.sendMessage({ action: 'CL_REFRESH_WIDGETS' }); } catch (_) { /* optional */ }

    state.report = { results: plan.map(p => results.get(p)), missing };
    await SOR.store.markFilled(l.mlsNumber, { agentId: agent.id, title: ad.title });
    await refreshData();
    state.customTitle = ad.title; // keep showing the title that was actually filled
    state.busy = false;
    const bad = state.report.results.filter(x => ['failed', 'nomatch'].includes(x.status) || (!x.item.optional && ['missing', 'novalue'].includes(x.status))).length;
    setStatus(bad || missing.length ? 'Filled — a few items need you (see below).' : 'Filled! Review, then click Continue.', bad || missing.length ? 'warn' : 'success');
  }

  async function applyItem(item) {
    const empty = item.value === undefined || item.value === null || item.value === '';
    const el = locate(item);
    if (!el) return { item, status: empty ? 'novalue' : 'missing' };
    if (empty) return { item, el, status: 'novalue' };
    if (el.disabled) return { item, el, status: 'disabled' };
    try {
      if (el.tagName === 'SELECT') {
        const ok = item.kind === 'number' ? selectNumber(el, item.value) : selectText(el, item.options || [String(item.value)]);
        return { item, el, status: ok ? 'ok' : 'nomatch', shown: ok ? selectedText(el) : '' };
      }
      if (el.type === 'checkbox') {
        await setCheck(el, !!item.value);
        return { item, el, status: el.checked === !!item.value ? 'ok' : 'failed' };
      }
      if (item.onlyIfEmpty && String(el.value || '').trim()) return { item, el, status: 'kept' };
      let v = String(item.value);
      if (item.kind === 'date') {
        if (el.type === 'date') v = item.value;
        else if (/mm\/dd\/yyyy/i.test(el.placeholder || '')) { const [y, m, d] = item.value.split('-'); v = `${m}/${d}/${y}`; }
        else if (!/yyyy-mm-dd/i.test(el.placeholder || '')) return { item, el, status: 'novalue' };
      }
      if (item.kind === 'number' && el.type === 'number' && Number(item.value) === 0 && el.min && Number(el.min) > 0) return { item, el, status: 'nomatch' };
      setValue(el, v);
      return { item, el, status: el.value === v ? 'ok' : 'failed', shown: el.value };
    } catch (err) {
      return { item, el, status: 'failed', error: err.message };
    }
  }

  // ── Locating controls: name/id → visible label → option signature ──
  function tagsFor(kind) {
    if (kind === 'textarea') return 'textarea';
    if (kind === 'select') return 'select';
    if (kind === 'number') return 'select, input';
    if (kind === 'checkbox') return 'input[type="checkbox"]';
    if (kind === 'text') return 'input, textarea';
    return 'input, select, textarea';
  }

  function usable(el, item) {
    if (!el || el.closest('#' + PANEL_ID)) return false;
    if (el.tagName === 'INPUT' && ['hidden', 'submit', 'button', 'file', 'image', 'reset'].includes(el.type)) return false;
    if (item.kind === 'checkbox' && el.type !== 'checkbox') return false;
    if (item.kind !== 'checkbox' && el.type === 'checkbox') return false;
    if (el.type === 'radio') return false;
    return el.matches(tagsFor(item.kind));
  }

  function locate(item) {
    for (const name of item.names || []) {
      const q = cssStr(name);
      const el = Array.from(document.querySelectorAll(`[name="${q}" i], [id="${q}" i]`)).find(x => usable(x, item));
      if (el) return el;
    }
    return byLabel(item) || (item.sig ? bySignature(item.sig) : null);
  }

  function byLabel(item) {
    if (!item.labels || !item.labels.length) return null;
    const cands = item.labels.map(norm);
    const tags = tagsFor(item.kind);
    // 1) aria-label / placeholder on the control itself
    for (const el of document.querySelectorAll(tags)) {
      if (!usable(el, item)) continue;
      const t = norm(el.getAttribute('aria-label') || el.getAttribute('placeholder') || '');
      if (t && cands.some(c => t === c || (!item.labelExact && t.startsWith(c)))) return el;
    }
    // 2) label-ish nodes
    const nodes = Array.from(document.querySelectorAll('label, legend, .label, [class*="label"], span, dt, th'))
      .filter(n => !n.closest('#' + PANEL_ID) && (n.textContent || '').length < 90);
    for (const pass of item.labelExact ? ['exact'] : ['exact', 'starts', 'includes']) {
      for (const c of cands) {
        for (const n of nodes) {
          const t = norm(ownText(n)).replace(/[*:]+$/, '').trim();
          const hit = pass === 'exact' ? t === c : pass === 'starts' ? t.startsWith(c) : t.includes(c);
          if (!hit) continue;
          const ctl = controlForLabel(n, item, tags);
          if (ctl) return ctl;
        }
      }
    }
    return null;
  }

  function ownText(n) {
    // Text of the node without the text of nested selects (option labels would pollute matching).
    let t = '';
    n.childNodes.forEach(c => { if (c.nodeType === 3) t += c.textContent; else if (c.nodeType === 1 && !/^(SELECT|TEXTAREA|OPTION)$/.test(c.tagName)) t += ' ' + c.textContent; });
    return t;
  }

  function controlForLabel(n, item, tags) {
    if (n.tagName === 'LABEL') {
      if (n.control && usable(n.control, item)) return n.control;
      if (n.htmlFor) { const t = document.getElementById(n.htmlFor); if (usable(t, item)) return t; }
    }
    const inside = Array.from(n.querySelectorAll(tags)).find(x => usable(x, item));
    if (inside) return inside;
    let anc = n.parentElement;
    for (let depth = 0; anc && depth < 3; depth++, anc = anc.parentElement) {
      const ctls = Array.from(anc.querySelectorAll(tags)).filter(x => usable(x, item));
      if (ctls.length === 1) return ctls[0];
      if (ctls.length > 1) return ctls.find(x => n.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) || null;
    }
    return null;
  }

  function bySignature(sig) {
    const want = sig.map(norm);
    return Array.from(document.querySelectorAll('select')).find(sel => {
      if (sel.closest('#' + PANEL_ID)) return false;
      const texts = Array.from(sel.options).map(o => norm(o.textContent));
      return want.filter(w => texts.includes(w)).length >= Math.min(2, want.length);
    }) || null;
  }

  // ── Setting values ──
  function setValue(el, value) {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  async function setCheck(el, want) {
    if (el.checked !== want) el.click();
    await sleep(60);
    if (el.checked !== want) {
      el.checked = want;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function selectText(select, candidates) {
    const opts = Array.from(select.options).filter(o => !o.disabled);
    const cands = candidates.map(norm).filter(Boolean);
    let opt = null;
    for (const c of cands) { opt = opts.find(o => norm(o.textContent) === c || norm(o.value) === c); if (opt) break; }
    if (!opt) for (const c of cands) { opt = opts.find(o => norm(o.textContent).startsWith(c)); if (opt) break; }
    if (!opt) for (const c of cands) { opt = opts.find(o => norm(o.textContent).includes(c)); if (opt) break; }
    if (!opt) return false;
    setValue(select, opt.value);
    syncWidget(select, opt);
    return select.value === opt.value;
  }

  function selectNumber(select, n) {
    const num = Number(n);
    if (isNaN(num)) return false;
    const opts = Array.from(select.options).filter(o => !o.disabled).map(o => {
      const t = norm(o.textContent);
      if (/studio/.test(t)) return { o, num: 0 };
      const m = t.match(/^(\d+(?:\.\d+)?)\s*\+?/);
      return { o, num: m ? Number(m[1]) : null };
    }).filter(x => x.num !== null);
    let hit = opts.find(x => x.num === num);
    if (!hit) hit = opts.filter(x => x.num <= num).sort((a, b) => b.num - a.num)[0];
    if (!hit) return false;
    setValue(select, hit.o.value);
    syncWidget(select, hit.o);
    return select.value === hit.o.value;
  }

  function selectedText(select) {
    const o = select.options[select.selectedIndex];
    return o ? o.textContent.trim() : '';
  }

  function syncWidget(select, opt) {
    // jQuery UI selectmenu shows a separate button; update its text right away.
    const btnEl = select.id && document.getElementById(select.id + '-button');
    const t = btnEl && btnEl.querySelector('.ui-selectmenu-text');
    if (t) t.textContent = opt.textContent;
  }

  // ── Required-field scan ──
  function postingForm() {
    const title = locate(TITLE_ITEM);
    return (title && title.form) || document.querySelector('form#postingForm') || document.querySelector('form');
  }

  function scanRequired() {
    const form = postingForm();
    if (!form) return [];
    const out = [];
    const seenRadio = new Set();
    form.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.closest('#' + PANEL_ID) || el.disabled) return;
      if (el.tagName === 'INPUT' && ['hidden', 'submit', 'button', 'file', 'image', 'reset', 'checkbox'].includes(el.type)) return;
      const required = el.required || el.getAttribute('aria-required') === 'true' || !!el.closest('.req, .required');
      if (!required) return;
      if (el.type === 'radio') {
        if (seenRadio.has(el.name)) return;
        seenRadio.add(el.name);
        if (!form.querySelector(`input[type="radio"][name="${cssStr(el.name)}"]:checked`)) out.push({ el, label: describe(el) });
        return;
      }
      if (!String(el.value || '').trim()) out.push({ el, label: describe(el) });
    });
    return out;
  }

  function describe(el) {
    const t = norm(labelTextFor(el)).replace(/[*:]+$/, '');
    return t && t.length < 60 ? t : (el.name || el.id || 'a field');
  }

  function highlight(el) {
    const widget = el.id && document.getElementById(el.id + '-button');
    (widget || el).classList.add('sor-missing');
  }

  function craigslistErrors() {
    return Array.from(document.querySelectorAll('.err, .error, .errors, .error-message, .validation-error, .alert-error'))
      .filter(e => !e.closest('#' + PANEL_ID) && e.offsetParent !== null)
      .map(e => text(e))
      .filter(t => t && t.length < 200)
      .slice(0, 4);
  }

  // ════════════════════════════════════════════════════════════
  // Photos
  // ════════════════════════════════════════════════════════════
  function pageFileInput() {
    return Array.from(document.querySelectorAll('input[type="file"]')).find(i => !i.closest('#' + PANEL_ID)) || null;
  }

  async function addPhotos() {
    const l = activeListing();
    if (!l) return;
    state.busy = true; setStatus('Loading photos…', 'info');
    const photos = (await SOR.store.getPhotos(l.mlsNumber)).slice(0, SOR.MAX_PHOTOS);
    const input = pageFileInput();
    state.busy = false;
    if (!photos.length) { setStatus('No photos saved for this listing.', 'error'); return; }
    if (!input) { setStatus('Couldn\'t find the Craigslist image uploader. Refresh the page.', 'error'); return; }
    const dt = new DataTransfer();
    photos.forEach((p, i) => { try { dt.items.add(dataUrlToFile(p, `photo_${String(i + 1).padStart(2, '0')}`)); } catch (e) { console.warn('[SOR] photo', i + 1, e); } });
    if (!input.multiple && dt.files.length > 1) {
      setStatus('This uploader takes one file at a time — use Craigslist\'s standard uploader.', 'error');
      return;
    }
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    state.photosAdded = true;
    setStatus(`✓ ${dt.files.length} photos sent to Craigslist. Wait for uploads to finish.`, 'success');
  }

  function dataUrlToFile(dataUrl, base) {
    const [head, b64] = dataUrl.split(',');
    const mime = (head.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new File([u8], `${base}.${ext}`, { type: mime });
  }

  // ════════════════════════════════════════════════════════════
  // Utils
  // ════════════════════════════════════════════════════════════
  function labelTextFor(el) {
    if (el.labels && el.labels.length) return Array.from(el.labels).map(x => ownText(x)).join(' ');
    const wrap = el.closest('label');
    if (wrap) return ownText(wrap);
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    const next = el.nextElementSibling;
    if (next && next.tagName !== 'INPUT') return next.textContent;
    const prev = el.previousElementSibling;
    if (prev && /LABEL|SPAN|DIV/.test(prev.tagName)) return prev.textContent;
    return el.parentElement ? ownText(el.parentElement) : '';
  }
  function norm(v) {
    return String(v || '').toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
  }
  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function titleCase(s) { return String(s || '').replace(/(^|[\s-])([a-z])/g, (m, p, c) => p + c.toUpperCase()); }
  function esc(v) {
    return String(v === undefined || v === null ? '' : v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
  }
  function cssStr(v) { return String(v).replace(/["\\]/g, '\\$&'); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'CL_STATUS') {
      sendResponse({ success: true, mode: state.mode, mls: state.mls });
    } else if (msg.action === 'CL_SHOW_PANEL') {
      state.collapsed = false;
      chrome.storage.local.set({ _panelCollapsed: false });
      refreshData().then(render);
      sendResponse({ success: true });
    } else if (msg.action === 'CL_NEXT') {
      nextStep();
      sendResponse({ success: true, mode: state.mode });
    } else if (msg.action === 'CL_FILL') {
      refreshData().then(() => { if (msg.mlsNumber) state.mls = msg.mlsNumber; return state.mode === 'edit' ? fillAd() : null; });
      sendResponse({ success: true, mode: state.mode });
    }
    return false;
  });
})();
