// Sun Ocean Realty — ad editor v4
'use strict';

const $ = (sel) => document.querySelector(sel);
const FIELDS = ['streetAddress', 'city', 'zip', 'county', 'state', 'price', 'propertyType', 'bedrooms', 'bathrooms', 'sqft',
  'yearBuilt', 'subdivision', 'petsAllowed', 'furnished', 'pool', 'parking', 'cooling', 'description'];
const TYPES = ['Single Family Residence', 'Townhouse', 'Villa', 'Condominium', 'Apartment', 'Duplex', 'Efficiency', 'Mobile Home'];
const CITIES = ['Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Miramar', 'Davie', 'Plantation', 'Sunrise', 'Coral Springs',
  'Pompano Beach', 'Deerfield Beach', 'Margate', 'Coconut Creek', 'Tamarac', 'Lauderhill', 'Lauderdale Lakes', 'North Lauderdale',
  'Oakland Park', 'Wilton Manors', 'Hallandale Beach', 'Dania Beach', 'Cooper City', 'Weston', 'Parkland', 'Miami', 'Miami Beach',
  'Hialeah', 'Miami Gardens', 'North Miami', 'North Miami Beach', 'Homestead', 'Doral', 'Kendall', 'Aventura', 'Coral Gables',
  'Miami Lakes', 'Cutler Bay', 'West Palm Beach', 'Boca Raton', 'Boynton Beach', 'Delray Beach', 'Lake Worth Beach', 'Wellington',
  'Jupiter', 'Palm Beach Gardens', 'Royal Palm Beach', 'Greenacres'];

let settings = null;
let original = null;   // listing as stored (or a blank manual listing)
let isNew = false;
let photos = [];
let photosDirty = false;
let ad = null;         // { title, titleOptions, body, source, edited }
let dirty = false;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  settings = await SOR.store.loadSettings();
  const params = new URLSearchParams(location.search);
  const id = params.get('mls');
  if (id) original = await SOR.store.getListing(id);
  if (!original) {
    isNew = true;
    original = { source: 'manual', state: 'FL', features: {}, additionalDetails: {}, posted: { craigslist: false } };
  }

  $('#city-list').innerHTML = CITIES.map(c => `<option value="${esc(c)}">`).join('');
  const types = TYPES.includes(original.propertyType) || !original.propertyType ? TYPES : [original.propertyType].concat(TYPES);
  $('#f-propertyType').innerHTML = '<option value="">—</option>' + types.map(t => `<option>${esc(t)}</option>`).join('');
  fillSelect('#o-housingType', SOR.CL.housing, 'Auto');
  fillSelect('#o-laundry', SOR.CL.laundry, `Auto (default ${settings.defaultLaundry})`);
  fillSelect('#o-parking', SOR.CL.parking, `Auto (default ${settings.defaultParking})`);
  $('#agent-select').innerHTML = settings.agents.map(a => `<option value="${esc(a.id)}" ${a.id === settings.activeAgentId ? 'selected' : ''}>${esc(a.name)}</option>`).join('');

  FIELDS.forEach(k => {
    const el = $(`#f-${k}`);
    let v = original[k] || '';
    if (k === 'county' && v) v = /broward/i.test(v) ? 'Broward' : /dade|miami/i.test(v) ? 'Miami-Dade' : /palm/i.test(v) ? 'Palm Beach' : 'Other';
    if (k === 'petsAllowed' && v) v = /^no\b|not allowed/i.test(v) ? 'No' : 'Yes';
    if (k === 'furnished' && v) v = /unfurnished/i.test(v) ? '' : /partial/i.test(v) ? 'Partially Furnished' : /^(yes|furnished|fully)/i.test(v) ? 'Furnished' : '';
    el.value = v;
  });
  const o = original.overrides || {};
  $('#o-housingType').value = o.housingType || '';
  $('#o-laundry').value = o.laundry || '';
  $('#o-parking').value = o.parking || '';

  $('#page-title').textContent = isNew ? 'New by-owner listing' : 'Ad Editor';
  const code = !isNew && settings.refCode.enabled ? SOR.refCode(original.mlsNumber, settings) : '';
  $('#page-sub').textContent = isNew ? 'Not on the MLS? Enter it here.' : `${original.source === 'manual' ? 'By-owner' : 'MLS# ' + original.mlsNumber}${code ? ' · Caller code ' + code : ''} · ${original.fullAddress || original.city || ''}`;
  $('#source-badge').textContent = original.source === 'manual' ? 'By owner' : 'From MLS';
  $('#source-badge').className = 'badge ' + (original.source === 'manual' ? 'sun' : '');

  ad = original.ad && original.ad.title ? Object.assign({}, SOR.getAd(original, settings)) : SOR.makeTemplateAd(collectListing(), settings);
  photos = isNew ? [] : await SOR.store.getPhotos(original.mlsNumber);

  renderAd();
  renderDetected();
  renderPhotos();
  renderAiState();
  bind();
}

