# Full Integration Pass

Goal: make every existing feature reachable and end-to-end functional through the 3 active portals (`/concierge/desk`, `/guardian/view`, `/artisan/today`), without un-archiving routes.

---

## 1. Re-expose archived features inside the 3 portals (as tabs, not routes)

Archived pages stay archived. Their *components* are lifted out and mounted as tabs inside the surviving portals.

**`/concierge/desk` (Reception + Admin + Manager)** — tabbed shell:
- **Front Desk** (current search + today list) — default
- **Clients** (from `_archive/clients.tsx`) — search, add, edit, founder badge
- **Appointments** (from `_archive/appointments.tsx`) — calendar + book/reschedule (Manager+ only for reschedule per `CAN.rescheduleAppt`)
- **Founders** (from `_archive/founders.tsx` + `_archive/registry.tsx`) — Circle management, waitlist, enroll (Admin only per `CAN.enrollFounder`)
- **Perks & Surprises** (merge `_archive/perks.tsx` + `_archive/surprises.tsx`) — gated by `CAN.awardSurprise`/`CAN.awardJustBecause`
- **Products & Brunch** (merge `_archive/products.tsx` + `_archive/brunch.tsx`)
- **Payments** (from `_archive/payments.tsx`) — STK push, payment history, receipt view
- **WhatsApp** (from `_archive/whatsapp.tsx`) — broadcast + templates
- **Settings** (from `_archive/settings.tsx`) — Admin only per `CAN.changeSettings`

**`/guardian/view` (Guardian + Admin)** — tabbed shell:
- **Overview** (current) — KPIs
- **Dashboard** (from `_archive/dashboard.tsx`) — full analytics
- **Reports / Export Center** — payment reports, founder reports, audit log

**`/artisan/today` (Technician)** — add tab strip:
- **Today** (current)
- **My Stats** (lift from `_archive/tech.tsx`) — services today, week, month
- **Self-bookings calendar** — visualize own self-booked appointments

Each tab is built from the archived file's component (copied into `src/components/sections/*`), then deleted from the import graph if unused. Tabs respect `CAN.*` and hide for roles that lack permission.

## 2. Artisan Scheduler ↔ WhatsApp ↔ Manager feed

- **WhatsApp on self-book**: in `artisan.today.tsx` confirm step, call `sendWhatsAppFn` with template `appointment_confirmation` to the client. Log to `whatsapp_messages` with `template_key='appointment_confirmation'`, `created_by='tech:<id>'`.
- **WhatsApp on self-cancel**: send `appointment_cancellation` template.
- **1-hour reminder**: server fn `scheduleReminderFn` writes a row to `notifications` (kind=`tech_reminder`). A cron-style server route `/api/public/cron/reminders` (callable by external scheduler) finds appointments within 60–70 min, sends WhatsApp to tech's phone, marks notification read.
- **Manager feed**: inside the new Concierge Desk **Appointments** tab, every appointment shows a badge derived from `created_by`:
  - `tech:*` → "Technician Self-Booked" (gold)
  - `reception:*`/`admin:*` → "Reception Booked" (neutral)
  - `client:*` → "Client Booked" (blue)
  - null → "Walk-in"
- Real-time: subscribe to `appointments` table via Supabase realtime, prepend new self-bookings with a toast for Manager/Admin.

## 3. M-Pesa → Payments → Receipts → WhatsApp

- **STK push trigger**: extend `payments.functions.ts` with `initiateMpesaFn({ clientId, amount, phone, paymentType })` that inserts a `payments` row with `status='pending'` and calls Daraja STK push API. Stores `mpesa_checkout_request_id`.
- **Callback (`/api/public/mpesa/callback`)**: existing route — extend to:
  1. Find payment by `mpesa_checkout_request_id`.
  2. On success: update `status='paid'`, `mpesa_receipt_number`, `paid_at`. Existing `handle_payment_paid` trigger updates founder totals.
  3. Insert into `receipts` (number = `COT-<yymmdd>-<seq>`, derive `pdf_url` later).
  4. Send WhatsApp `payment_confirmation` template to client phone.
  5. Insert `activity_log` row.
- **Receipts viewer**: lift `_archive/receipts.$id.tsx` into a modal inside the Payments tab (no separate route).
- **WhatsApp template additions**: extend `src/lib/whatsapp-templates.ts` with `appointment_confirmation`, `appointment_cancellation`, `payment_confirmation`, `tech_reminder`.

## 4. Secrets needed (will request via add_secret if missing)

- `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL` (the public callback route URL).
- `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_ID` (or existing UazAPI token if already used).

I'll check `fetch_secrets` first and only prompt for what's missing.

## 5. Files changed (high-level)

**New:**
- `src/components/sections/*` — 10–12 section components lifted from archive
- `src/components/PortalTabs.tsx` — tabs shell honoring `CAN.*`
- `src/lib/mpesa.functions.ts`, `src/lib/whatsapp.functions.ts`, `src/lib/scheduler.functions.ts`
- `src/routes/api/public/cron.reminders.ts`

**Edited:**
- `src/routes/concierge.desk.tsx`, `guardian.view.tsx`, `artisan.today.tsx` — wrap content in PortalTabs
- `src/routes/api/public/mpesa.callback.ts` — full flow
- `src/lib/whatsapp-templates.ts`, `src/lib/permissions.ts`
- `src/components/AppSidebar.tsx` — labels/nav remain (3 portals)

**Migration:**
- Add `payment_type` enum value for `appointment_deposit` if missing
- Index on `appointments(created_by)`, `payments(mpesa_checkout_request_id)`

## 6. Out of scope (call out, don't build)

- Generated PDF receipts (just store text payload; `pdf_url` left null)
- Mapbox/Maps drawing inside Settings tab works as-is (already implemented)
- Email delivery
- Migrating to RLS-by-role (existing public RLS preserved)

---

This is a large pass (~25–30 file changes + 1 migration). I'll work in this order:
1. Migration + secrets check
2. Lift archived components into `src/components/sections/*`
3. Build `PortalTabs` and re-mount inside the 3 portals
4. Wire WhatsApp + Manager badge into scheduler
5. Wire full M-Pesa flow + receipts modal
6. Smoke test with `invoke-server-function` on the callback route
