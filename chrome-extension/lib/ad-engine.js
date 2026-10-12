/* Sun Ocean Realty — Ad Engine v4
 *
 * Pure functions shared by the background worker, popup, editor, options page and the
 * Craigslist content script. No DOM and no chrome.* calls in here (storage lives in
 * store.js) so the copywriting rules can be tested in Node.
 */
(function (root) {
  'use strict';

  const SOR = root.SOR = root.SOR || {};

  SOR.VERSION = '4.1.0';
  SOR.TITLE_MAX = 70;        // Craigslist PostingTitle maxlength (UTF-16 units, emoji count as 2+)
  SOR.MAX_PHOTOS = 24;       // Craigslist housing image limit
  SOR.SETTINGS_KEY = 'sor_settings';
  SOR.AI_KEY = 'sor_openai_key';
  SOR.CL_POST_URL = 'https://post.craigslist.org/c/mia';

  // Craigslist option labels. The filler matches these by visible text, never by numeric value.
  SOR.CL = {
    housing: ['apartment', 'condo', 'cottage/cabin', 'duplex', 'flat', 'house', 'in-law', 'loft',
      'townhouse', 'manufactured', 'assisted living', 'land'],
    laundry: ['w/d in unit', 'w/d hookups', 'laundry in bldg', 'laundry on site', 'no laundry on site'],
    parking: ['carport', 'attached garage', 'detached garage', 'off-street parking', 'street parking',
      'valet parking', 'no parking'],
  };

  const SYNONYMS = {
    'w/d in unit': ['w/d in unit', 'washer/dryer in unit', 'laundry in unit', 'in unit'],
    'w/d hookups': ['w/d hookups', 'washer/dryer hookups', 'hookups'],
    'laundry in bldg': ['laundry in bldg', 'laundry in building'],
    'laundry on site': ['laundry on site', 'on-site laundry', 'laundry on-site'],
    'no laundry on site': ['no laundry on site', 'no laundry'],
    'attached garage': ['attached garage'],
    'detached garage': ['detached garage'],
    'off-street parking': ['off-street parking', 'off street parking', 'off-street'],
    'street parking': ['street parking'],
    'carport': ['carport'],
    'house': ['house', 'single family'],
    'townhouse': ['townhouse', 'townhome'],
    'condo': ['condo', 'condominium'],
    'apartment': ['apartment', 'apt'],
    'duplex': ['duplex'],
    'manufactured': ['manufactured', 'mobile'],
    'loft': ['loft'],
    'monthly': ['monthly', 'month', 'per month'],
  };
  SOR.synonyms = (label) => SYNONYMS[label] || [label];

  SOR.DEFAULT_KEYWORDS = [
    '🔎 LOOKING FOR SOMETHING DIFFERENT? WE CAN HELP!',
    'Call us even if this one isn\'t the perfect fit. We have access to every MLS rental plus by-owner homes throughout Broward, Miami-Dade & Palm Beach:',
    '🐶 Pet-friendly houses & apartments (large dogs welcome on many)',
    '⚡ Fast-approval rentals (ask about options for credit challenges)',
    '🏊 Private pool homes',
    '✅ No-HOA single-family homes, duplexes & villas',
    '🏡 Houses, townhomes, condos, apartments & efficiencies',
    '💰 Rentals for every budget, from studios to 5-bedroom homes',
    '📍 Fort Lauderdale • Hollywood • Pembroke Pines • Miramar • Davie • Plantation • Sunrise • Coral Springs • Pompano Beach • Boca Raton • Miami • Hialeah',
  ].join('\n');

  SOR.defaultSettings = function () {
    return {
      activeAgentId: 'eric',
      agents: [
        { id: 'eric', name: 'Eric Guillen', title: 'Broker', phone: '954-357-2807', email: '' },
        { id: 'brittini', name: 'Brittini Flinn', title: 'Real Estate Agent', phone: '954-408-3407', email: '' },
      ],
      brokerage: 'Sun Ocean Realty',
      titleStyle: 'emoji',          // emoji | symbols | plain
      alwaysPetsAndAC: true,        // always tick cats OK, dogs OK and air conditioning
      defaultLaundry: 'w/d in unit',
      defaultParking: 'off-street parking',
      showStreet: false,            // fill the exact street address into the map fields
      showPhone: true,              // show phone + calls OK + texts OK
      includeKeywords: true,
      keywords: SOR.DEFAULT_KEYWORDS,
      ai: { enabled: false, model: 'gpt-5-nano' },
      // Posting queue / macro
      autoQueue: true,              // imported listings join the posting queue automatically
      nextButton: true,             // big fixed "Next step" button on every Craigslist page
      requeueAfter48h: false,       // put listings back in the queue 48h after they were posted
      dailyLimit: 0,                // max Craigslist posts per day (0 = no limit)
    };
  };

  SOR.mergeSettings = function (stored) {
    const d = SOR.defaultSettings();
    const src = stored && typeof stored === 'object' ? stored : {};
    const s = Object.assign({}, d, src);
    s.ai = Object.assign({}, d.ai, src.ai || {});
    s.agents = (Array.isArray(src.agents) ? src.agents : d.agents)
      .filter(a => a && a.id)
      .map(a => ({ id: String(a.id), name: str(a.name), title: str(a.title), phone: str(a.phone), email: str(a.email) }));
    if (!s.agents.length) s.agents = d.agents;
    if (!s.agents.some(a => a.id === s.activeAgentId)) s.activeAgentId = s.agents[0].id;
    if (!['emoji', 'symbols', 'plain'].includes(s.titleStyle)) s.titleStyle = 'emoji';
    if (!SOR.CL.laundry.includes(s.defaultLaundry)) s.defaultLaundry = d.defaultLaundry;
    if (!SOR.CL.parking.includes(s.defaultParking)) s.defaultParking = d.defaultParking;
    if (typeof s.keywords !== 'string') s.keywords = d.keywords;
    s.dailyLimit = Math.max(0, Math.floor(Number(s.dailyLimit) || 0));
    return s;
  };

  SOR.getAgent = function (settings, id) {
    const s = SOR.mergeSettings(settings);
    const want = id || s.activeAgentId;
    return s.agents.find(a => a.id === want) || s.agents[0];
  };

  // ════════════════════════════════════════════════════════════
  // Small helpers
  // ════════════════════════════════════════════════════════════
  function str(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function lower(v) { return str(v).toLowerCase(); }
  function toNum(v) {
    const m = str(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  }
  function hash(s) {
    let h = 2166136261;
    for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function pick(arr, seed, offset) { return arr.length ? arr[(seed + (offset || 0)) % arr.length] : ''; }
  function unique(arr) { const seen = new Set(); return arr.filter(x => x && !seen.has(x) && seen.add(x)); }

  function niceCase(v) {
    const s = str(v).replace(/\s+/g, ' ');
    if (!s) return '';
    if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
    return s.toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  }

  const ACRONYMS = ['HOA', 'A/C', 'AC', 'FL', 'W/D', 'HVAC', 'TV', 'II', 'III', 'SW', 'NW', 'NE', 'SE', 'USA', 'ADT', 'BBQ', 'EV'];
  function sentenceCase(text) {
    let t = str(text).toLowerCase();
    t = t.replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());
    t = t.replace(/\bi\b/g, 'I');
    ACRONYMS.forEach(a => {
      const re = new RegExp('\\b' + a.toLowerCase().replace(/\//g, '\\/') + '\\b', 'g');
      t = t.replace(re, a);
    });
    return t;
  }

  SOR.formatPhone = function (v) {
    const d = str(v).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : str(v);
  };
  SOR.money = (n) => (n === null || n === undefined || isNaN(n)) ? '' : '$' + Math.round(n).toLocaleString('en-US');
  SOR.stripEmoji = (s) => str(s)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]️?/gu, '')
    .replace(/️|‍/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n').map(x => x.trim()).join('\n');

  SOR.trimTitle = function (value, max) {
    const limit = max || SOR.TITLE_MAX;
    const clean = str(value).replace(/\s+/g, ' ');
    if (clean.length <= limit) return clean;
    return clean.slice(0, limit + 1).replace(/\s+\S*$/, '').replace(/[\s·|\-–—,:+&]+$/, '').trim();
  };

  function parseBeds(v) {
    const t = lower(v);
    if (!t) return null;
    if (/studio|efficiency/.test(t)) return 0;
    return toNum(t);
  }

  function parseBaths(v) {
    const t = lower(v);
    if (!t) return null;
    const full = t.match(/(\d+)\s*full/);
    const half = t.match(/(\d+)\s*half/);
    if (full || half) return (full ? +full[1] : 0) + (half ? +half[1] * 0.5 : 0);
    const slash = t.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (slash) return +slash[1] + +slash[2] * 0.5;
    return toNum(t);
  }

  // OneHome stores feature fields two ways: data-qa "XxxColon-feature" pairs (listing.features)
  // and section → dt/dd pairs (listing.additionalDetails). Flatten both into one lookup.
  function detailMap(l) {
    const map = {};
    const add = (k, v) => {
      const key = String(k || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
        .replace(/colon$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
      const val = str(v);
      if (key && val && !(key in map)) map[key] = val;
    };
    Object.entries(l.features || {}).forEach(([k, v]) => add(k, v));
    Object.values(l.additionalDetails || {}).forEach(sec => {
      if (sec && typeof sec === 'object') Object.entries(sec).forEach(([k, v]) => add(k, v));
    });
    return map;
  }
  function detail(map, re) {
    const out = [];
    for (const [k, v] of Object.entries(map)) if (re.test(k)) out.push(v);
    return out.join(' ');
  }

  const COUNTY_CITIES = {
    broward: ['fort lauderdale', 'ft lauderdale', 'hollywood', 'pembroke pines', 'miramar', 'davie', 'plantation',
      'sunrise', 'coral springs', 'pompano beach', 'deerfield beach', 'margate', 'coconut creek', 'tamarac',
      'lauderhill', 'lauderdale lakes', 'north lauderdale', 'oakland park', 'wilton manors', 'hallandale beach',
      'hallandale', 'dania beach', 'cooper city', 'weston', 'parkland', 'southwest ranches', 'lighthouse point',
      'lauderdale by the sea', 'west park', 'pembroke park'],
    'miami-dade': ['miami', 'miami beach', 'hialeah', 'miami gardens', 'north miami', 'north miami beach', 'homestead',
      'doral', 'kendall', 'cutler bay', 'aventura', 'coral gables', 'miami lakes', 'opa-locka', 'opa locka',
      'sunny isles beach', 'palmetto bay', 'pinecrest', 'sweetwater', 'florida city', 'hialeah gardens',
      'miami springs', 'south miami', 'key biscayne', 'surfside', 'bal harbour', 'north bay village'],
    'palm beach': ['west palm beach', 'boca raton', 'boynton beach', 'delray beach', 'lake worth', 'lake worth beach',
      'wellington', 'jupiter', 'palm beach gardens', 'royal palm beach', 'greenacres', 'riviera beach', 'lantana',
      'palm springs', 'belle glade', 'loxahatchee', 'north palm beach', 'palm beach', 'tequesta', 'juno beach'],
  };
  function countyFor(countyText, city) {
    const c = lower(countyText);
    if (/broward/.test(c)) return 'broward';
    if (/dade|miami/.test(c)) return 'miami-dade';
    if (/palm beach/.test(c)) return 'palm beach';
    const ct = lower(city);
    for (const [county, cities] of Object.entries(COUNTY_CITIES)) if (cities.includes(ct)) return county;
    return '';
  }
  SOR.countyFor = countyFor;

  // Craigslist South Florida sub-areas, matched by visible text on the "choose area" step.
  SOR.subareaCandidates = function (county) {
    if (county === 'broward') return ['broward county', 'broward'];
    if (county === 'miami-dade') return ['miami / dade county', 'miami / dade', 'miami-dade', 'dade'];
    if (county === 'palm beach') return ['palm beach county', 'palm beach co', 'palm beach'];
    return [];
  };

  function mapHousingType(t, d) {
    if (/town ?h(ouse|ome)/.test(t)) return 'townhouse';
    if (/villa/.test(t)) return 'townhouse';
    if (/condo|co-?op/.test(t)) return 'condo';
    if (/duplex/.test(t)) return 'duplex';
    if (/triplex|quad|multi|apartment|efficiency|garden|high ?rise|mid ?rise/.test(t)) return 'apartment';
    if (/manufact|mobile/.test(t)) return 'manufactured';
    if (/loft/.test(t)) return 'loft';
    if (/single|detached|house|home/.test(t)) return 'house';
    if (/town ?h(ouse|ome)/.test(d)) return 'townhouse';
    if (/\bcondo\b/.test(d)) return 'condo';
    if (/single[- ]family|\bhouse\b|\bpool home\b/.test(d)) return 'house';
    return 'apartment';
  }

  // ════════════════════════════════════════════════════════════
  // Listing analysis — every claim here must be backed by the listing data.
  // ════════════════════════════════════════════════════════════
  SOR.analyze = function (l, settings) {
    l = l || {};
    const s = SOR.mergeSettings(settings);
    const o = l.overrides || {};
    const map = detailMap(l);
    const desc = str(l.description);
    const descL = desc.toLowerCase();
    const detailsText = Object.entries(map).map(([k, v]) => `${k}: ${v}`).join(' | ');
    const blob = lower([desc, l.propertyType, l.subdivision, l.pool, l.cooling, l.parking, detailsText].join(' | '));
    const year = new Date().getFullYear();

    const f = { mls: str(l.mlsNumber), source: l.source || 'mls' };
    f.beds = parseBeds(l.bedrooms !== undefined && l.bedrooms !== '' ? l.bedrooms : detail(map, /^bedrooms?( total)?$/));
    f.baths = parseBaths(l.bathrooms !== undefined && l.bathrooms !== '' ? l.bathrooms : detail(map, /^bathrooms?( total)?$/));
    f.sqft = toNum(l.sqft);
    if (f.sqft !== null && f.sqft < 150) f.sqft = null;
    f.rent = toNum(l.price);
    f.city = niceCase(l.city);
    f.state = (str(l.state) || 'FL').toUpperCase();
    f.zip = (str(l.zip).match(/\d{5}/) || [''])[0];
    f.street = str(l.streetAddress);
    const sub = niceCase(l.subdivision);
    f.subdivision = /^(n\/?a|none|unknown|not applicable|0|no)$/i.test(sub) ? '' : sub;
    f.county = countyFor(l.county || detail(map, /county/), f.city);
    f.yearBuilt = toNum(l.yearBuilt || detail(map, /year built/));
    if (f.yearBuilt && (f.yearBuilt < 1800 || f.yearBuilt > year + 2)) f.yearBuilt = null;

    // Housing type
    const typeText = lower([l.propertyType, detail(map, /property (sub )?type|^style$|architectural style/)].join(' '));
    f.type = SOR.CL.housing.includes(o.housingType) ? o.housingType : mapHousingType(typeText, descL);
    f.typeSource = o.housingType ? 'override' : (typeText.trim() ? 'listing' : 'guess');
    f.isVilla = /villa/.test(typeText);
    const condoLike = f.type === 'condo' || f.type === 'apartment';

    // Garage — "verified" means the listing actually says so.
    const parkText = lower([l.parking, detail(map, /garage|parking|carport/)].join(' '));
    const garageSpaces = toNum(detail(map, /garage spaces?|garage ?space|garage total/));
    const garageYes = /^(yes|y|true|attached|detached)\b/.test(lower(detail(map, /garage yn|attached garage|^garage$/)));
    const garageText = descL + ' ' + parkText;
    const explicitGarage = /\b(\d|one|two|three|four)[- ]?car garage|attached garage|detached garage|oversized garage|private garage|garage door/.test(garageText);
    const genericGarage = /garage/.test(parkText) && !/no garage|garage:?\s*no\b|parking garage|garage parking|community garage/.test(parkText);
    const noGarage = /\bno garage\b|garage:?\s*no\b/.test(garageText);
    f.hasGarage = !noGarage && (explicitGarage || (!condoLike && ((garageSpaces || 0) > 0 || garageYes || genericGarage)));
    const carMatch = descL.match(/\b(\d|one|two|three|four)[- ]?car garage/);
    const words = { one: 1, two: 2, three: 3, four: 4 };
    f.garageSpaces = f.hasGarage ? ((garageSpaces || 0) > 0 ? garageSpaces : (carMatch ? (words[carMatch[1]] || +carMatch[1]) : null)) : null;
    f.garageDetached = f.hasGarage && /detached garage/.test(garageText) && !/attached garage/.test(garageText.replace(/detached garage/g, ''));

    // Pool
    const poolText = lower([l.pool, detail(map, /pool/)].join(' '));
    const poolNone = !poolText.trim() || /^(none|no|n\/a)\b/.test(poolText.trim());
    const commRe = /community|association|clubhouse|resort|common|shared|club\b/;
    const privDesc = f.type === 'house'
      ? /private pool|own (private )?pool|pool home|heated pool|screened pool|salt ?water pool|in[- ]ground pool|your own pool/
      : /private pool|own (private )?pool|private heated pool/;
    if (privDesc.test(descL)) f.pool = 'private';
    else if (!poolNone && /private|in[- ]?ground|heated|screen|salt|gunite|fiberglass|above ground/.test(poolText) && !commRe.test(poolText)) f.pool = 'private';
    else if (!poolNone && commRe.test(poolText)) f.pool = 'community';
    else if (/community pool|resort[- ]style pool|clubhouse.{0,60}pool|pool.{0,30}clubhouse|amenities.{0,80}\bpool/.test(descL)) f.pool = 'community';
    else if (!poolNone && /pool|yes/.test(poolText)) f.pool = f.type === 'house' ? 'private' : 'community';
    else if (condoLike && /\bpools?\b/.test(descL)) f.pool = 'community';
    else f.pool = null;

    // Pets
    const petText = lower(l.petsAllowed || detail(map, /pets? allowed|pet policy|^pets$/));
    if (petText) f.petsAllowed = /^no\b|not allowed|no pets/.test(petText) ? false : true;
    else if (/no pets|pets not allowed/.test(descL)) f.petsAllowed = false;
    else if (/pets? (are )?(ok|allowed|welcome|friendly)|pet[- ]friendly|dogs? (are )?(ok|allowed|welcome)/.test(descL)) f.petsAllowed = true;
    else f.petsAllowed = null;

    // Furnished / cooling
    const furn = lower(l.furnished || detail(map, /furnished/));
    f.furnished = /^(yes|furnished|fully|partial)/.test(furn) && !/unfurnished/.test(furn);
    const cool = lower(l.cooling || detail(map, /cooling|air condition/));
    f.centralAir = /central/.test(cool) || /central (a\/c|ac|air)/.test(descL);
    f.hasAC = f.centralAir || /a\/c|air|wall|window|electric|yes|ceiling/.test(cool);

    // Laundry — default to w/d in unit unless the listing says otherwise.
    const laundryFeat = lower(detail(map, /laundry/));
    const appliances = lower([detail(map, /appliances|equipment/), detail(map, /interior features/)].join(' '));
    const lAll = laundryFeat + ' ' + descL;
    const appliancesWD = /washer/.test(appliances) && /dryer/.test(appliances);
    const descWD = /washer (and|&|\/) ?dryer (included|in unit|in the unit|inside)|w\/d (included|in unit)|in[- ]unit (laundry|washer)|full[- ]size washer/.test(descL);
    const hookups = /hook[- ]?ups?\b|hookup/.test(lAll);
    const shared = /common area|community laundry|laundry facilit|shared laundry|coin|laundry (room )?(in|on) (the )?(building|bldg|site|each floor|every floor)|on[- ]site laundry|central laundry|laundry on (site|premises)|common laundry/.test(lAll);
    const noLaundry = /no laundry/.test(lAll);
    const inUnitText = /in[- ]unit|inside|in residence|in unit|utility room|in garage|laundry closet|laundry room|washer|dryer/.test(laundryFeat);
    let laundry; let lSrc = 'listing';
    if (SOR.CL.laundry.includes(o.laundry)) { laundry = o.laundry; lSrc = 'override'; }
    else if (appliancesWD || descWD) laundry = 'w/d in unit';
    else if (noLaundry) laundry = 'no laundry on site';
    else if (hookups) laundry = 'w/d hookups';
    else if (shared && !/in[- ]unit|inside|in residence/.test(laundryFeat)) laundry = condoLike ? 'laundry in bldg' : 'laundry on site';
    else if (inUnitText) laundry = 'w/d in unit';
    else { laundry = s.defaultLaundry; lSrc = 'default'; }
    f.laundry = laundry;
    f.laundrySource = lSrc;

    // Parking — off-street unless a garage is verified.
    if (SOR.CL.parking.includes(o.parking)) { f.parking = o.parking; f.parkingSource = 'override'; }
    else if (f.hasGarage) { f.parking = f.garageDetached ? 'detached garage' : 'attached garage'; f.parkingSource = 'listing'; }
    else { f.parking = s.defaultParking; f.parkingSource = 'default'; }

    // HOA
    const assocYN = lower(detail(map, /association yn|hoa yn|has hoa|^association$|^hoa$/));
    const assocFee = toNum(detail(map, /association fee|hoa fee|hoa dues/));
    f.noHoa = (/\bno\s+hoa\b|\bnon[- ]?hoa\b|\bno\s+(home ?owners'?s?\s+)?association\b|without (an? )?hoa\b|hoa[- ]free/.test(descL) || /^no\b/.test(assocYN))
      && !(assocFee > 0);

    // Type label for titles/body
    const typeLabels = {
      house: 'Home', townhouse: f.isVilla ? 'Villa' : 'Townhome', condo: 'Condo', apartment: f.beds === 0 ? 'Studio' : 'Apartment',
      duplex: 'Duplex', manufactured: 'Mobile Home', loft: 'Loft', flat: 'Apartment', 'in-law': 'Guest House',
      'cottage/cabin': 'Cottage', 'assisted living': 'Residence', land: 'Lot',
    };
    f.typeLabel = typeLabels[f.type] || 'Rental';
    if (f.type === 'house' && f.pool === 'private') f.typeLabel = 'Pool Home';
    f.typeShort = { Townhome: 'TH', Apartment: 'Apt', 'Pool Home': 'Pool Home', 'Mobile Home': 'Home' }[f.typeLabel] || f.typeLabel;

    // ── Hooks (strongest real selling points, priority order) ──
    const H = [];
    const add = (key, short, bullet, emoji) => H.push({ key, short, bullet, emoji });
    const waterYN = lower(detail(map, /waterfront( yn)?$/));
    const viewText = lower(detail(map, /^view/));
    if (f.noHoa) add('nohoa', 'No HOA', 'No HOA — no association application or approval wait', '✅');
    if (f.pool === 'private') add('pool', 'Private Pool', 'Private pool', '🏊');
    if (/waterfront|water ?front|lake ?front|canal ?front|ocean ?front|on the (lake|canal|water|intracoastal)|intracoastal|boat dock|deep water|private dock/.test(descL) || /^yes/.test(waterYN)) {
      add('water', 'Waterfront', 'Waterfront', '🌊');
    } else {
      const vm = (viewText + ' ' + descL).match(/\b(lake|water|ocean|canal|golf|intracoastal|bay) views?\b/) ||
        (/\b(lake|water|ocean|canal|golf|intracoastal|bay)\b/.test(viewText) ? viewText.match(/\b(lake|water|ocean|canal|golf|intracoastal|bay)\b/) : null);
      if (vm) { const v = niceCase(vm[1]); add('view', `${v} View`, `${v} view`, '🌅'); }
    }
    if (f.hasGarage) {
      const g = f.garageSpaces ? `${f.garageSpaces}-Car Garage` : 'Garage';
      add('garage', g, f.garageSpaces ? `${f.garageSpaces}-car garage` : 'Garage parking', '🚗');
    }
    const fenceText = lower(detail(map, /fenc/));
    if (/fenced|privacy fence|fully fenced/.test(descL) || (fenceText && !/^(no|none)\b/.test(fenceText))) add('fenced', 'Fenced Yard', 'Fenced yard', '🏡');
    if (/renovat|remodel/.test(descL)) add('updated', 'Renovated', 'Renovated interior', '✨');
    else if (/updated|upgraded|brand[- ]new (kitchen|floors?|flooring|appliances|bath)|new (kitchen|floors|flooring|appliances|cabinets|countertops)|freshly painted|quartz|granite/.test(descL)) add('updated', 'Updated', 'Updated interior', '✨');
    if (f.yearBuilt && f.yearBuilt >= year - 3) add('new', 'New Construction', `New construction (built ${f.yearBuilt})`, '🆕');
    else if (f.yearBuilt && f.yearBuilt >= year - 10) add('new', 'Newer Build', `Built in ${f.yearBuilt}`, '🆕');
    if (f.laundry === 'w/d in unit' && f.laundrySource !== 'default') add('wd', 'Washer/Dryer', 'Washer & dryer in unit', '🧺');
    if (f.petsAllowed === true) add('pets', 'Pets OK', 'Pet friendly (ask about restrictions)', '🐶');
    if (/gated|guard[- ]gated|24.?(hour|hr) (security|guard)|guard house/.test(blob)) add('gated', 'Gated', 'Gated community', '🔐');
    if (/impact (windows|glass|doors)|hurricane (impact|windows|shutters)|accordion shutters|storm shutters/.test(blob)) add('impact', 'Impact Windows', 'Impact windows / hurricane protection', '🌀');
    if (/(large|huge|big|oversized|spacious|deep) (back ?)?yard|(large|huge|oversized) lot/.test(descL) && !H.some(h => h.key === 'fenced')) add('yard', 'Huge Yard', 'Large yard', '🌳');
    if (/\bden\b|home office|office space|bonus room/.test(descL)) add('office', 'Office/Den', 'Den / home office space', '💻');
    if (f.furnished) add('furnished', 'Furnished', 'Furnished', '🛋️');
    if (f.pool === 'community') add('cpool', 'Community Pool', 'Community pool', '🏊');
    if (/all utilities included|utilities (are )?included/.test(descL)) add('util', 'Utilities Incl', 'Utilities included', '💡');
    else if (/water (is )?included|includes water/.test(descL)) add('util', 'Water Incl', 'Water included', '💧');
    if (/lawn (care|maintenance|service)( is)? included|includes lawn/.test(descL)) add('lawn', 'Lawn Care Incl', 'Lawn care included', '🌿');
    if (/(minutes?|mins?|steps|blocks?|walk(ing distance)?|close|near) (away )?(from |to )?(the )?beach/.test(descL)) add('beach', 'Near Beach', 'Close to the beach', '🏖️');
    if (/available (now|immediately|today)|move[- ]in ready|ready (for|to) (move|occupy)/.test(descL)) add('now', 'Move-In Ready', 'Move-in ready', '🔑');
    f.hooks = H;
    f.spacious = !!(f.sqft && ((f.beds && f.sqft >= f.beds * 550 + 300) || f.sqft >= 2200));
    return f;
  };

  // ════════════════════════════════════════════════════════════
  // Titles
  // ════════════════════════════════════════════════════════════
  const CITY_ABBR = {
    'Fort Lauderdale': 'Ft Lauderdale', 'North Miami Beach': 'N Miami Beach', 'North Lauderdale': 'N Lauderdale',
    'Lauderdale Lakes': 'Laud Lakes', 'Lauderdale By The Sea': 'LBTS', 'West Palm Beach': 'W Palm Beach',
    'Hallandale Beach': 'Hallandale', 'Deerfield Beach': 'Deerfield', 'Pompano Beach': 'Pompano',
    'Palm Beach Gardens': 'PB Gardens', 'Royal Palm Beach': 'Royal Palm', 'Boynton Beach': 'Boynton',
    'Delray Beach': 'Delray', 'Southwest Ranches': 'SW Ranches', 'Dania Beach': 'Dania', 'Lighthouse Point': 'Lighthouse Pt',
    'Sunny Isles Beach': 'Sunny Isles', 'Lake Worth Beach': 'Lake Worth', 'Coconut Creek': 'Coconut Creek',
  };
  function abbrCity(c) {
    if (CITY_ABBR[c]) return CITY_ABBR[c];
    return c.replace(/^North /, 'N ').replace(/^South /, 'S ').replace(/^West /, 'W ').replace(/^East /, 'E ')
      .replace(/^Fort /, 'Ft ').replace(/^Saint /, 'St ');
  }
  function fmtBaths(b) { return b === null || b === undefined ? '' : String(Math.round(b * 2) / 2); }
  function bedBath(f, long) {
    if (f.beds === 0) return f.baths && f.baths > 1 ? `Studio/${fmtBaths(f.baths)}BA` : 'Studio';
    if (f.beds && f.baths) return long ? `${f.beds}BR/${fmtBaths(f.baths)}BA` : `${f.beds}/${fmtBaths(f.baths)}`;
    if (f.beds) return `${f.beds}BR`;
    return '';
  }
  function J(...parts) {
    return parts.filter(p => p !== undefined && p !== null && p !== false && String(p).trim() !== '').join(' ')
      .replace(/\s+/g, ' ')
      .replace(/([–|+•])\s+(?=[–|+•])/g, '')
      .replace(/^[\s–|+•,]+|[\s–|+•,]+$/g, '')
      .trim();
  }

  const DECOR = {
    emoji: { lead: ['🌴', '🔥', '✨', '☀️', '🏡', '⭐'], sep: '–' },
    symbols: { lead: ['★', '✪', '☀', '◆', '✦'], sep: '–' },
    plain: { lead: [''], sep: '–' },
  };
  const ADJ = ['Beautiful', 'Gorgeous', 'Charming', 'Lovely', 'Stunning', 'Bright'];

  const TITLE_TEMPLATES = [
    c => J(c.e1, c.h1 && c.cap(c.h1) + '!', c.bb, c.type, c.h2 && 'w/ ' + c.h2, c.city && '– ' + c.city),
    c => J(c.bb, c.type, c.city && 'in ' + c.city, c.h1 && (c.e1 || '–'), c.h1, c.h2 && '+ ' + c.h2, !c.h1 && c.e1),
    c => J(c.e1, c.adj, c.bb, c.type, c.h1 && '| ' + c.h1, c.h2 && '| ' + c.h2, c.city && '| ' + c.city),
    c => J(c.e1, c.city, c.bbLong, c.type, c.list && '– ' + c.list, c.e2),
    c => J(c.e1, c.h1 && c.cap(c.h1) + (c.e1 ? '' : '!'), c.h1 && c.e1, c.adj, c.bb, c.type, c.city && 'for Rent in ' + c.city),
    c => J(c.e1, c.adj, c.type, c.city && 'for Rent in ' + c.city, c.bb && '– ' + c.bb, c.h1 && '– ' + c.h1),
  ];

  SOR.buildTitles = function (f, style, seed) {
    const st = DECOR[style] ? style : 'emoji';
    const sd = seed || hash(f.mls || f.city || 'x');
    const hooks = f.hooks.filter(h => !(h.key === 'pool' && f.typeLabel === 'Pool Home')).map(h => h.short);
    const baseAdj = f.spacious ? ['Spacious'].concat(ADJ) : ADJ;
    const out = [];
    TITLE_TEMPLATES.forEach((tpl, i) => {
      const e1 = st === 'emoji' && i % 2 === 0 && f.hooks[0] ? f.hooks[0].emoji : pick(DECOR[st].lead, sd, i);
      const e2 = st === 'emoji' ? pick(DECOR[st].lead, sd, i + 3) : e1;
      const base = {
        e1, e2, bb: bedBath(f, false), bbLong: bedBath(f, true), type: f.typeLabel, city: f.city,
        adj: pick(baseAdj, sd, i), h1: hooks[0] || '', h2: hooks[1] || '', h3: hooks[2] || '',
        cap: (h) => (h.length <= 14 ? h.toUpperCase() : h),
      };
      if (base.bb === 'Studio' && base.type === 'Studio') base.type = 'Apartment';
      const levels = [
        {},
        { h3: '' },
        { h3: '', city: abbrCity(f.city) },
        { h3: '', h2: '', city: abbrCity(f.city) },
        { h3: '', h2: '', city: abbrCity(f.city), adj: '' },
        { h3: '', h2: '', city: abbrCity(f.city), adj: '', type: f.typeShort, e2: '' },
      ];
      for (const lv of levels) {
        const c = Object.assign({}, base, lv);
        const listParts = [c.h1, c.h2, c.h3].filter(Boolean);
        c.list = listParts.length > 1 ? listParts.slice(0, -1).join(', ') + ' & ' + listParts[listParts.length - 1] : listParts[0] || '';
        const t = tpl(c);
        if (t && t.length <= SOR.TITLE_MAX) { out.push(t); return; }
      }
      const fallback = SOR.trimTitle(tpl(Object.assign({}, base, levels[levels.length - 1], { list: '' })));
      if (fallback) out.push(fallback);
    });
    const list = unique(out.filter(t => t.replace(/[^A-Za-z0-9]/g, '').length >= 6));
    if (!list.length) list.push(st === 'plain' ? 'South Florida Rental – Call or Text Today' : `${DECOR[st].lead[0]} South Florida Rental – Call or Text Today`.trim());
    const r = sd % list.length;
    return list.slice(r).concat(list.slice(0, r));
  };

  // ════════════════════════════════════════════════════════════
  // Description
  // ════════════════════════════════════════════════════════════
  const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
  const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
  const AGENT_ONLY = /\bmls\b|listing agent|list agent|buyer'?s?'? agent|co-?broke|commission|compensation|showing ?time|showings?\b|lockbox|lock box|\bsupra\b|call (the )?(listing )?(agent|office|la)\b|text (the )?(listing )?agent|contact (the )?(listing )?(agent|office)|\bbroker\b|\bbonus\b|agent remarks|see (agent|broker)|not responsible|verify all|information (is )?deemed|buyer to verify|tenant to verify/i;

  SOR.cleanRemarks = function (text) {
    let t = str(text).replace(/\s+/g, ' ');
    if (!t) return '';
    const letters = t.replace(/[^A-Za-z]/g, '');
    if (letters.length > 20 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) t = sentenceCase(t);
    t = t.replace(EMAIL_RE, '').replace(URL_RE, '').replace(PHONE_RE, '');
    const sentences = t.match(/[^.!?]+[.!?]*/g) || [t];
    return sentences.map(x => x.trim()).filter(x => x && x.replace(/[^A-Za-z]/g, '').length > 2 && !AGENT_ONLY.test(x))
      .join(' ').replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  };

  const ICONS = {
    emoji: { lead: '🌴', pin: '📍', bed: '🛏️', bath: '🛁', size: '📐', money: '💰', star: '✨', check: '✅', about: '📝', phone: '📞' },
    symbols: { lead: '★', pin: '◆', bed: '', bath: '', size: '', money: '', star: '★', check: '✔', about: '◆', phone: '☎' },
    plain: { lead: '', pin: '', bed: '', bath: '', size: '', money: '', star: '', check: '•', about: '', phone: '' },
  };

  SOR.buildBody = function (f, settings, seed) {
    const s = SOR.mergeSettings(settings);
    const ic = ICONS[s.titleStyle] || ICONS.emoji;
    const sd = seed || hash(f.mls || f.city || 'x');
    const lines = [];
    const adj = f.spacious ? 'Spacious' : pick(ADJ, sd, 1);
    const bedsWords = f.beds === 0 ? 'studio' : [f.beds ? `${f.beds} bed` : '', f.baths ? `${fmtBaths(f.baths)} bath` : ''].filter(Boolean).join(' / ');
    const typeWord = f.beds === 0 && f.typeLabel === 'Studio' ? 'apartment' : f.typeLabel.toLowerCase();
    lines.push(J(ic.lead, `${adj} ${bedsWords} ${typeWord} for rent${f.city ? ' in ' + f.city : ''}!`).replace(/\s+/g, ' '));
    const top = f.hooks.slice(0, 3).map(h => h.short);
    if (top.length) lines.push(J(ic.star, top.join(' • ')));
    lines.push('');

    const loc = [f.city, [f.state, f.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (loc) lines.push(J(ic.pin, loc + (f.subdivision ? ` (${f.subdivision})` : '')));
    const specs = [];
    if (f.beds === 0) specs.push(J(ic.bed, 'Studio'));
    else if (f.beds) specs.push(J(ic.bed, `${f.beds} Bedroom${f.beds === 1 ? '' : 's'}`));
    if (f.baths) specs.push(J(ic.bath, `${fmtBaths(f.baths)} Bathroom${f.baths === 1 ? '' : 's'}`));
    if (f.sqft) specs.push(J(ic.size, `${Math.round(f.sqft).toLocaleString('en-US')} sq ft`));
    if (specs.length) lines.push(specs.join('  |  '));
    if (f.rent) lines.push(J(ic.money, `Rent: ${SOR.money(f.rent)}/month`));
    lines.push('');

    const bullets = f.hooks.map(h => h.bullet);
    if (f.centralAir) bullets.push('Central A/C');
    if (f.parkingSource === 'default' && f.parking === 'off-street parking') bullets.push('Off-street parking');
    if (f.laundry === 'w/d hookups' && f.laundrySource !== 'default') bullets.push('Washer/dryer hookups');
    if ((f.laundry === 'laundry on site' || f.laundry === 'laundry in bldg') && f.laundrySource !== 'default') bullets.push('Laundry on site');
    if (bullets.length) {
      lines.push(J(ic.star, 'HIGHLIGHTS'));
      unique(bullets).slice(0, 10).forEach(b => lines.push(`${ic.check} ${b}`.trim()));
      lines.push('');
    }

    const remarks = SOR.cleanRemarks(f.remarks);
    if (remarks) {
      lines.push(J(ic.about, 'ABOUT THIS HOME'));
      lines.push(remarks);
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  SOR.composeBody = function (body, agent, settings) {
    const s = SOR.mergeSettings(settings);
    const a = agent || SOR.getAgent(s);
    const ic = ICONS[s.titleStyle] || ICONS.emoji;
    const phone = SOR.formatPhone(a.phone);
    const first = str(a.name).split(/\s+/)[0] || 'us';
    const parts = [str(body)];
    if (phone) parts.push(J(ic.phone, `Call or text ${first} at ${phone} to schedule a showing today!`));
    if (s.includeKeywords && str(s.keywords)) parts.push(s.titleStyle === 'plain' ? SOR.stripEmoji(s.keywords) : str(s.keywords));
    const rule = s.titleStyle === 'plain' ? '------------------------------' : '━━━━━━━━━━━━━━━━━━━━';
    parts.push([rule, `${a.name}${a.title ? ', ' + a.title : ''}`, s.brokerage, phone && `Call or Text: ${phone}`, a.email]
      .filter(Boolean).join('\n'));
    return parts.filter(Boolean).join('\n\n');
  };

  // ════════════════════════════════════════════════════════════
  // Ads
  // ════════════════════════════════════════════════════════════
  SOR.analyzeFull = function (l, settings) {
    const f = SOR.analyze(l, settings);
    f.remarks = str(l && l.description);
    return f;
  };

  SOR.makeTemplateAd = function (l, settings) {
    const s = SOR.mergeSettings(settings);
    const f = SOR.analyzeFull(l, s);
    const seed = hash(`${f.mls}:${(l && l.posted && l.posted.clCount) || 0}`);
    const titleOptions = SOR.buildTitles(f, s.titleStyle, seed);
    return {
      title: titleOptions[0], titleOptions, body: SOR.buildBody(f, s, seed),
      source: 'template', edited: false, style: s.titleStyle, updatedAt: new Date().toISOString(),
    };
  };

  // A saved ad (AI or hand edited) wins; otherwise a fresh template ad is generated so
  // style/default changes in Settings apply immediately.
  SOR.getAd = function (l, settings) {
    if (l && l.ad && str(l.ad.title) && str(l.ad.body)) {
      const t = SOR.makeTemplateAd(l, settings).titleOptions;
      return Object.assign({}, l.ad, { titleOptions: unique([l.ad.title].concat(l.ad.titleOptions || [], t)) });
    }
    return SOR.makeTemplateAd(l, settings);
  };

  // Facts passed to the AI writer. No agent/contact data — that is appended locally.
  SOR.aiFacts = function (l, settings) {
    const f = SOR.analyzeFull(l, settings);
    return {
      city: f.city, state: f.state, zip: f.zip, county: f.county, community: f.subdivision || undefined,
      property_type: f.typeLabel, bedrooms: f.beds, bathrooms: f.baths, square_feet: f.sqft || undefined,
      rent_per_month: f.rent || undefined, year_built: f.yearBuilt || undefined,
      verified_selling_points: f.hooks.map(h => h.bullet),
      laundry: f.laundrySource === 'default' ? undefined : f.laundry,
      parking: f.parkingSource === 'default' ? 'off-street parking' : f.parking,
      pets_allowed: f.petsAllowed === null ? 'ask' : f.petsAllowed,
      furnished: f.furnished || undefined,
      central_ac: f.centralAir || undefined,
      mls_remarks: SOR.cleanRemarks(f.remarks) || undefined,
    };
  };

  SOR.aiPrompt = function (style) {
    const styleRule = {
      emoji: 'Use 1–2 eye-catching emoji in each title (e.g. 🌴 🔥 ✨ 🏊 ✅) and emoji bullets in the body.',
      symbols: 'Do not use emoji. You may use simple symbols like ★ ✔ ◆ in titles and ✔ bullets in the body.',
      plain: 'Do not use emoji or decorative symbols anywhere.',
    }[style] || '';
    return [
      'You write Craigslist "apartments / housing for rent" ads for Sun Ocean Realty in South Florida.',
      'Goal: the most clicks and calls possible while staying 100% truthful.',
      'Rules:',
      '- Use ONLY the facts provided. Never invent amenities, sizes, prices, specials, or move-in dates.',
      `- Titles: maximum ${SOR.TITLE_MAX} characters each (emoji count as 2). Lead with the strongest verified selling point (e.g. NO HOA, private pool, garage, fenced yard, renovated, waterfront). Include beds/baths shorthand like 3/2 and the city. Make all 5 titles clearly different from each other. One word in caps at most.`,
      `- ${styleRule}`,
      '- Body: plain text only (no HTML, no markdown, no asterisks or #). Short punchy lines. Sections: a hook line, quick facts (location, beds/baths, size, rent), a HIGHLIGHTS list, and an ABOUT THIS HOME paragraph rewritten from the MLS remarks in a warm, confident voice. 120–250 words.',
      '- Do NOT include phone numbers, emails, links, agent names, brokerage names or MLS numbers — contact info is appended automatically.',
      '- Weave in natural search phrases renters type on Craigslist (city name, "house for rent", "pool home", "pet friendly" only if pets are allowed, etc.). No keyword lists.',
      '- Fair Housing: describe the property, never the people. No references to race, color, religion, national origin, sex, disability, familial status, age, or source of income (avoid "perfect for families", "ideal for singles", "no kids", "adults only", "walking distance to church").',
      'Return JSON only: {"titles": ["…", "…", "…", "…", "…"], "body": "…"}',
    ].join('\n');
  };

  SOR.normalizeAiAd = function (raw, l, settings) {
    const s = SOR.mergeSettings(settings);
    const titles = unique((Array.isArray(raw && raw.titles) ? raw.titles : [])
      .map(t => SOR.trimTitle(String(t || '').replace(/^["'\s]+|["'\s]+$/g, '')))
      .filter(t => t.length >= 10));
    let body = str(raw && raw.body)
      .replace(EMAIL_RE, '').replace(URL_RE, '').replace(PHONE_RE, '')
      .replace(/\*\*|__|^#+\s*/gm, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n').trim();
    if (s.titleStyle === 'plain') body = SOR.stripEmoji(body);
    if (!titles.length || body.length < 80) throw new Error('The AI response was incomplete. Try again.');
    const fallback = SOR.makeTemplateAd(l, s).titleOptions;
    return {
      title: titles[0], titleOptions: unique(titles.concat(fallback)), body,
      source: 'ai', edited: false, style: s.titleStyle, updatedAt: new Date().toISOString(),
    };
  };

  // ════════════════════════════════════════════════════════════
  // Craigslist fill plan — what goes into which form control.
  // source: listing | default | rule | agent | override | guess
  // ════════════════════════════════════════════════════════════
  SOR.clPlan = function (l, settings, agent, ad) {
    const s = SOR.mergeSettings(settings);
    const f = SOR.analyzeFull(l, s);
    const a = agent || SOR.getAgent(s);
    const theAd = ad || SOR.getAd(l, s);
    const P = [];
    const add = (o) => P.push(Object.assign({ kind: 'text', source: 'listing' }, o));
    const always = s.alwaysPetsAndAC;
    const phone = SOR.formatPhone(a.phone);
    const body = SOR.composeBody(theAd.body, a, s);

    add({ key: 'title', label: 'Posting title', names: ['PostingTitle', 'posting_title'], labels: ['posting title'], value: theAd.title, display: `${theAd.title.length}/${SOR.TITLE_MAX}` });
    add({ key: 'price', label: 'Rent', names: ['price', 'Ask', 'rent'], labels: ['price', 'monthly rent', 'rent amount'], value: f.rent ? String(Math.round(f.rent)) : '', display: SOR.money(f.rent) });
    add({ key: 'area', label: 'City / neighborhood', names: ['GeographicArea', 'geographic_area'], labels: ['city or neighborhood', 'specific location'], value: f.city });
    add({ key: 'postal', label: 'ZIP code', names: ['postal', 'postal_code', 'zip', 'zipcode'], labels: ['zip code', 'postal code', 'zip'], value: f.zip });
    add({ key: 'body', label: 'Description', kind: 'textarea', names: ['PostingBody', 'posting_body'], labels: ['description', 'posting body'], value: body, display: `${body.length} characters` });
    add({ key: 'sqft', label: 'Square feet', names: ['surface_area', 'Sqft', 'sqft', 'ft2'], labels: ['sqft', 'ft2', 'square feet', 'surface area'], value: f.sqft ? String(Math.round(f.sqft)) : '', optional: true });
    add({ key: 'housing_type', label: 'Housing type', kind: 'select', names: ['housing_type'], labels: ['housing type'], value: f.type, options: SOR.synonyms(f.type), sig: ['townhouse', 'duplex', 'condo', 'apartment'], source: f.typeSource });
    add({ key: 'laundry', label: 'Laundry', kind: 'select', names: ['laundry'], labels: ['laundry'], value: f.laundry, options: SOR.synonyms(f.laundry), sig: ['w/d in unit', 'laundry on site', 'w/d hookups'], source: f.laundrySource });
    add({ key: 'parking', label: 'Parking', kind: 'select', names: ['parking'], labels: ['parking'], value: f.parking, options: SOR.synonyms(f.parking), sig: ['off-street parking', 'street parking', 'carport'], source: f.parkingSource });
    add({ key: 'bedrooms', label: 'Bedrooms', kind: 'number', names: ['Bedrooms', 'bedrooms'], labels: ['bedrooms', 'beds'], value: f.beds, display: f.beds === 0 ? 'studio' : String(f.beds ?? '') });
    add({ key: 'bathrooms', label: 'Bathrooms', kind: 'number', names: ['bathrooms', 'Bathrooms'], labels: ['bathrooms', 'baths'], value: f.baths, display: fmtBaths(f.baths) });
    add({ key: 'rent_period', label: 'Rent period', kind: 'select', names: ['rent_period'], labels: ['rent period'], value: 'monthly', options: SOR.synonyms('monthly'), sig: ['monthly', 'weekly', 'daily'], source: 'default', optional: true });
    add({ key: 'available', label: 'Available on', kind: 'date', names: ['movein_date', 'moveindate', 'available_on', 'availability', 'available_date'], labels: ['available on', 'availability', 'move-in date', 'move in date', 'date available'], value: new Date().toISOString().slice(0, 10), display: 'today', source: 'default', optional: true });
    add({ key: 'pets_cat', label: 'Cats OK', kind: 'checkbox', names: ['pets_cat'], labels: ['cats are ok', 'cats ok', 'cats'], value: always || f.petsAllowed === true, source: always ? 'rule' : 'listing' });
    add({ key: 'pets_dog', label: 'Dogs OK', kind: 'checkbox', names: ['pets_dog'], labels: ['dogs are ok', 'dogs ok', 'dogs'], value: always || f.petsAllowed === true, source: always ? 'rule' : 'listing' });
    add({ key: 'ac', label: 'Air conditioning', kind: 'checkbox', names: ['airconditioning', 'air_conditioning'], labels: ['air conditioning'], value: always || f.hasAC, source: always ? 'rule' : 'listing', optional: true });
    if (f.furnished) add({ key: 'furnished', label: 'Furnished', kind: 'checkbox', names: ['is_furnished', 'furnished'], labels: ['furnished'], labelExact: true, value: true, optional: true });
    if (s.showPhone && phone) {
      add({ key: 'show_phone', label: 'Show my phone number', kind: 'checkbox', names: ['show_phone_ok'], labels: ['show my phone number', 'show phone'], value: true, source: 'agent', optional: true });
      add({ key: 'calls_ok', label: 'Phone calls OK', kind: 'checkbox', names: ['contact_phone_ok'], labels: ['phone calls ok', 'calls ok'], value: true, source: 'agent', optional: true });
      add({ key: 'texts_ok', label: 'Text/SMS OK', kind: 'checkbox', names: ['contact_text_ok'], labels: ['text/sms ok', 'texts ok', 'text ok', 'sms ok'], value: true, source: 'agent', optional: true });
      add({ key: 'contact_phone', label: 'Phone number', names: ['contact_phone'], labels: ['phone number'], labelExact: true, value: phone, source: 'agent', optional: true });
      add({ key: 'contact_name', label: 'Contact name', names: ['contact_name'], labels: ['contact name'], value: a.name, source: 'agent', optional: true });
    }
    if (a.email) add({ key: 'email', label: 'Email', names: ['FromEMail', 'from_email', 'email'], labels: ['email', 'your email address'], labelExact: true, value: a.email, source: 'agent', onlyIfEmpty: true, optional: true });
    if (s.showStreet && f.street) add({ key: 'street', label: 'Street', names: ['xstreet0', 'street'], labels: ['street'], labelExact: true, value: f.street, optional: true });
    add({ key: 'city', label: 'City (map)', names: ['city'], labels: ['city'], labelExact: true, value: f.city, optional: true });
    add({ key: 'region', label: 'State (map)', kind: 'any', names: ['region', 'state'], labels: ['state'], labelExact: true, value: f.state, options: [f.state.toLowerCase(), 'florida'], optional: true });
    return P;
  };

  // Craigslist forbids posting the same item more than once every 48 hours.
  SOR.REPOST_HOURS = 48;
  SOR.isRecentlyPosted = function (l, hours) {
    const at = l && l.posted && l.posted.clPublishedAt;
    return !!at && Date.now() - Date.parse(at) < (hours || SOR.REPOST_HOURS) * 3600 * 1000;
  };
  SOR.isPostable = (l) => !!l && !l.needsAttention && !SOR.isRecentlyPosted(l);
  SOR.postsToday = function (listings) {
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    let n = 0;
    (listings || []).forEach(l => ((l.posted && l.posted.clPublishLog) || []).forEach(t => { if (Date.parse(t) >= midnight.getTime()) n++; }));
    return n;
  };

  SOR.listingLabel = function (l) {
    const f = SOR.analyze(l);
    return [f.city || 'Unknown city', bedBath(f, false), f.typeLabel, f.rent ? SOR.money(f.rent) : ''].filter(Boolean).join(' · ');
  };

  SOR._test = { parseBaths, parseBeds, niceCase, sentenceCase, detailMap, mapHousingType, hash, abbrCity };
})(typeof globalThis !== 'undefined' ? globalThis : this);
