// ═══════════════════════════════════════════════════════════════
// SUN OCEAN REALTY — FACEBOOK WEBHOOK BRIDGE v6 (CRM SYNC)
// Deploy as Web App: Execute as Me, Anyone can access
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  HANDOFF_EMAIL: 'louisguillen@gmail.com',
  ERIC_VERIZON: '2129207635@vtext.com',
  SHEET_NAME: 'FB_Conversations'
};

const CRM_HEADERS = [
  'Thread ID','Name','Phone','Area','Bedrooms','Budget','MoveIn','Pets','Credit',
  'Income','MLS Codes','URLs / Liked','FB Ad URL','Link Sent','Handoff Sent','Status',
  'Conversation History','Last Activity','Created',
  'Pipeline Stage', 'Assigned Agent', 'Agent Notified'
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.action === 'log_conversation') { logToSheet(payload.data); return ok('logged'); }
    if (payload.action === 'send_handoff')     { sendHandoff(payload.data); logToSheet(payload.data); return ok('handoff_sent'); }
    if (payload.action === 'send_update')      { sendUpdate(payload.data); logToSheet(payload.data); return ok('update_sent'); }
    return ok('unknown_action');
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function ok(msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', result: msg })).setMimeType(ContentService.MimeType.JSON);
}

// ── CRM SHEET LOGGING + SUPABASE SYNC ─────────────────────────
function logToSheet(data) {
  const sheet = getOrCreateSheet(CONFIG.SHEET_NAME, CRM_HEADERS);
  const threadId = data.threadId || data.threadUrl || data.name;
  if (!threadId) return;

  const existing = getExistingRow(sheet, threadId);
  let currentStage = existing.pipelineStage;
  if (data.handoffSent && (!currentStage || currentStage === 'AI Gathering')) currentStage = 'Waiting for contact';
  else if (!currentStage) currentStage = 'AI Gathering';

  // Build AI summary from conversation data
  var aiSummary = buildAISummary(data);

  // SYNC TO SUPABASE
  logToSupabase({
    id: threadId,
    source: 'Facebook Marketplace',
    name: data.name,
    phone: data.phone || existing.phone,
    area: data.area,
    bedrooms: data.bedrooms,
    budget: data.budget,
    move_in: data.moveIn,
    pets: data.pets,
    credit: data.credit,
    income: data.income,
    mls_codes: (data.mlsCodes || []).join(', '),
    urls: (data.propertiesLiked || []).join(', '),
    cl_url: data.listingUrl,
    stage: currentStage,
    assigned_agent: existing.assignedAgent || 'Unassigned',
    notes_crm: aiSummary,  // AI conversation summary for CRM card
  });

  const row = [
    threadId, data.name || 'Unknown', data.phone || existing.phone || '', data.area || '',
    data.bedrooms || '', data.budget || '', data.moveIn || '', data.pets || '', data.credit || '',
    data.income || '', (data.mlsCodes || []).join(', '), (data.propertiesLiked || []).join(', '),
    data.listingUrl || '', data.linkSent ? 'TRUE' : 'FALSE', data.handoffSent ? 'TRUE' : 'FALSE',
    data.status || 'Active', JSON.stringify((data.messages || []).slice(-20)), new Date().toISOString(),
    existing.created || new Date().toISOString(), currentStage, existing.assignedAgent || 'Unassigned', existing.agentNotified ? 'TRUE' : 'FALSE'
  ];

  if (existing.rowNum) sheet.getRange(existing.rowNum, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

// Build a clean summary from AI-collected data
function buildAISummary(data) {
  var parts = [];
  parts.push('Source: Facebook Marketplace');
  if (data.listingTitle) parts.push('Ad: ' + data.listingTitle);
  if (data.area) parts.push('Looking in: ' + data.area);
  if (data.bedrooms) parts.push('Bedrooms: ' + data.bedrooms);
  if (data.budget) parts.push('Budget: $' + data.budget);
  if (data.moveIn) parts.push('Move-in: ' + data.moveIn);
  if (data.pets) parts.push('Pets: ' + data.pets);
  if (data.credit) parts.push('Credit: ' + data.credit);
  if (data.income) parts.push('Income: ' + data.income);
  if ((data.mlsCodes || []).length > 0) parts.push('MLS picks: ' + data.mlsCodes.join(', '));
  return parts.join('\n');
}

function getExistingRow(sheet, threadId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(threadId)) {
      return { rowNum: i + 1, phone: data[i][2], created: data[i][18], pipelineStage: data[i][19], assignedAgent: data[i][20], agentNotified: String(data[i][21]).toUpperCase() === 'TRUE' };
    }
  }
  return {};
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); if (headers?.length) { s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold'); s.setFrozenRows(1); } }
  else if (headers?.length) { const c = s.getLastColumn(); if (c > 0 && c < headers.length) s.getRange(1, c + 1, 1, headers.length - c).setValues([headers.slice(c)]).setFontWeight('bold'); }
  return s;
}

