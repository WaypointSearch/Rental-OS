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
     A small OneHome window opens, reads each page (data + every photo) and closes itself when
     the batch is done. Leave it open while it works: Chrome doesn't fully draw hidden tabs, and
     OneHome's lists and photo carousels need to be drawn.
     A share link (`https://portal.onehome.com/en-US/share/…`), search or collection page imports
     every property on it. Share links open OneHome's map view: the importer opens the
     "properties list" if it's closed, scrolls it to load everything, reads property ids from the
     links and from OneHome's own data feed, and if the cards aren't links it opens each one to
     read its address. If a page can't be read, the import row shows
     **Copy debug info**; send that text to whoever maintains the extension.
   - Or open a OneHome property page and click the floating **Scrape** button.
   - Or click **+ By-owner** to type in a listing that isn't on the MLS and upload its photos.
2. **Polish (optional).** **Edit ad** opens the editor: pick one of six title ideas, edit the
   description, fix facts, override laundry/parking/housing type, reorder photos, or **Rewrite
   with AI**.
3. **Post.** Imported listings join the **posting queue** automatically, in the order they appear
   on the OneHome page. Or tick listings and click **Queue N & start posting**. The Sun Ocean panel
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

## Posting queue, NEXT STEP and click macros

Every new Craigslist posting automatically takes the **next listing in the queue**. Once it's
published it leaves the queue, and the next posting gets the next listing, until every property
from the link has been posted.

The big orange **▶ NEXT STEP** button sits in the same spot (bottom-right) on every Craigslist page.
**Alt+Shift+N** does the same thing; change it at `chrome://extensions/shortcuts`. Each click does
what that page needs:

| Page | NEXT STEP does |
|---|---|
| re-use previous data | clicks **re-use selected data** (photos unticked; the ad details are replaced later anyway) |
| type / category / area | picks housing offered → apartments / housing for rent → the listing's county |
| ad details | fills everything, verifies no required field is empty (re-fills if one is), then clicks Continue |
| map | Continue |
| images | deletes any photos carried over from the previous ad, adds this listing's photos, waits for uploads, clicks "done with images" |
| preview | publishes and marks the listing posted |
| posted | starts the next posting for the next listing in the queue |

That means a recorded click macro only needs to click that one spot in a loop, with pauses.
Built-in safety stops:

- **Never re-posts within 48 hours.** Craigslist's rule is one post per item per 48h.
- **Stops when the queue is finished.** Further clicks do nothing ("All caught up").
- **Flags instead of guessing.** If a required field still can't be filled after 3 tries, or
  Craigslist keeps rejecting the ad, the listing is marked **⚠ Needs attention** (with the reason)
  and the next listing starts. Fix it, then click **Retry** in the popup.
- **Unknown pages** (sign-in, phone verification, payment, captcha) are left alone and labelled
  "needs a person".
- Optional **max posts per day**, and optional **re-queue after 48h** to keep listings rotating.

Stay signed in to your Craigslist account so publishing doesn't wait on an email confirmation.
Craigslist's terms restrict automated posting, and accounts that post very often or in rigid
patterns can get ads ghosted or the account blocked. Keep volume reasonable.

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
| Description | Hook line, quick facts, highlights, cleaned-up MLS remarks (listing-agent phone numbers, showing instructions and compensation removed), the reference code (3×), call-to-action for the selected agent, the "we have more" keyword block, signature. Never contains an email address (Craigslist blocks those ads) |

After filling, the panel lists every field: ✓ filled, • default used, ! needs you. It also
outlines in red any required field Craigslist still shows as empty, and repeats any Craigslist
error messages, so you don't have to hunt for what failed.

Fields are found by name first, then by their visible label, then by their option list, so the
filler keeps working if Craigslist renames its form fields.

## Reference code

Every description says **"🔑 Please refer to code F32506961 when texting or calling about this listing"**
three times (top, middle, and in the call-to-action), in bold. The code is the MLS number with an extra
digit slipped in: by default a **0 after the 3rd digit** (F3256961 → F32506961), so other agents don't
recognise it as an MLS number. When someone calls, type their code into the popup's
**Caller's code** box. It shows the listing, its real MLS number, and a link back to OneHome. The
digit, its position and the bold styling are in Settings. If Craigslist ever shows `<b>` as text,
the preview step warns you to turn bold off.

## Settings

- **Agents.** Add, edit or remove agents and choose the active one.
- **Posting queue & Next-step button.** Auto-queue imports, show the button, re-queue after 48h,
  daily limit.
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
| `content-onehome.js` | OneHome scraper (floating button, import, share/search/map pages) |
| `onehome-net.js` | Runs inside OneHome pages and reads property ids from OneHome's data feed (read-only) |
| `craigslist.js` | Craigslist step-by-step assistant panel, posting queue and NEXT STEP engine |
| `popup.*`, `editor.*`, `options.*`, `ui.css` | Extension pages |
