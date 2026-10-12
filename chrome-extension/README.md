# Sun Ocean Realty – Craigslist Ad Builder (v4)

Chrome extension that turns OneHome listings (and by-owner rentals) into high-click Craigslist
"apartments / housing for rent" ads, posted under either agent's name and phone.
The Facebook tools from v3 are gone; this is a OneHome → Craigslist tool only.

## Install

1. Remove the old *Sun Ocean Realty Scraper* (v3.x) at `chrome://extensions`.
2. Turn on **Developer mode** → **Load unpacked** → pick this `chrome-extension` folder.
3. Settings opens automatically. Eric Guillen (954-357-2807) and Brittini Flinn (954-408-3407)
   are already set up. Pick who is posting, either there or at the top of the popup.

## Workflow

1. **Add listings**
   - Paste one or more OneHome links into the popup and click **Import listings + photos**.
     Each link opens in a background tab, gets scraped (data + every photo), and closes.
     A OneHome search or collection link imports every property on that page.
   - Or open a OneHome property page and click the floating **Scrape** button.
   - Or click **+ By-owner** to type in a listing that isn't on the MLS and upload its photos.
2. **Polish (optional).** **Edit ad** opens the editor: pick one of six title ideas, edit the
   description, fix facts, override laundry/parking/housing type, reorder photos, or **Rewrite
   with AI**.
3. **Post.** Tick the listings you want and click **Post N on Craigslist**. The Sun Ocean panel
   on Craigslist then walks every step:
   - type → **housing offered**
   - category → **apartments / housing for rent**
   - area → the listing's county (Broward / Miami-Dade / Palm Beach)
   - ad details → **Fill this ad**, then a report of every field
   - map → continue
   - images → **Add N photos** (that listing's photos, max 24) → done with images
   - preview → checklist (and a warning if Craigslist stripped emoji from the title) → publish
   - posted → **Post next** starts the next listing in your queue

Each Craigslist posting is tied to its listing the moment you start it, so the photo step always
uploads the right listing's photos, even with several Craigslist tabs open.

## What gets filled

| Craigslist field | Value |
|---|---|
| Posting title | Best hook first (NO HOA, private pool, garage, fenced yard, renovated, waterfront…), beds/baths, type, city. Six variants, ≤ 70 chars; rotates on every repost so Craigslist doesn't see duplicate titles |
| Rent, city/neighborhood, ZIP, sq ft, bedrooms, bathrooms | From the listing (bathrooms matched by text, e.g. "2.5") |
| Housing type | house / townhouse / condo / apartment / duplex … from the MLS property type |
| Laundry | From the listing when it says; otherwise **w/d in unit** |
| Parking | **attached/detached garage** only when a garage is verified; otherwise **off-street parking** |
| Cats OK, dogs OK, air conditioning | **Always checked** |
| Rent period / available on | monthly / today |
| Show phone, calls OK, texts OK, phone, contact name | Selected agent |
| Description | Hook line, quick facts, highlights, cleaned-up MLS remarks (listing-agent phone numbers, showing instructions and compensation removed), call-to-action for the selected agent, the "we have more" keyword block, signature |

After filling, the panel lists every field: ✓ filled, • default used, ! needs you. It also
outlines in red any required field Craigslist still shows as empty, and repeats any Craigslist
error messages, so you don't have to hunt for what failed.

Fields are found by name first, then by their visible label, then by their option list, so the
filler keeps working if Craigslist renames its form fields.

## Settings

- **Agents.** Add, edit or remove agents and choose the active one.
- **Craigslist defaults.** Always check pets/AC; default laundry and parking; show phone;
  whether to put the exact street on the map (off by default, so the map uses the ZIP only).
- **Title style.** Emoji 🌴 (default), Symbols ★ (use this if Craigslist strips emoji), or plain.
- **Keyword block.** The "we have more" section under every ad (pet-friendly, fast approval,
  pool homes, no HOA, cities). Keep it to inventory you really have, and keep it as sentences:
  Craigslist ghosts ads that look like keyword stuffing.
- **AI rewriting (optional).** Paste an OpenAI API key and click **Test key & load models**. It
  picks a cheap nano/mini model available on your account. The key is stored only in this browser
  and sent only to OpenAI. The AI only gets property facts (no contact info) and must stay
  truthful and Fair-Housing compliant.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest |
| `background.js` | Photo downloads, link-import queue, OpenAI calls, Craigslist widget refresh |
| `lib/ad-engine.js` | Listing analysis, titles, descriptions, Craigslist fill plan (pure functions) |
| `lib/store.js` | Listings, photos and settings in `chrome.storage.local` |
| `content-onehome.js` | OneHome scraper (floating button + background import) |
| `craigslist.js` | Craigslist step-by-step assistant panel |
| `popup.*`, `editor.*`, `options.*`, `ui.css` | Extension pages |