// ── HANDOFF EMAIL ──────────────────────────────────────────
function sendHandoff(data) {
  const subject = 'NEW FB LEAD: ' + (data.name || 'Unknown') + ' - ' + (data.area || 'Florida');
  const body = [
    'NEW FACEBOOK MARKETPLACE LEAD', '-----------------------------------------',
    'Name: ' + (data.name || 'Unknown'), 'Phone: ' + (data.phone || 'Not provided'),
    'Area: ' + (data.area || 'Unknown'), 'Beds: ' + (data.bedrooms || 'Unknown'),
    'Budget: $' + (data.budget || '?'), 'Move-in: ' + (data.moveIn || 'Unknown'),
    '', 'Pets: ' + (data.pets || '?'), 'Credit: ' + (data.credit || '?'), 'Income: ' + (data.income || '?'),
    '', (data.mlsCodes || []).length > 0 ? 'MLS Picks: ' + data.mlsCodes.join(', ') : '',
    '', 'Ad: ' + (data.listingTitle || 'Unknown'),
    data.listingUrl ? 'Ad Link: ' + data.listingUrl : '',
    data.threadUrl ? 'Messenger: ' + data.threadUrl : ''
  ].filter(Boolean).join('\n');

  GmailApp.sendEmail(CONFIG.HANDOFF_EMAIL, subject, body);
  var sms = 'FB:' + (data.name || '?') + ' ' + (data.phone || '?') + ' ' + (data.area || '?') + ' ' + (data.bedrooms || '?') + 'BR $' + (data.budget || '?');
  GmailApp.sendEmail(CONFIG.ERIC_VERIZON, 'FB', sms.substring(0, 155));
}

// ── UPDATE EMAIL ─────────────────────────────────────────────
function sendUpdate(data) {
  var reason = data.updateReason || 'Customer sent new info';
  var subject = 'FB UPDATE: ' + (data.name || '?') + ' - ' + reason;
  var body = [
    'LEAD UPDATE', '-----------------------------------------',
    'Name: ' + (data.name || 'Unknown'), 'Phone: ' + (data.phone || 'Not provided'),
    '', 'Reason: ' + reason,
    (data.newCodes || []).length > 0 ? 'New MLS: ' + data.newCodes.join(', ') : '',
    (data.mlsCodes || []).length > 0 ? 'All MLS: ' + data.mlsCodes.join(', ') : '',
    data.threadUrl ? 'Messenger: ' + data.threadUrl : ''
  ].filter(Boolean).join('\n');

  GmailApp.sendEmail(CONFIG.HANDOFF_EMAIL, subject, body);
  var sms = 'FBupd:' + (data.name || '?') + ' ' + (data.newCodes || []).join(',');
  GmailApp.sendEmail(CONFIG.ERIC_VERIZON, 'FBupd', sms.substring(0, 155));
}

// ═══════════════════════════════════════════════════════════════
//  SUPABASE BRIDGE
// ═══════════════════════════════════════════════════════════════
function getSupabaseConfig() {
  var props = PropertiesService.getScriptProperties();
  return { url: props.getProperty('SUPABASE_URL'), key: props.getProperty('SUPABASE_KEY') };
}

function logToSupabase(leadData) {
  var cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.key) { Logger.log('Missing SUPABASE_URL or SUPABASE_KEY'); return null; }
  if (!leadData.id) { Logger.log('leadData.id required'); return null; }

  var payload = {
    id:             String(leadData.id),
    source:         leadData.source         || null,
    name:           leadData.name           || null,
    phone:          leadData.phone          || null,
    area:           leadData.area           || null,
    bedrooms:       leadData.bedrooms       || null,
    budget:         leadData.budget         || null,
    move_in:        leadData.move_in        || null,
    pets:           leadData.pets           || null,
    credit:         leadData.credit         || null,
    income:         leadData.income         || null,
    mls_codes:      leadData.mls_codes      || null,
    urls:           leadData.urls           || null,
    cl_url:         leadData.cl_url         || null,
    notes_crm:      leadData.notes_crm      || null,   // AI summary for CRM card
    stage:          leadData.stage          || 'Waiting for contact',
    assigned_agent: leadData.assigned_agent || 'Unassigned',
  };

  var options = {
    method: 'POST', contentType: 'application/json',
    headers: { 'apikey': cfg.key, 'Authorization': 'Bearer ' + cfg.key, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(cfg.url + '/rest/v1/leads', options);
    var status = response.getResponseCode();
    if (status === 200 || status === 201) { Logger.log('Supabase OK: ' + leadData.id); return JSON.parse(response.getContentText()); }
    else { Logger.log('Supabase ' + status + ': ' + response.getContentText()); return null; }
  } catch (e) { Logger.log('Supabase error: ' + e.message); return null; }
}

function testHandoff() {
  logToSupabase({
    id: 'FB-test-' + Date.now(), source: 'Facebook Marketplace',
    name: 'Test Customer', phone: '5551234567', area: 'Hollywood, Miramar',
    bedrooms: '2', budget: '2500', move_in: 'ASAP', pets: 'none',
    credit: 'good', income: 'paystubs', notes_crm: 'Source: Facebook Marketplace\nLooking in: Hollywood, Miramar\nBudget: $2500\nMove-in: ASAP',
    stage: 'Waiting for contact', assigned_agent: 'Unassigned',
  });
}
