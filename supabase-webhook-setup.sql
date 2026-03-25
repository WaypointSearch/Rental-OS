-- ============================================================
-- Rental OS — Supabase Webhook Setup
-- Run AFTER deploying your app to Vercel/production.
-- Dashboard → Database → Webhooks → Create a new hook
-- ============================================================

-- You cannot create webhooks via SQL — use the Dashboard UI.
-- Instructions below:

/*
  1. Go to Supabase Dashboard → Database → Webhooks
  2. Click "Create a new hook"
  3. Fill in:
     Name:    new-lead-admin-notify
     Table:   public.leads
     Events:  ✓ INSERT  (uncheck UPDATE and DELETE)
     Type:    HTTP Request
     Method:  POST
     URL:     https://your-app.vercel.app/api/new-lead-notify
     Headers:
       Content-Type: application/json
       x-webhook-secret: <paste your WEBHOOK_SECRET value>

  4. Click "Create webhook"

  The webhook fires every time a GAS script upserts a new lead row.
  Your /api/new-lead-notify route will email ADMIN_EMAIL with the
  lead summary and an "Open Dispatch Panel" button.

  Notes:
  - For local dev, use ngrok to expose localhost:3000 and use
    the ngrok URL instead of your Vercel domain.
  - The route skips sending if RESEND_API_KEY or ADMIN_EMAIL
    are not set, so it won't crash during dev.
  - GAS upserts (ON CONFLICT) that update existing rows will
    NOT trigger INSERT webhooks — only brand new leads will.
*/

-- ── Optionally: enable the pg_net extension for direct DB webhooks ──
-- (not required if using the Dashboard UI method above)
-- create extension if not exists pg_net;
