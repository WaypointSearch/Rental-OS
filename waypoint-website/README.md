# Waypoint Search Group — website

The website for [waypointsearch.com](https://waypointsearch.com): Waypoint Search Group, AEC recruitment, 700 S. Rosemary Ave, Suite 204, West Palm Beach, FL 33401 · (212) 347-0057 · info@waypointsearch.com.

It is a plain static site (HTML, CSS and a little JavaScript) with no build step, database or server code.

**To put it live, follow [`LAUNCH.md`](LAUNCH.md).**

## Ground rules this site follows

- **No real clients.** The site names client *types* only, never client names or logos.
- **No real job postings.** The jobs page shows labeled *role profiles*. Candidates submit a resume to be matched to confidential live searches.
- **No invented proof.** The stats are scope figures that are true as written. There are no fabricated testimonials or awards.
- **Services match the business model.** Contingency search is the core offering, with engaged and retained search for senior or hard-to-fill roles. The site offers no contract staffing.

## What's in the folder

| Path | What it is |
|---|---|
| `index.html`, `sectors.html`, `employers.html`, `jobs.html`, `insights*.html`, `about.html`, `contact.html` | Site pages |
| `thanks.html`, `404.html`, `privacy.html` | Form thank-you page, not-found page, privacy policy |
| `assets/` | Styles, scripts, logo, icons and social-share image |
| `_redirects`, `_headers` | Cloudflare Pages settings: old-URL redirects and security headers |
| `vercel.json` | Only used if you ever host on Vercel instead |
| `brand/` | Brand kit (logos and LinkedIn images). Not part of the website upload. |
| `docs/` | Competitive research. Not part of the website upload. |

The site uses **clean URLs** (`/employers`, not `/employers.html`). Cloudflare Pages and Netlify serve these automatically; Vercel uses the included `vercel.json`.

## Forms

Every form posts to [FormSubmit](https://formsubmit.co), which emails the submission (with any resume attached) to info@waypointsearch.com and returns the visitor to `/thanks`. Before submissions are delivered, someone has to click a one-time activation email sent to info@ (see LAUNCH.md, step 5).

To change the receiving address, update `EMAIL` in the form `action` URLs and the contact details across the pages.

## Editing

- **Role profiles**: `assets/js/jobs-data.js`.
- **Colours and fonts**: the `:root` block in `assets/css/styles.css`.
- **Header, footer and nav**: these are repeated in each HTML file, so use find-and-replace across all of them.

## Still worth confirming

These are published commitments, so keep only what's true:

- [ ] Engaged and retained search (`employers.html#models`). Drop them if you only work on contingency.
- [ ] The **replacement guarantee** on direct hires (`index.html`, `employers.html`).
- [ ] The **service standards**: licensure verified, consent before every submittal, weekly updates, 90-day follow-through.
- [ ] **"Within one business day"** response times.
- [ ] **Careers at Waypoint** (`about.html#careers`): remove it if you're not open to hiring recruiters.
- [ ] **Privacy policy**: plain-English and general. Have it reviewed if you need formal compliance.

## Add when you have them

- [ ] **LinkedIn company page URL.** The footer link stays hidden until there is one.
- [ ] **Real stats** (placements, retention, days to shortlist) and **testimonials**, with permission.
- [ ] **Team photos and bios.**
