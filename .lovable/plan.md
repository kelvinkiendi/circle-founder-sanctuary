## The Circle — PIN Login & Role-Based Portals

Build a single PIN-based entry point that routes 5 staff roles to dedicated portals with route guards.

### 1. Database (migration)

Extend existing `staff` table + add session/audit tables:
- `staff`: add `pin_hash` (text), `status` (active/inactive/locked), `last_login_at`, `failed_attempts` (int), `locked_until` (timestamptz), `must_change_pin` (bool, default true)
- Migrate existing plaintext `pin` values → hashed, then drop column
- Update `staff_role` enum to include: `admin`, `manager`, `technician`, `reception`, `guardian`
- New `staff_sessions`: id, staff_id, device_label, started_at, last_active_at, ended_at, portal
- New `staff_login_log`: id, staff_id, success (bool), ip, user_agent, attempted_at
- RPC `verify_staff_pin(pin text, device text)` — SECURITY DEFINER, returns `{staff_id, role, full_name, must_change_pin, session_id}` or null; handles lockout (3 fails → 15 min) + writes login log
- RPC `change_staff_pin(session_id, new_pin)` and `staff_logout(session_id)`
- Seed: default admin row with PIN `0000`, `must_change_pin = true` (only if no admin exists)

PIN hashing uses pgcrypto `crypt(pin, gen_salt('bf'))`.

### 2. Server functions (`src/lib/auth.functions.ts`)

- `loginWithPin({ pin, device })` — calls `verify_staff_pin`, returns session token (session_id is the token, stored client-side)
- `getSession({ sessionId })` — validates + returns staff row & role; updates `last_active_at`
- `logout({ sessionId })`
- `changePin({ sessionId, newPin })`
- `adminResetPin({ sessionId, staffId })` — admin-only, generates random PIN, logs to `whatsapp_messages` queue
- `listLoginLog({ sessionId, staffId? })` — admin sees all, others see self

All use `supabaseAdmin` (no Supabase Auth involved — pure custom PIN scheme).

### 3. Client session context

`src/lib/session.tsx`:
- `SessionProvider` storing `{ sessionId, staff }` in `localStorage` (`coterie_session`)
- `useSession()` hook
- `RequireRole({ roles, children })` component — redirects to `/` if not authorized
- Inactivity timer: admin 60min, technician 15min, others 30min → auto-logout

### 4. Routes

**Public:**
- `/` → new `Login` route (PIN pad). Replaces current `index.tsx` dashboard.
- `/change-pin` → forced PIN change screen

**Role layouts (pathless `_role` guards via beforeLoad):**
- `/admin/*` (Sanctuary) — full access, reuses existing dashboard/clients/founders/appointments/perks/surprises/products/brunch/payments/whatsapp/settings/tech pages
- `/manager/*` (Steward) — subset
- `/artisan/today` (Technician) — wraps existing `/tech` view, restricted to own appointments
- `/concierge/desk` (Concierge) — booking + check-in
- `/guardian/view` (Guardian) — read-only reports

Each portal has its own sidebar filtered by role permissions.

### 5. Login UI

`src/routes/index.tsx`:
- Full-screen `#5D4037` brown bg, `#F5F5DC` cream accents
- Centered: "COTERIE" wordmark + "THE CIRCLE" in Cormorant Garamond
- Subtitle "Nail Sanctuary — POS System"
- 4-digit PIN pad: 3×4 grid (1-9, ⌫, 0, clear), dot indicators
- Auto-submit on 4th digit
- Shake animation on error (Tailwind keyframe)
- Welcome flash → router.navigate to portal path by role
- Gentle fade-in on mount

### 6. Role permission map

Central `src/lib/permissions.ts`:
```
PORTAL_PATH = { admin: '/admin', manager: '/manager', technician: '/artisan/today', reception: '/concierge/desk', guardian: '/guardian/view' }
NAV_ITEMS_BY_ROLE = { admin: [...all], manager: [...subset], ... }
CAN = { awardJustBecause: ['admin'], approveGelRescue: ['admin','manager'], ... }
```

Existing pages stay where they are; the new portal layouts simply mount them as children and the sidebar filters items.

### 7. Admin portal switcher

Top-bar dropdown (admin only) navigates to any portal path without logout — session role stays `admin` so guards permit it.

### Technical notes

- Existing `/tech` PIN gate (localStorage `1234/2580/0000`) is removed; tech view now reads identity from `useSession()`.
- Existing routes (`/clients`, `/founders`, etc.) are aliased under `/admin/*` via new route files that re-export the same components; old top-level routes redirect to `/admin/...` if logged in as admin, else to `/`.
- Existing runtime hydration error in `/tech` will be resolved by removing its standalone PIN screen.
- No Supabase Auth — custom session model (acceptable for staff-only internal POS).
- Lockout & login log enforced server-side in `verify_staff_pin` RPC.
- WhatsApp PIN reset uses existing `whatsapp_messages` table as queue.

### Out of scope (deferred)

- Real SMS delivery for PIN reset (logged to WhatsApp queue only)
- Per-device session revocation UI (sessions table supports it; UI later)
- Biometric unlock
