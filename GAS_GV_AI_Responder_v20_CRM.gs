// ═══════════════════════════════════════════════════════════════
// SUN OCEAN REALTY — AI TEXT RESPONDER v20 (CRM INTEGRATION)
// Changes from v19: Supabase sync with notes_crm for AI summary
// ═══════════════════════════════════════════════════════════════
// 
// SETUP: In your existing v19 script, add these TWO things:
//
// 1. Add Script Properties (Tools > Script Properties):
//    SUPABASE_URL = https://your-project.supabase.co
//    SUPABASE_KEY = your-service-role-key
//
// 2. Paste the Supabase functions below at the bottom of your script
//
// 3. Add the syncToSupabase() call inside saveConversation()
//    (see instructions below)
// ═══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────
// PASTE THIS AT THE BOTTOM OF YOUR EXISTING v19 SCRIPT
// ──────────────────────────────────────────────────────────────

function getSupabaseConfig() {
  var props = PropertiesService.getScriptProperties();
  return { url: props.getProperty('SUPABASE_URL'), key: props.getProperty('SUPABASE_KEY') };
}

/**
 * Syncs a conversation to Supabase. Call this from saveConversation().
 */
function syncToSupabase(phone, c) {
  var cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.key) return;

  // Build AI summary from collected data
  var summaryParts = [];
  summaryParts.push('Source: Google Voice');
  if (c.clUrl) summaryParts.push('CL Ad: ' + c.clUrl);
  if (c.area) summaryParts.push('Looking in: ' + c.area);
  if (c.bedrooms) summaryParts.push('Bedrooms: ' + c.bedrooms);
  if (c.budget) summaryParts.push('Budget: $' + c.budget);
  if (c.moveIn) summaryParts.push('Move-in: ' + c.moveIn);
  if (c.pets) summaryParts.push('Pets: ' + c.pets);
  if (c.credit) summaryParts.push('Credit: ' + c.credit);
  if (c.income) summaryParts.push('Income: ' + c.income);
  if (c.hoaPref) summaryParts.push('HOA pref: ' + c.hoaPref);
  if ((c.mlsCodes || []).length > 0) summaryParts.push('MLS picks: ' + c.mlsCodes.join(', '));

  // Last 3 messages for context
  var recentMsgs = (c.history || []).slice(-3).map(function(h) {
    return (h.role === 'customer' ? 'Customer' : 'Eric') + ': ' + (h.text || '').substring(0, 100);
  });
  if (recentMsgs.length > 0) {
    summaryParts.push('');
    summaryParts.push('Recent:');
    summaryParts = summaryParts.concat(recentMsgs);
  }

  var payload = {
    id:             phone,    // Use phone number as unique ID
    source:         'Google Voice',
    name:           c.name           || null,
    phone:          phone            || null,
    area:           c.area           || null,
    bedrooms:       c.bedrooms       || null,
    budget:         c.budget         || null,
    move_in:        c.moveIn         || null,
    pets:           c.pets           || null,
    credit:         c.credit         || null,
    income:         c.income         || null,
    mls_codes:      (c.mlsCodes || []).join(', ') || null,
    urls:           (c.urls || []).join(', ') || null,
    cl_url:         c.clUrl          || null,
    notes_crm:      summaryParts.join('\n'),   // AI summary for CRM card
    stage:          c.pipelineStage  || 'Waiting for contact',
    assigned_agent: c.assignedAgent  || 'Unassigned',
  };

  var options = {
    method: 'POST', contentType: 'application/json',
    headers: { 'apikey': cfg.key, 'Authorization': 'Bearer ' + cfg.key, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(cfg.url + '/rest/v1/leads', options);
    var status = response.getResponseCode();
    if (status === 200 || status === 201) Logger.log('Supabase OK: ' + phone);
    else Logger.log('Supabase ' + status + ': ' + response.getContentText());
  } catch (e) { Logger.log('Supabase error: ' + e.message); }
}

// ──────────────────────────────────────────────────────────────
// MODIFY YOUR EXISTING saveConversation() FUNCTION
// Add this ONE LINE at the very end, before the closing }
// ──────────────────────────────────────────────────────────────
//
// function saveConversation(sheet, phone, c) {
//   ... your existing code ...
//   if (c.row) sheet.getRange(...).setValues([row]); else sheet.appendRow(row);
//
//   // *** ADD THIS LINE: ***
//   syncToSupabase(phone, c);
// }

// ──────────────────────────────────────────────────────────────
// TEST: Run this to verify Supabase connection
// ──────────────────────────────────────────────────────────────
function testSupabaseSync() {
  syncToSupabase('5551234567', {
    name: 'GV Test Lead',
    area: 'Fort Lauderdale',
    bedrooms: '2',
    budget: '2000',
    moveIn: 'June 1',
    pets: 'none',
    credit: 'good',
    income: 'paystubs',
    hoaPref: null,
    mlsCodes: ['A12345'],
    urls: [],
    clUrl: 'https://craigslist.org/test',
    pipelineStage: 'Waiting for contact',
    assignedAgent: 'Unassigned',
    history: [
      { role: 'customer', text: 'I saw your ad on craigslist' },
      { role: 'eric', text: 'which area are you looking in' },
    ],
  });
  Logger.log('Test sync complete - check Supabase');
}
