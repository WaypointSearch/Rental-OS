# Rental OS — Complete Setup Guide

Full-stack AI-powered rental lead CRM.
Google Voice & Facebook Marketplace bots → Supabase → Next.js Kanban pipeline.

<!-- production deploy trigger: 2026-09-07 -->

---

## Quick boot order

Follow these steps **exactly in order** the first time.

### Step 1 — Install and run locally

```bash
git clone <your-repo> rental-os && cd rental-os
npm install
cp .env.local.example .env.local   # then fill in all values (see Step 2)
npm run dev
# → http://localhost:3000
```

### Step 2 — Fill in .env.local

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for dev, your Vercel URL for prod |
| `RESEND_API_KEY` | resend.com → API Keys → Create Key |
| `ADMIN_EMAIL` | Your email — receives new-lead alerts |
| `WEBHOOK_SECRET` | Run `openssl rand -hex 32` and paste the result |

### Step 3 — Run Supabase SQL (in order)

In Supabase Dashboard → SQL Editor, run each file once:

```
1. supabase-setup.sql              (original leads table + storage + RLS base)
2. supabase-schema-update-v2.sql   (agent_profiles, new lead columns, is_admin fn)
3. supabase-fix-v3.sql             (cosigner_info, insert policy fix)
```

Then make yourself admin:
```sql
update agent_profiles set is_admin = true where email = 'your@email.com';
```

### Step 4 — Configure Supabase Auth

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `http://localhost:3000` (or your Vercel URL)
- **Redirect URLs** (add both):
  - `http://localhost:3000/auth/callback`
  - `https://your-app.vercel.app/auth/callback`

### Step 5 — Set up the new-lead webhook (after deploying)

See `supabase-webhook-setup.sql` for instructions. In Supabase Dashboard → Database → Webhooks:
- Table: `leads`, Event: `INSERT`
- URL: `https://your-app.vercel.app/api/new-lead-notify`
- Header: `x-webhook-secret: <your WEBHOOK_SECRET value>`

---

## Deploy to Vercel

```bash
npm i -g vercel && vercel
```

In Vercel Dashboard → Your Project → Settings → Environment Variables, add all 7 variables from `.env.local.example`.

---

## Google Apps Script wiring

Both GAS scripts (Google Voice + Facebook) already call `logToSupabase()`. Ensure each has:

**Script Properties** (GAS → Project Settings → Script Properties):
- `SUPABASE_URL` → your project URL
- `SUPABASE_KEY` → your `service_role` key

The scripts push leads on every handoff. The Supabase webhook then emails you automatically.

---

## Roles

| Role | Can do |
|---|---|
| **Admin** | See all leads, assign/reassign leads, invite/delete agents, delete leads, see commission totals, access God Mode |
| **Agent** | See only their assigned leads, edit lead criteria, add notes, move stages |

Admin check is enforced in both the Next.js middleware (`/admin` route) and Supabase RLS.

---

## How a lead flows through the system

```
GAS bot collects criteria
    ↓
logToSupabase() upserts row
    ↓
Supabase INSERT webhook fires
    ↓
/api/new-lead-notify emails admin
    ↓
Admin opens pipeline → Dispatch Modal auto-opens
    ↓
Admin clicks an agent → assigned_agent updated
    ↓
/api/send-assignment emails agent
    ↓
Agent opens pipeline → sees their lead
    ↓
Agent edits criteria, adds notes, moves stages
    ↓
GAS bot sends property link to customer
    ↓
Customer picks MLS codes → GAS quietly updates the row
    ↓
Lead card updates live via Supabase Realtime
```

---

## Complete file map

```
rental-os/
├── .env.local.example          ← copy to .env.local
├── middleware.ts               ← auth + /admin guard
├── supabase-setup.sql          ← step 1
├── supabase-schema-update-v2.sql ← step 2
├── supabase-fix-v3.sql         ← step 3
├── supabase-webhook-setup.sql  ← step 5 (after deploy)
└── src/
    ├── types/
    │   ├── lead.ts             ← Lead, STAGES, STAGE_COLORS, parseBudget
    │   └── agent.ts            ← AgentProfile, Availability, DAYS
    ├── lib/
    │   ├── supabase.ts         ← browser client
    │   ├── supabase-server.ts  ← SSR client
    │   ├── supabase-admin.ts   ← service_role client (API routes only)
    │   ├── cities.ts           ← South Florida city list (Miami-Dade/Broward/Palm Beach)
    │   ├── exportCSV.ts        ← CSV download
    │   ├── useLeadFilter.ts    ← search/filter/sort hook
    │   ├── useLeadsRealtime.ts ← Supabase realtime subscription
    │   └── useToast.tsx        ← toast notification system
    └── app/
        ├── auth/callback/route.ts        ← magic link handler (REQUIRED)
        ├── login/page.tsx                ← email + magic link login
        ├── profile/page.tsx              ← agent profile page
        ├── profile/_components/
        │   └── AgentProfileForm.tsx      ← avatar, name, phone, availability
        ├── admin/page.tsx                ← God Mode (admin-gated by middleware)
        ├── admin/_components/
        │   └── AdminDashboard.tsx        ← overview, agents, all leads
        ├── api/
        │   ├── leads/create/route.ts     ← RLS bypass for admin lead creation
        │   ├── send-assignment/route.ts  ← emails agent on assignment (Resend)
        │   ├── new-lead-notify/route.ts  ← emails admin on new lead (Supabase webhook)
        │   ├── admin/invite/route.ts     ← generates magic link for new agent
        │   └── admin/delete-user/route.ts ← removes agent from auth + profiles
        └── pipeline/
            ├── page.tsx                  ← SSR: fetches leads + agent data
            └── _components/
                ├── KanbanBoard.tsx       ← main shell: DnD, realtime, modals
                ├── StageColumn.tsx       ← droppable column + commission badge
                ├── LeadCard.tsx          ← name, move-in, budget, agent avatar
                ├── LeadPanel.tsx         ← slide-out: all editable fields
                ├── DispatchModal.tsx     ← side-by-side assign: lead + agents
                ├── LeadCreateModal.tsx   ← manual lead creation form
                ├── ListView.tsx          ← sortable table view
                ├── StatsBar.tsx          ← pipeline metrics header
                ├── FilterBar.tsx         ← search/filter/sort bar
                ├── CityAutocomplete.tsx  ← tag-based city multi-select
                └── AgentAvatar.tsx       ← avatar with Supabase Storage upload
```

---

## Pipeline stages

| Stage | Meaning |
|---|---|
| Waiting for contact | AI handoff complete — no agent contact yet |
| Made Contact | Agent reached the lead |
| Set showings | Appointments booked |
| Showings complete | Tours done, deciding |
| Completed Rentspree | Application submitted |
| Offer Sent | Offer submitted to landlord |
| Offer Approved | Landlord accepted |
| HOA Approved | HOA cleared |
| Move in / Deposit | Closed |
