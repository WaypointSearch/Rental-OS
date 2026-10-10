# Launch waypointsearch.com tonight

The site is hosted on **Cloudflare**, which is free and includes SSL and a global CDN. You'll upload one zip file and change your nameservers. Expect about 30 minutes of clicking, plus a wait while the nameserver change spreads (usually under an hour, sometimes longer).

You need:

- **`waypoint-website-upload.zip`**: the website. Upload it as-is; don't unzip it.
- A login for wherever **waypointsearch.com is registered** (GoDaddy, Namecheap, Squarespace, Wix, Network Solutions…). Not sure where? Look it up at [lookup.icann.org](https://lookup.icann.org) and check the "Registrar" line.

---

## 0. Protect your email first (5 min)

Changing nameservers moves **all** of your domain's settings, including the ones that make `info@waypointsearch.com` work.

1. Log in to your registrar and open the **DNS settings** for waypointsearch.com.
2. **Take a screenshot of every record.** The important ones are **MX** records (email) and **TXT** records (email security).
3. If you see **DNSSEC** turned on, turn it off. Cloudflare can turn it back on later.

Keep your old website host running until step 4 is done. Nothing changes for visitors until then.

## 1. Add your domain to Cloudflare (10 min)

1. Create a free account at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
2. Choose **Add a domain** (it may say *Onboard a domain*), enter `waypointsearch.com`, and keep **"Quick scan for DNS records"** selected. Pick the **Free** plan.
3. Cloudflare shows the records it found. **Compare them with your screenshot.** Every MX and TXT record from the screenshot must be on the list. Add any that are missing.
4. Cloudflare now shows **two nameservers** (they look like `name.ns.cloudflare.com`). Keep that page open.

## 2. Change your nameservers (5 min)

1. At your registrar, find **Nameservers** for waypointsearch.com and choose **Custom** (or *"I'll use my own nameservers"*).
2. Delete the existing nameservers and paste in **both** Cloudflare nameservers exactly.
3. Save. Cloudflare emails you when the domain is **Active**.

## 3. Upload the website (5 min, while you wait)

1. In Cloudflare, go to **Workers & Pages** and choose **Create**. Pick **Pages**, then the **upload / drag-and-drop** option (Cloudflare's wording changes; it may say *"Upload assets"* or *"Drag and drop your files"*).
2. Name the project `waypoint-search`.
3. Drop in **`waypoint-website-upload.zip`** and click **Deploy**.
4. You'll get a preview link like `waypoint-search.pages.dev`. Open it and click around. That's your new site.

## 4. Point waypointsearch.com at the new site (5 min, once step 2 shows Active)

1. In your Pages project, open **Custom domains** and click **Set up a custom domain**.
2. Enter `waypointsearch.com` and follow the prompts to activate it.
3. Repeat for `www.waypointsearch.com`.
4. If Cloudflare says a record **already exists**: go to **DNS → Records** and delete the old **A**, **AAAA** or **CNAME** record for that name (it points to your old website), then try again. **Never delete MX or TXT records.**
5. The SSL certificate is issued automatically, usually within a few minutes.

## 5. Turn on the forms (5 min)

Every form on the site emails submissions to **info@waypointsearch.com** through FormSubmit, a free form-to-email service.

1. Go to `waypointsearch.com/contact` and send a test message.
2. Check **info@waypointsearch.com** (and its spam folder) for an email from **FormSubmit**, and click **Activate**. Submissions are only delivered after this one-time step.
3. Send another test from the contact page and confirm it arrives.
4. Test **Submit Resume** on the Find Jobs page with a PDF, and confirm the attachment arrives. If it doesn't, candidates can still email resumes, because the form shows your email address as a fallback.

## 6. Final checks

- [ ] `waypointsearch.com` and `www.waypointsearch.com` both show the new site, with a padlock.
- [ ] Email to and from `info@waypointsearch.com` still works. Send yourself a test.
- [ ] The contact form and resume form arrive in your inbox.
- [ ] Old links such as `/news` redirect to the new Insights page.

---

## If something goes wrong

| Problem | Fix |
|---|---|
| Still seeing the old site | DNS is still updating. Wait 30–60 minutes, or check from your phone on cellular data. |
| Cloudflare stuck on "Pending" | Re-check the nameservers at your registrar for typos, and make sure DNSSEC is off. |
| Email stopped arriving | An MX record is missing in Cloudflare → **DNS → Records**. Add it back from your screenshot. |
| No FormSubmit activation email | Check spam, then submit the contact form again. |

## Next steps

- **LinkedIn:** create a company page named *Waypoint Search Group*. Use `brand/logo-square.png` as the logo and `brand/linkedin-banner.png` as the cover image. Send the page URL to Claude to add it to the site footer.
- **Updating the site:** send Claude your changes. You'll get a new zip; in your Pages project, choose **Create deployment** and upload it.
