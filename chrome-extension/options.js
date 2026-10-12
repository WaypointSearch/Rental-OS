// Sun Ocean Realty — settings page v4
'use strict';

const $ = (sel) => document.querySelector(sel);
let settings = null;
let saveTimer = null;
const CHECKS = ['alwaysPetsAndAC', 'showPhone', 'showStreet', 'includeKeywords', 'autoQueue', 'nextButton', 'requeueAfter48h'];
const VALUES = ['defaultLaundry', 'defaultParking', 'brokerage', 'titleStyle', 'keywords', 'dailyLimit'];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  settings = await SOR.store.loadSettings();
  $('#s-defaultLaundry').innerHTML = SOR.CL.laundry.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  $('#s-defaultParking').innerHTML = SOR.CL.parking.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  CHECKS.forEach(k => { $(`#s-${k}`).checked = !!settings[k]; });
  VALUES.forEach(k => { $(`#s-${k}`).value = settings[k]; });
  $('#s-aiEnabled').checked = !!settings.ai.enabled;
  $('#s-aiModel').value = settings.ai.model || '';
  $('#model-list').innerHTML = ['gpt-5-nano', 'gpt-5-mini', 'gpt-4.1-nano', 'gpt-4.1-mini', 'gpt-4o-mini'].map(m => `<option value="${m}">`).join('');
  $('#ai-key').value = await SOR.store.getApiKey();

  $('#rc-digit').innerHTML = '0123456789'.split('').map(d => `<option value="${d}">${d}</option>`).join('');
  $('#rc-enabled').checked = !!settings.refCode.enabled;
  $('#rc-bold').checked = !!settings.refCode.bold;
  $('#rc-digit').value = settings.refCode.digit;
  $('#rc-after').value = settings.refCode.afterDigit;
  ['rc-enabled', 'rc-bold', 'rc-digit', 'rc-after'].forEach(id => $(`#${id}`).addEventListener(id === 'rc-after' ? 'input' : 'change', readAndSave));

  renderAgents();
  renderPreview();

  document.querySelectorAll('[id^="s-"]').forEach(el => {
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', readAndSave);
  });
  $('#ai-key').addEventListener('change', async () => { await SOR.store.setApiKey($('#ai-key').value); flashSaved(); });
  $('#btn-add-agent').addEventListener('click', addAgent);
  $('#btn-reset-keywords').addEventListener('click', () => {
    if (!confirm('Replace the keyword block with the default text?')) return;
    $('#s-keywords').value = SOR.DEFAULT_KEYWORDS;
    readAndSave();
  });
  $('#btn-test-ai').addEventListener('click', testAi);
}

function readAndSave() {
  CHECKS.forEach(k => { settings[k] = $(`#s-${k}`).checked; });
  VALUES.forEach(k => { settings[k] = $(`#s-${k}`).value; });
  settings.dailyLimit = Math.max(0, Math.floor(Number(settings.dailyLimit) || 0));
  settings.refCode = {
    enabled: $('#rc-enabled').checked, bold: $('#rc-bold').checked,
    digit: $('#rc-digit').value, afterDigit: Math.min(9, Math.max(1, Math.floor(Number($('#rc-after').value) || 3))),
  };
  settings.ai = { enabled: $('#s-aiEnabled').checked, model: $('#s-aiModel').value.trim() || 'gpt-5-nano' };
  renderPreview();
  queueSave();
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    // Keep editing the local copy so agent rows don't shift while a field is mid-edit.
    await SOR.store.saveSettings(settings);
    flashSaved();
  }, 300);
}

function flashSaved() {
  const f = $('#saved-flag');
  f.classList.add('show');
  clearTimeout(flashSaved.t);
  flashSaved.t = setTimeout(() => f.classList.remove('show'), 1200);
}