function fillSelect(sel, values, autoLabel) {
  $(sel).innerHTML = `<option value="">${esc(autoLabel)}</option>` + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
}

function bind() {
  document.querySelectorAll('[id^="f-"], [id^="o-"]').forEach(el => el.addEventListener('input', onFactsChanged));
  document.querySelectorAll('select[id^="f-"], select[id^="o-"]').forEach(el => el.addEventListener('change', onFactsChanged));
  $('#ad-title').addEventListener('input', () => { ad.title = $('#ad-title').value; ad.edited = true; markDirty(); renderTitleCount(); renderPreview(); renderOptionsActive(); });
  $('#ad-body').addEventListener('input', () => { ad.body = $('#ad-body').value; ad.edited = true; markDirty(); renderPreview(); renderAdBadge(); });
  $('#agent-select').addEventListener('change', async (e) => { settings = await SOR.store.setActiveAgent(e.target.value); renderPreview(); });
  $('#btn-regen').addEventListener('click', () => {
    if (ad.edited && !confirm('Replace your edited title and description with a fresh auto-written ad?')) return;
    ad = SOR.makeTemplateAd(collectListing(), settings);
    // Rotate to a different first title than the one showing.
    const cur = $('#ad-title').value;
    if (ad.titleOptions.length > 1 && ad.titleOptions[0] === cur) ad.title = ad.titleOptions[1];
    markDirty(); renderAd();
  });
  $('#btn-ai').addEventListener('click', runAi);
  $('#btn-save').addEventListener('click', save);
  $('#btn-copy-title').addEventListener('click', () => copy($('#ad-title').value, 'Title copied'));
  $('#btn-copy-all').addEventListener('click', () => copy(`${$('#ad-title').value}\n\n${finalBody()}`, 'Full ad copied'));
  $('#photo-input').addEventListener('change', addPhotos);
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } });
}

function onFactsChanged() {
  markDirty();
  // An untouched auto-written ad follows the facts live.
  if (ad.source === 'template' && !ad.edited) ad = SOR.makeTemplateAd(collectListing(), settings);
  renderAd();
  renderDetected();
}

