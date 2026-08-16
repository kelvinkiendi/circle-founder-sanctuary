# Circle Founder Sanctuary

**Stack:** PostgreSQL · Supabase · React · TypeScript · Tailwind CSS

B2B membership management system for COTERIE Nail Sanctuary's exclusive **Founder Circle** — 
a luxury tiered program limited to 25 members. Handles enrollment, perks tracking, appointment 
scheduling, product pre-launch access, surprise moments, and founder brunch events.

---

## 🏗 Backend Architecture

### Database Layer (PostgreSQL + Supabase)
- **9 normalized tables** with foreign key relationships
- Row Level Security (RLS) policies for data isolation
- Automated triggers for perks expiry and engagement scoring

### Core Tables

| Table | Purpose |
|-------|---------|
| `clients` | Member profiles with client type (regular/founder), contact info, status |
| `founder_circle` | Enrollment tracking, payment status, term dates, founder number (1-25) |
| `appointments` | Specialized booking types: weekly refresh, gel rescue, travel touchup, birthday sanctuary, emergency |
| `perks_usage` | Perk redemption tracking with week/month allocation and expiry |
| `surprise_moments_log` | Documented surprise rewards and random upgrades |
| `products` | Product catalog with founder pricing (cost + 20%), prelaunch access |
| `founder_purchases` | Purchase history with prelaunch window tracking |
| `founder_brunch_events` | Exclusive event management |
| `brunch_attendance` | RSVP tracking with dietary notes and photo consent |

### Business Logic
- **Founder limit enforcement:** Hard cap of 25 active founders
- **Perk allocation:** Weekly refreshes, travel touchups, surprise moments auto-assigned
- **Engagement scoring:** Automated scoring based on appointment frequency and purchases
- **Referral tracking:** Referral count linked to founder rewards

---


## 📁 Project Structure
```

---
├── src/
│   ├── components/         # React components (dashboard, sidebar, stats cards)
│   ├── pages/              # Route pages (Clients, Circle, Appointments, Perks, etc.)
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Utilities and API clients
├── supabase/
│   └── migrations/         # PostgreSQL schema and policies
├── public/                 # Static assets
└── package.json
---
```
## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Tailwind CSS, Vite |
| UI Theme | Custom brown (#5D4037) & cream (#F5F5DC) with gold accents |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Deployment | Supabase Cloud |

---

## 🚀 Getting Started

```bash
# Clone
git clone https://github.com/kelvinkiendi/circle-founder-sanctuary.git

# Install dependencies
npm install

# Start dev server
npm run dev
