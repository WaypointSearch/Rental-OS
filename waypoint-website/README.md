# Waypoint Search — website redesign

A redesign of [waypointsearch.com](https://waypointsearch.com) that positions Waypoint Search as a large, specialist **MEP / AEC recruitment firm**.

It is a plain static site (HTML, CSS and a little vanilla JavaScript) with no build step and no dependencies, so it can be hosted anywhere.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home: hero with job/hire search, stats, disciplines, markets, services, process, featured jobs, testimonials, salary-guide CTA |
| `sectors.html` | One section per discipline (roles and credentials), plus the markets grid |
| `employers.html` | Services in detail, why Waypoint, process, **request-talent form** |
| `jobs.html` | Job board with keyword, location, discipline, type and workplace filters, plus the **application / resume form** |
| `about.html` | Story, approach, values, EEO statement |
| `contact.html` | Contact form, contact details, national coverage |

```
waypoint-website/
├── *.html                  pages (shared header/footer repeated in each)
├── assets/css/styles.css   all styles; brand tokens live in :root
├── assets/js/main.js       nav, mega menu, tabs, forms, animations
├── assets/js/jobs-data.js  job listings (sample data, edit this)
├── assets/js/jobs.js       job board search and filters
├── assets/img/             logo mark and favicon
├── robots.txt, sitemap.xml
```

## Preview locally

```bash
npx serve waypoint-website
# or
python3 -m http.server 8000 --directory waypoint-website
```

## Deploy

Any static host works. Pick one:

- **Vercel**: create a new project from this repo and set **Root Directory** to `waypoint-website` and **Framework Preset** to *Other*. Keep it separate from the Rental OS project.
- **Netlify**: drag the `waypoint-website` folder onto app.netlify.com/drop.
- **Existing host** (cPanel, Squarespace developer mode, etc.): upload the folder contents to the web root.

Then point `waypointsearch.com` at the new host.

## Editing

- **Brand colours and fonts**: the `:root` block at the top of `assets/css/styles.css`. Fonts are Archivo (headings and body) and IBM Plex Mono (labels).
- **Jobs**: edit `assets/js/jobs-data.js`. The field reference is at the top of the file. You can later swap it for a feed from your ATS (Bullhorn, Loxo, JobAdder…).
- **Header, footer and nav**: these are repeated in each of the six HTML files, so use find-and-replace across all of them.
- **Forms**: set `WAYPOINT_FORM_ENDPOINT` at the top of `assets/js/main.js` to a form backend (e.g. Formspree, Basin, HubSpot). Until you set it, forms validate and show the success message **but send nothing**. The resume upload on `jobs.html` needs a backend that accepts file uploads, or you can replace that form with your ATS's apply link.

## Before launch: replace placeholder content

Everything below was written as a stand-in. Swap in your real details before going live.

- [ ] **Phone and email**: `(555) 010-4200` and `hello@waypointsearch.com` appear in every page's header and footer, on `employers.html` and `contact.html`, and in the JSON-LD block in `index.html`.
- [ ] **LinkedIn URL**: `linkedin.com/company/waypoint-search` is a guess (footer and contact page).
- [ ] **Stats**: 2,500+ placements, 94% retention, 10-day shortlist, 40k+ network, 3:1 interview-to-offer, 90-day support (`index.html`, `employers.html`, `about.html`). Each one is marked with a `PLACEHOLDER` comment.
- [ ] **Testimonials** (`index.html`): use real, approved quotes only.
- [ ] **Job listings** (`jobs-data.js`): all 14 are samples.
- [ ] **Promises**: "replacement guarantee", "within one business day", "90 days of post-placement check-ins". Keep them only if they're true.
- [ ] **Salary guide**: the home page band and the mega-menu card offer a 2026 salary guide. Remove them if you don't have one.
- [ ] **About copy**: add your founding story, year and team.
- [ ] **Coverage regions and office hours** (`contact.html`).
- [ ] **Logo**: `assets/img/logo-mark.svg` is a placeholder mark. Replace it with your real logo.
- [ ] **Photography**: add real team and project photos. Large firms show their consultants.
- [ ] **Privacy policy and terms pages**: you need these because the site collects resumes and personal data.
- [ ] **Social share image**: add an `og:image`, plus analytics if you want them.
- [ ] **Canonical URLs and sitemap**: these assume `https://waypointsearch.com/<page>.html`. Update them if your host serves clean URLs.
