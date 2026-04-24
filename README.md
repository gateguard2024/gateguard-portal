<div align="center">
  <h1>🛡️ GateGuard OS — Dealer Portal</h1>
  <p><strong>The all-in-one security operations platform for dealers, MSOs, and properties.</strong></p>
  <p>
    <a href="https://portal.gateguard.co">portal.gateguard.co</a> ·
    <a href="https://gateguard.co">gateguard.co</a>
  </p>
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" />
  <img src="https://img.shields.io/badge/Vercel-deployed-black?logo=vercel" />
  <img src="https://img.shields.io/badge/Supabase-database-3ECF8E?logo=supabase" />
  <img src="https://img.shields.io/badge/Clerk-auth-6C47FF?logo=clerk" />
</div>

---

## What is GateGuard OS?

GateGuard OS is the unified operations platform for the GateGuard security ecosystem — cameras, access control, billing, quoting, CRM, and maintenance in one place.

Built for dealers. Sold to properties.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Auth | Clerk (multi-tenant orgs) |
| Database | Supabase (Postgres + RLS) |
| Hosting | Vercel |
| SMS | Twilio |
| Cameras | EagleEye Networks → GateGuard Bridge |
| Access | Brivo + Ubiquiti → GateGuard Panel |

## Getting Started

```bash
npm install
cp .env.example .env.local
# fill in .env.local
npm run dev
```

See `USER_GUIDE.md` for full setup and `DEPLOY.md` for deployment.

## Organization Hierarchy

```
GateGuard Corporate
  └── MSO (Master System Operators)
        └── SO / Dealer (Gate Guard, LLC)
              └── Channel Partners
                    └── Clients (Properties)
                          └── Employees / Residents
```

## Phase Roadmap

| Phase | Status | Scope |
|-------|--------|-------|
| 1 | ✅ Done | UI shell, all pages, dark mode |
| 2 | 🔄 Next | Auth, Supabase, live EagleEye + Brivo APIs |
| 3 | ⏳ | QuickBooks, Twilio, Ubiquiti Callbox |
| 4 | ⏳ | AI features, SOC view |
| 5 | ⏳ | Mobile app, white-label portals |

---

© 2026 Gate Guard, LLC · rfeldman@gateguard.co
