# Waypoint Search — website redesign

A redesign of [waypointsearch.com](https://waypointsearch.com) that positions Waypoint Search as a large, specialist **MEP / AEC recruitment firm**.

It is a plain static site (HTML, CSS and a little vanilla JavaScript) with no build step and no dependencies, so it can be hosted anywhere.

The design draws on a review of the firms you named (Luxus, AE Concepts, Altus) and of national competitors such as Blue Signal, MEP Staff, KORE1, Kimmel and Davron. See [`docs/competitive-research.md`](docs/competitive-research.md) for what was adopted, what was deliberately avoided, and recommendations beyond the site.

## Ground rules this site follows

- **No real clients.** The site names client *types* only, never client names or logos.
- **No real job postings.** The jobs page shows *role profiles*: representative roles with typical ranges and typical employer types, clearly labeled. Candidates submit a resume to be matched to confidential live searches.
- **No invented proof.** The stats are scope figures that are true as written. There are no fabricated testimonials or awards.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home: job/hire search, scope stats, disciplines, markets, services, process, role profiles, service standards, insights, compensation-benchmark offer |
| `sectors.html` | One section per discipline (roles and credentials), plus the markets grid |
| `employers.html` | Services, **hiring-models comparison**, why Waypoint, process, **job-order form** |
| `jobs.html` | Role-profile board with filters, **candidate FAQ**, **resume form** |
| `insights.html` | Insights hub |
| `insights-*.html` | Three full articles (two for employers, one for candidates) |
| `about.html` | Story, standards, approach, values, **careers at Waypoint**, EEO statement |
| `contact.html` | Contact form, contact details, national coverage |

```
waypoint-website/
├── *.html                  pages (shared header/footer repeated in each)
├── assets/css/styles.css   all styles; brand tokens live in :root
├── assets/js/main.js       nav, mega menu, tabs, forms, animations, role cards
├── assets/js/jobs-data.js  role profiles (edit this)
├── assets/js/jobs.js       role search and filters
├── assets/img/             logo mark and favicon
├── docs/                   competitive research
├── robots.txt, sitemap.xml
```

## Preview locally

```bash
npx serve waypoint-website
# or
python3 -m http.server 8000 --directory waypoint-website
```

## Deploy

Any static host works:

- **Vercel**: create a new project from this repo and set **Root Directory** to `waypoint-website` and **Framework Preset** to *Other*. Keep it separate from the Rental OS project.
- **Netlify**: drag the `waypoint-website` folder onto app.netlify.com/drop.
- **Existing host**: upload the folder contents to the web root.

## Editing

- **Brand colours and fonts**: the `:root` block in `assets/css/styles.css`.
- **Role profiles**: edit `assets/js/jobs-data.js`. If you later decide to publish live jobs, add them there with the same fields, or swap the file for an ATS feed.
- **Header, footer and nav**: these are repeated in each HTML file, so use find-and-replace across all of them.
- **Insights**: copy an `insights-*.html` page to add an article, then link it from `insights.html` and the homepage Insights row.
- **Forms**: set `WAYPOINT_FORM_ENDPOINT` at the top of `assets/js/main.js` to a form backend (Formspree, Basin, HubSpot…). Until you set it, forms validate and show the success message **but send nothing**. The resume upload needs a backend that accepts files, or your ATS's apply link.

## Before launch

**Replace placeholders**

- [ ] **Phone and email**: `(555) 010-4200` and `hello@waypointsearch.com` appear in every page's header and footer, on `employers.html` and `contact.html`, and in the JSON-LD block in `index.html`.
- [ ] **LinkedIn URL** (footer and contact page): `linkedin.com/company/waypoint-search` is a guess.
- [ ] **Office hours and coverage regions** (`contact.html`).
- [ ] **Logo**: `assets/img/logo-mark.svg` is a placeholder mark.

**Confirm these match how you operate.** They are published commitments, so keep only what's true.

- [ ] The four **hiring models** (contingent, engaged, retained, contract). Drop any you don't offer, and update the "4 hiring models" stat to match.
- [ ] The **replacement guarantee** on direct hires (`index.html`, `employers.html`).
- [ ] The **service standards**: licensure verified, consent before every submittal, weekly updates, 90-day follow-through (`index.html`, `about.html`).
- [ ] **"Within one business day"** response promises (forms and contact copy).
- [ ] **Typical base ranges** in `jobs-data.js`.
- [ ] **Careers at Waypoint** (`about.html#careers`): remove it if you're not open to hiring recruiters.
- [ ] **About story** copy. Add your founding year and story.

**Add when you have them.** These are the strongest proof a recruiting firm can show.

- [ ] **Real stats** such as placements, retention and days to shortlist. Replace the scope stats on the homepage.
- [ ] **Real testimonials**, with permission. A quote attributed by title (e.g. "Principal, MEP engineering firm") is fine.
- [ ] **Team photos and bios.** Large firms show their recruiters.
- [ ] **Headquarters city and offices**, if you want to show a location.
- [ ] **Real awards or memberships**, if any.

**Housekeeping**

- [ ] **Privacy policy and terms pages.** You need these because the site collects resumes.
- [ ] **Social share image** (`og:image`) and analytics.
- [ ] **Canonical URLs and sitemap**: these assume `https://waypointsearch.com/<page>.html`.