// ── Agents ───────────────────────────────────────────────────
function renderAgents() {
  $('#agents').innerHTML = settings.agents.map((a, i) => `
    <div class="agent ${a.id === settings.activeAgentId ? 'active' : ''}" data-i="${i}">
      <label class="pick" title="Use this agent"><input type="radio" name="active-agent" ${a.id === settings.activeAgentId ? 'checked' : ''}>Active</label>
      <label class="f">Name<input type="text" data-k="name" value="${esc(a.name)}"></label>
      <label class="f">Title<input type="text" data-k="title" value="${esc(a.title)}" placeholder="Broker, Real Estate Agent…"></label>
      <span></span>
      <label class="f">Phone (call / text)<input type="tel" data-k="phone" value="${esc(a.phone)}" placeholder="954-555-1212"></label>
      <label class="f">Email (optional)<input type="email" data-k="email" value="${esc(a.email)}" placeholder="Used only if Craigslist asks"></label>
      <div class="full">${settings.agents.length > 1 ? '<button type="button" class="linkbtn danger" data-del>Remove agent</button>' : ''}</div>
    </div>`).join('');

  $('#agents').querySelectorAll('.agent').forEach(row => {
    const i = Number(row.dataset.i);
    row.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('input', () => {
      settings.agents[i][inp.dataset.k] = inp.value;
      renderPreview();
      queueSave();
    }));
    row.querySelector('input[type="radio"]').addEventListener('change', () => {
      settings.activeAgentId = settings.agents[i].id;
      renderAgents(); renderPreview(); queueSave();
    });
    const del = row.querySelector('[data-del]');
    if (del) del.addEventListener('click', () => {
      if (!confirm(`Remove ${settings.agents[i].name || 'this agent'}?`)) return;
      settings.agents.splice(i, 1);
      if (!settings.agents.some(a => a.id === settings.activeAgentId)) settings.activeAgentId = settings.agents[0].id;
      renderAgents(); renderPreview(); queueSave();
    });
  });
}

function addAgent() {
  settings.agents.push({ id: 'agent-' + Date.now().toString(36), name: 'New Agent', title: 'Real Estate Agent', phone: '', email: '' });
  renderAgents();
  queueSave();
  const rows = document.querySelectorAll('.agent');
  const last = rows[rows.length - 1];
  last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  last.querySelector('input[data-k="name"]').select();
}

function renderPreview() {
  const s = SOR.mergeSettings(settings);
  $('#sig-preview').textContent = SOR.composeBody('…your property description…\n\n…highlights…\n\n…about this home…', SOR.getAgent(s), s, 'F3256961');
  $('#rc-example').innerHTML = s.refCode.enabled
    ? `Example: MLS# <b>F3256961</b> → caller code <b>${SOR.refCode('F3256961', s)}</b>`
    : 'Reference code is off.';
}

// ── AI ───────────────────────────────────────────────────────
async function testAi() {
  const status = $('#ai-status');
  const btn = $('#btn-test-ai');
  status.className = 'note';
  status.textContent = 'Checking your key…';
  btn.disabled = true;
  try {
    await SOR.store.setApiKey($('#ai-key').value);
    const res = await chrome.runtime.sendMessage({ action: 'AI_TEST', apiKey: $('#ai-key').value });
    if (!res || !res.success) throw new Error((res && res.error) || 'Test failed');
    $('#model-list').innerHTML = res.models.map(m => `<option value="${esc(m)}">`).join('');
    const current = $('#s-aiModel').value.trim();
    let msg = `Key works. ${res.models.length} chat models available.`;
    if (!res.models.includes(current) && res.suggested) {
      $('#s-aiModel').value = res.suggested;
      msg += ` “${current || '(none)'}” isn't on your account, so switched to ${res.suggested}.`;
    } else if (current) {
      msg += ` Using ${current}.`;
    }
    $('#s-aiEnabled').checked = true;
    readAndSave();
    status.className = 'note ok';
    status.textContent = msg;
  } catch (e) {
    status.className = 'note bad';
    status.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}

function esc(v) {
  return String(v === undefined || v === null ? '' : v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
}