function collectListing() {
  const l = JSON.parse(JSON.stringify(original));
  FIELDS.forEach(k => { const el = $(`#f-${k}`); if (el) l[k] = el.value.trim(); });
  if (!l.state) l.state = 'FL';
  const overrides = { housingType: $('#o-housingType').value, laundry: $('#o-laundry').value, parking: $('#o-parking').value };
  Object.keys(overrides).forEach(k => { if (!overrides[k]) delete overrides[k]; });
  l.overrides = overrides;
  l.fullAddress = [l.streetAddress, l.city, [l.state, l.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return l;
}

// ── Rendering ────────────────────────────────────────────────
function renderAd() {
  $('#ad-title').value = ad.title;
  $('#ad-body').value = ad.body;
  renderTitleCount();
  renderAdBadge();
  const opts = SOR.getAd(Object.assign(collectListing(), { ad }), settings).titleOptions;
  $('#title-options').innerHTML = opts.map(t => `<button type="button" class="title-opt" data-t="${esc(t)}"><span>${esc(t)}</span><span class="len">${t.length}</span></button>`).join('');
  $('#title-options').querySelectorAll('.title-opt').forEach(b => b.addEventListener('click', () => {
    ad.title = b.dataset.t;
    $('#ad-title').value = ad.title;
    markDirty(); renderTitleCount(); renderOptionsActive(); renderPreview();
  }));
  renderOptionsActive();
  renderPreview();
}

function renderOptionsActive() {
  document.querySelectorAll('.title-opt').forEach(b => b.classList.toggle('on', b.dataset.t === $('#ad-title').value));
}

function renderTitleCount() {
  const n = $('#ad-title').value.length;
  $('#title-count').textContent = `${n}/${SOR.TITLE_MAX}`;
  $('#title-count').classList.toggle('over', n > SOR.TITLE_MAX);
}

function renderAdBadge() {
  const b = $('#ad-badge');
  b.textContent = ad.source === 'ai' ? (ad.edited ? 'AI · edited' : 'AI-written') : ad.edited ? 'Edited by you' : 'Auto-written';
  b.className = 'badge ' + (ad.source === 'ai' ? 'ai' : ad.edited ? '' : 'ok');
}

function finalBody() {
  return SOR.composeBody($('#ad-body').value, SOR.getAgent(settings), settings, original.mlsNumber);
}

function renderPreview() {
  $('#preview-title').textContent = $('#ad-title').value;
  $('#preview-body').textContent = finalBody();
}

function renderDetected() {
  const f = SOR.analyze(collectListing(), settings);
  const chips = f.hooks.map(h => `<span class="chip hook">${esc(h.emoji)} ${esc(h.short)}</span>`);
  const src = (s) => (s === 'default' ? ' (default)' : s === 'override' ? ' (your pick)' : '');
  chips.push(`<span class="chip ${f.laundrySource === 'default' ? 'def' : ''}">Laundry: ${esc(f.laundry)}${src(f.laundrySource)}</span>`);
  chips.push(`<span class="chip ${f.parkingSource === 'default' ? 'def' : ''}">Parking: ${esc(f.parking)}${src(f.parkingSource)}</span>`);
  chips.push(`<span class="chip">CL type: ${esc(f.type)}</span>`);
  if (settings.alwaysPetsAndAC) chips.push('<span class="chip">Cats ✓ Dogs ✓ A/C ✓ (always on)</span>');
  if (!f.county) chips.push('<span class="chip def">County unknown — pick it above</span>');
  $('#detected').innerHTML = chips.join('');
}

function renderAiState() {
  const btn = $('#btn-ai');
  if (!settings.ai.enabled) {
    btn.disabled = true;
    btn.title = 'Turn on AI rewriting in Settings';
    const note = $('#ai-note');
    note.classList.remove('hidden');
    note.innerHTML = 'AI rewriting is off. <button class="linkbtn" type="button" id="go-settings">Add an OpenAI key in Settings</button> to enable it.';
    $('#go-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  }
}

async function runAi() {
  const btn = $('#btn-ai');
  const note = $('#ai-note');
  if (ad.edited && !confirm('Replace your edited title and description with an AI-written version?')) return;
  btn.disabled = true;
  btn.textContent = 'Writing…';
  note.className = 'note';
  note.textContent = 'Asking AI for 5 titles and a fresh description…';
  try {
    const res = await chrome.runtime.sendMessage({ action: 'AI_REWRITE', listing: collectListing() });
    if (!res || !res.success) throw new Error((res && res.error) || 'AI rewrite failed');
    ad = res.ad;
    markDirty();
    renderAd();
    note.className = 'note ok';
    note.textContent = 'Done. Pick a title, tweak anything, then Save.';
  } catch (e) {
    note.className = 'note bad';
    note.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Rewrite with AI';
  }
}

// ── Photos ───────────────────────────────────────────────────
function renderPhotos() {
  $('#photo-count').textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'}`;
  const box = $('#photos');
  if (!photos.length) {
    box.innerHTML = '<div class="photo-empty">No photos yet. Click “+ Add photos”.</div>';
    return;
  }
  box.innerHTML = photos.map((p, i) => `
    <div class="photo ${i >= SOR.MAX_PHOTOS ? 'cut' : ''}" data-i="${i}">
      <img src="${p}" alt="Photo ${i + 1}" loading="lazy">
      <span class="n">${i === 0 ? 'Cover' : i + 1}</span>
      <div class="tools">
        <button type="button" data-a="first" title="Make cover">★</button>
        <button type="button" data-a="left" title="Move left">◀</button>
        <button type="button" data-a="right" title="Move right">▶</button>
        <button type="button" data-a="del" title="Remove">✕</button>
      </div>
    </div>`).join('');
  box.querySelectorAll('.tools button').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.closest('.photo').dataset.i);
    const a = b.dataset.a;
    if (a === 'del') photos.splice(i, 1);
    if (a === 'first' && i > 0) photos.unshift(photos.splice(i, 1)[0]);
    if (a === 'left' && i > 0) [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]];
    if (a === 'right' && i < photos.length - 1) [photos[i + 1], photos[i]] = [photos[i], photos[i + 1]];
    photosDirty = true; markDirty(); renderPhotos();
  }));
}

