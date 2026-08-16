# The Circle Sanctuary

Build "The Circle" — a luxury nail studio POS system for COTERIE Nail Sanctuary with a rich brown and cream color palette (elegant, minimal, spa-like aesthetic).

Create the database schema in Supabase with these tables:

1. clients table: id, full_name, phone, email, whatsapp_number, birthday, address, service_area, client_type (regular/founder), status (active/inactive), created_at, notes

2. founder_circle table: id, client_id (FK), enrollment_date, term_end_date, enrollment_fee_paid (boolean), payment_method (full/installment), installment_count, total_paid_ksh, status (active/expired/pending), founder_number (1-25), referral_count, total_spend, engagement_score

3. appointments table: id, client_id (FK), appointment_type (weekly_refresh/gel_rescue/travel_touchup/full_manicure/pedicure/surprise_full/random_upgrade/birthday_sanctuary/emergency), scheduled_date, scheduled_time, duration_minutes, status (booked/completed/no-show/cancelled/forfeited), location (studio/travel), notes, created_by, created_at

4. perks_usage table: id, founder_id (FK), perk_type (weekly_refresh/gel_rescue/travel_touchup/surprise_full/birthday_sanctuary/random_upgrade/just_because), week_number (for weekly), month_number (for travel), used_date, expiry_date, status (available/used/expired/forfeited), related_appointment_id

5. surprise_moments_log table: id, founder_id (FK), surprise_type, awarded_date, awarded_reason, related_appointment_id, documented_by, created_at

6. products table: id, name, category (cuticle_oil/shoe_horn/gloves/magnetic_clasp), cost_price, founder_price (cost + 20%), retail_price, stock_quantity, launch_status (prelaunch/public)

7. founder_purchases table: id, founder_id (FK), product_id (FK), quantity, price_applied, purchase_date, prelaunch_window (boolean)

8. founder_brunch_events table: id, event_name, event_date, venue, status, created_at

9. brunch_attendance table: id, event_id (FK), founder_id (FK), attendance_status (confirmed/attended/no_show), dietary_notes, photo_consent (boolean)

Build the main dashboard layout with:

- Sidebar navigation: Dashboard, All Clients, The Circle (Founders), Appointments, Perks Tracker, Surprise Moments, Product Vault, Founder Brunch, Settings

- Top bar with COTERIE logo, search, notifications bell

- Stats cards showing: Total Clients, Active Founders (max 25), Today's Appointments, Weekly Refreshes Used This Week

- Use brown (#5D4037) and cream (#F5F5DC) as primary colors with gold accents

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/92830508-2d42-4b94-a8dc-89e6862170dd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
