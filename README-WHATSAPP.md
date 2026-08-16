# COTERIE — WhatsApp Business API Module

This module sends templated WhatsApp messages to Circle members, records every message,
and reacts to delivery receipts and opt-out replies.

## 1. Architecture

| Piece | Location |
| --- | --- |
| Send pipeline (consent → template → rate limit → provider → log) | `src/lib/whatsapp-provider.server.ts` |
| Automation queue dispatcher | `src/lib/whatsapp-dispatch.server.ts` |
| Staff-facing server functions | `src/lib/whatsapp-api.functions.ts` |
| Meta webhook (status + STOP) | `/api/public/whatsapp/webhook` |
| Cron dispatcher | `POST /api/public/hooks/whatsapp-dispatch` (Bearer `CRON_SECRET`) |
| UI | `src/components/whatsapp/*`, WhatsApp tab in the Concierge Desk |

Database: `whatsapp_logs`, `whatsapp_templates`, plus `clients.whatsapp_opt_in`,
`clients.whatsapp_opt_in_at`, `clients.whatsapp_prefs`. All tables are reachable only
through the secure server layer (no browser grants).

## 2. Provider setup (Meta Cloud API — recommended for Kenya)

1. Create a Meta Business account and complete **Business Verification**.
2. Add the **WhatsApp** product, register your sender number (+254…) and verify it.
3. Submit the message templates listed in section 4 for approval (English + Swahili).
4. Generate a **permanent System User access token** with `whatsapp_business_messaging`.
5. Add these secrets to the backend:
   - `WHATSAPP_API_TOKEN` — permanent access token
   - `WHATSAPP_PHONE_NUMBER_ID` — sender phone number ID
   - `WHATSAPP_VERIFY_TOKEN` — any random string, used for webhook verification
   - `WHATSAPP_API_VERSION` — optional, defaults to `v20.0`
   - `WHATSAPP_ADMIN_NUMBER` — optional default test recipient

Twilio alternative: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`.

Without credentials the module runs in **log-only mode**: messages are composed,
consent-checked and stored, but never delivered. Nothing breaks.

## 3. Webhook

In Meta → WhatsApp → Configuration set:

- Callback URL: `https://<your-domain>/api/public/whatsapp/webhook`
- Verify token: the value of `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the `messages` field.

Handled events: `sent` / `delivered` / `read` / `failed` status updates, and inbound
`STOP`, `UNSUBSCRIBE`, `ACHA` (opt-out) or `START`, `SUBSCRIBE`, `ANZA` (opt-in).

## 4. Templates

Seeded in `whatsapp_templates` (EN + SW where relevant):
`founder_welcome`, `appointment_reminder`, `appointment_cancelled`, `perk_alert`,
`surprise_moment`, `payment_confirmation`, `payment_overdue`, `brunch_invite`,
`product_prelaunch`. Bodies use `{{variable}}` placeholders and are editable by admins
in the Templates tab, with live preview and test-send.

## 5. Automation

Database triggers queue a message when: a founder enrols, an appointment is booked or
cancelled, a surprise moment is awarded, a brunch event is created, a payment is marked
paid, or a product enters pre-launch. Queued rows are sent by the dispatcher.

Schedule it (daily/hourly) with:

```sql
select cron.schedule('whatsapp-dispatch', '*/15 * * * *', $$
  select extensions.http_post(
    url := 'https://<your-domain>/api/public/hooks/whatsapp-dispatch',
    headers := '{"Authorization":"Bearer <CRON_SECRET>"}'::jsonb
  );
$$);
```

Admins can also press **Send queued messages** in the Connection tab.

## 6. Compliance

- Explicit opt-in is required: `whatsapp_opt_in` must be true and `whatsapp_opt_out` false.
- Per-category preferences (appointments, perks, events, payments, marketing) are honoured.
- Rate limit: one message per template per client per hour, except templates marked critical.
- Phone numbers are normalised to `+254…` E.164; invalid numbers are never sent to.
- API credentials live only in server secrets — they are never returned to the browser
  (the Connection panel shows masked status only).
- All customer-facing timestamps render in EAT (UTC+3); amounts are KSH.