async function addPhotos(e) {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  let failed = 0;
  for (const file of files) {
    try { photos.push(await resizeImage(file)); } catch (_) { failed++; }
  }
  photosDirty = true; markDirty(); renderPhotos();
  if (failed) toast(`${failed} file(s) couldn't be read (HEIC? convert to JPG).`);
}

async function resizeImage(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

// ── Save ─────────────────────────────────────────────────────
async function save() {
  const l = collectListing();
  if (!l.city || !l.price) { toast('City and rent are required.'); return; }
  if (isNew) {
    l.mlsNumber = 'OWN-' + Date.now().toString(36).toUpperCase();
    l.source = 'manual';
    l.scrapedAt = new Date().toISOString();
    l.photoCount = 0;
  }
  const title = $('#ad-title').value.trim();
  const body = $('#ad-body').value.trim();
  if (ad.source === 'template' && !ad.edited) {
    l.ad = null; // keep it auto-written so Settings changes still apply
    const auto = SOR.makeTemplateAd(Object.assign({}, l, { ad: null }), settings);
    if (title !== auto.title || body !== auto.body) l.ad = { title, titleOptions: ad.titleOptions, body, source: 'template', edited: true, updatedAt: new Date().toISOString() };
  } else {
    l.ad = { title: SOR.trimTitle(title), titleOptions: ad.titleOptions || [], body, source: ad.source, edited: !!ad.edited, updatedAt: new Date().toISOString() };
  }
  await SOR.store.saveListing(l, { toFront: isNew });
  if (photosDirty || isNew) await SOR.store.setPhotos(l.mlsNumber, photos);
  if (isNew) {
    await chrome.storage.local.set({ _activeMLS: l.mlsNumber });
    history.replaceState(null, '', `?mls=${encodeURIComponent(l.mlsNumber)}`);
    isNew = false;
    $('#page-title').textContent = 'Ad Editor';
  }
  original = await SOR.store.getListing(l.mlsNumber);
  dirty = false; photosDirty = false;
  $('#btn-save').textContent = 'Saved ✓';
  setTimeout(() => { $('#btn-save').textContent = 'Save'; }, 1500);
  toast('Saved — the Craigslist panel will use this ad.');
}

// ── Utils ────────────────────────────────────────────────────
function markDirty() { dirty = true; $('#btn-save').textContent = 'Save'; }
async function copy(text, msg) { await navigator.clipboard.writeText(text); toast(msg); }
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}
function esc(v) {
  return String(v === undefined || v === null ? '' : v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
}
