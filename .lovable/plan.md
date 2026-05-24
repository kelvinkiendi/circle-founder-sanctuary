
# COTERIE Circle POS — v2 Upgrade Plan

This is a large, multi-area change. I'll ship it in **4 build waves** so each is testable.

---

## Wave A — Database & service catalog (foundation)

**Migration** adds:
- `services` table (name, duration_minutes, price_ksh, category, description, status, eligible_roles[], display_order)
- `payment_line_items` table (payment_id, service_id, snapshot name/qty/unit/total)
- `appointments.service_id`, `appointments.service_description`
- Seed the 10 default services (Weekly Refresh → Cuticle Oil) so the picker has data immediately.
- RLS: same public-read/write pattern used elsewhere in this project (keep parity, gating done at app + serverFn level).

No code yet — migration first so generated types refresh.

---

## Wave B — Admin Service Management

- New tab inside `/concierge/desk` → **"Services"** (admin-only via `CAN.changeSettings`).
  - Keeps the single-portal model already in use; no new top-level route.
- CRUD table: Name · Duration · Price (with Founder price = base × 0.85 shown) · Category · Roles · Status · ↑↓ reorder · Edit · Soft-delete.
- Add/Edit dialog with all fields + category select + eligible roles multi-select.
- Search + filter by category.

---

## Wave C — Booking + New-Client Inline Registration

- Shared `NewClientFields` component (full name, phone, WhatsApp auto-mirror, email, birthday, address, referral source + referrer search, notes, first-visit date) with Kenya phone validation via existing `normalizeKePhone`.
- Booking form (in `appointments.tsx` + concierge desk booking sheet) gets a **"New Client?"** switch that swaps the client search for the inline form.
- **Artisan mobile**: 3-step bottom sheet (Client → Service & Time → Extras) in `artisan.today.tsx`.
- Save flow: insert client → insert appointment (with `service_id` + snapshot `service_description`) in one mutation; queue `new_client_welcome` WhatsApp row.
- Service picker pulls from `services` table; selecting a service auto-fills duration + price for downstream billing.

---

## Wave D — Tech Billing (STK + Cash + Multi-service) + PIN + Templates

**1. Forced PIN change on first login**
- `verify_staff_pin` already returns `must_change_pin`. Session bootstrap (`src/lib/session.tsx`) routes to `/change-pin` (already exists) when `must_change_pin === true` AND `last_login_at` is null — block portal access until done. Add the same guard inside `change-pin.tsx` (PIN rules: not 0000, not 1234/4321, not 1111/2222…).

**2. Artisan billing bottom sheet** (`artisan.today.tsx`)
- "💰 Bill Client" on completed cards opens sheet:
  - Step 1: client name + editable M-Pesa phone (prefilled).
  - Step 2: multi-row service selector (Add Another Service) → running total.
  - Step 3: editable amount + description, payment method toggle (M-Pesa STK / Cash).
  - M-Pesa → calls existing `requestPayment` serverFn (already wired to Daraja STK via Wave-2 work), then writes `payment_line_items` rows.
  - Cash → insert payment as `paid` with `mpesa_receipt_number = CASH-…` and generate receipt immediately.
- **Today's Collection** card at top of artisan view: M-Pesa total + Cash total + expandable detail list.

**3. WhatsApp templates** — append to `whatsapp-templates.ts`:
- `new_client_welcome`
- `service_followup_24h` (manual trigger from concierge desk for now; cron is out of scope)
- Existing `payment_confirmation` already covers the receipt SMS; tighten copy to match the new spec.

**4. Server function updates** (`payments.functions.ts`):
- `requestPayment` accepts optional `line_items: [{service_id, qty}]` and computes total server-side; client-supplied amount honored only if it matches or is flagged as manual override (logged to `activity_log`).
- New `recordCashPayment` serverFn (insert paid payment + receipt + line items + WhatsApp queue).
- New `createClientWithAppointment` serverFn (atomic: client insert → appointment insert → welcome WA queue → returns both ids; phone-duplicate check returns a warning the UI can confirm-through).

---

## Technical notes

- All new UI uses the existing brown/cream tokens already in `styles.css` — no palette additions.
- Mobile-first: artisan flows use the existing `<Sheet side="bottom">` pattern.
- Role gates use `CAN.*` from `src/lib/permissions.ts`; new helpers `CAN.manageServices = admin` and `CAN.bill = admin|manager|technician|reception`.
- No new top-level routes — everything plugs into the 3 existing portals (`/artisan/today`, `/concierge/desk`, `/guardian/view`).
- Edge Functions: NOT used. All server logic goes through `createServerFn` per project conventions; M-Pesa callback route already exists.

---

## Build order

1. Wave A migration (await approval) → types regen.
2. Wave B Services CRUD tab.
3. Wave C booking + new-client (desk + artisan + manager booking sheet).
4. Wave D billing sheet + PIN guard + WhatsApp templates + serverFns.

Each wave ends compilable and testable. After Wave D I'll summarize what's live and what still needs Daraja secrets / WhatsApp BSP credentials.
