## Scope

Three connected workstreams. I'll confirm before running migrations and writing code.

---

### 1. Sync index login page → staff PINs

The login page (`/`) currently has its own PIN check. I'll wire it to the existing `verify_staff_pin` RPC so PINs added/changed under the Staff settings tab work for login immediately. No new tables — just point the form at the existing flow (`loginWithPin` in `src/lib/auth.functions.ts`) and remove any local/hardcoded checks.

I'll also surface PIN status (active, must change, locked) in the Staff settings list, with an "Issue new PIN" action that calls `adminResetPinFn` and shows the temporary 4-digit PIN once.

---

### 2. Artisan commission tracking

**Database (new tables)**
- `staff_commission_settings` — staff_id, commission_percentage, commission_type (`percentage_of_sale` | `fixed_per_service` | `hybrid`), fixed_amount_ksh, effective_date, set_by, notes, is_active.
- `staff_earnings` — staff_id, payment_id, appointment_id, service_id, service_name, sale_amount_ksh, commission_percentage (snapshot), commission_earned_ksh, fixed_bonus_ksh, total_commission_ksh, earnings_date.
- Indexes on `(staff_id, earnings_date)`.
- Trigger on `payments` → on status `paid`, if `created_by` resolves to a `tech:<id>`, look up active commission settings and insert one `staff_earnings` row per line item (using snapshot rate). Founder discount and travel surcharge are already baked into the amount paid. Perk redemptions (0 KSH) skipped. Product line items use the same rate for now (separate product rate left as a future toggle).

**Admin UI** — new "Commission" section inside the existing Staff settings drawer:
- Percentage input (0–100), type dropdown, fixed amount, effective date, notes.
- History table (read-only audit of past `staff_commission_settings` rows).
- Bulk-apply rate across selected techs.

**Admin report** — add a "Commissions" sub-tab under the Concierge desk Reports area:
- Date range picker, per-tech summary, CSV export.

**Artisan portal** — new "💰 Earnings" tab in `src/routes/artisan.today.tsx`:
- Today / Week / Month cards (sales, commission, service count, average).
- Weekly bar chart (Recharts, already installed).
- Transaction list grouped by day with service, sale, %, commission.
- Service-type breakdown.
- After billing: success toast appends `You earned X KSH commission.`

---

### 3. WhatsApp booking confirmation

**Settings** — extend Concierge → Settings with a WhatsApp panel:
- Sender phone (default `+254722365861`), API token (stored as secret `WHATSAPP_API_TOKEN` — I'll request it via `add_secret`), webhook URL (read-only), template enable/disable.
- "Send test" button.

**Server function** — `sendBookingConfirmation` in `src/lib/whatsapp.functions.ts`:
- Builds message from the existing `booking_confirmation` template (extended to include perk/travel/payment lines).
- Posts to WhatsApp Business API; logs to `whatsapp_messages` with status (`sent`/`delivered`/`failed` + `error`).
- Existing `whatsapp_messages` table already has the needed columns; I'll add a `message_type` and `phone_number` column via migration if missing.

**Booking flow** — every place that inserts an appointment (artisan `NewBookingSheet`, concierge front desk, registry quick-book) calls `sendBookingConfirmation` right after the insert succeeds. If new client, save client first. Toast: `✅ Booking saved! WhatsApp sent to <Name>` or yellow banner with Retry on failure.

**Reminders** — extend the existing `visit-reminders-21d` cron pattern with a `booking-reminders-24h` hook (daily at 08:00 UTC) that finds tomorrow's appointments and sends the reminder template.

---

## Order of execution
1. Migration: commission tables + trigger + `whatsapp_messages` columns. (Requires your approval.)
2. `add_secret` request for `WHATSAPP_API_TOKEN`.
3. Wire login page → `loginWithPin` and add PIN management UI to Staff settings.
4. Commission admin UI + artisan Earnings tab + report tab.
5. WhatsApp send-on-booking + 24h reminder cron.

I'll proceed step by step and pause for the secret. Confirm to start with step 1 (migration).