# Handoff Brief — Gemini: Nexus **Systems** tab (installed systems + device health)

> Paste this ENTIRE doc into Gemini. Return ONE self-contained `.tsx`. Claude wires it to real APIs afterward. This is the bottom-nav **Systems** surface.

## Standard (match exactly)
GateGuard Nexus — dark frosted-**glass** UI. Next.js App Router, TypeScript, Tailwind **core utilities only** (no custom config, no UI libs).
- Cards/containers: `rounded-2xl`/`rounded-3xl`, bg `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`. Accents: brand `#6B7EFF`, cyan `#00C8FF`, emerald `#34D399` (online), amber `#FBBF24` (warning), red `#F87171` (offline).
- Inline `style={{}}` rgba() fine. Mobile-friendly; end with `pb-28`. **5th-grader simple.** Start with `'use client'`, default export, no required props, imports only `react` + `lucide-react`.

## What this is
The Systems tab answers "what's installed where, and is it working?" Pick a property → see its installed devices (cameras, gates, intercoms, access readers, NVR/switches), each with an online/offline health chip, last-seen time, and firmware. From a device you can jump to creating a work order if something's wrong.

## Layout
1. **Header** — "Systems" + subtitle ("Every installed device, and whether it's online.").
2. **Health summary strip** — 3–4 quick stat tiles across the top: Total devices · Online · Needs attention · Offline (color-coded numbers).
3. **Search + property list** — search box; list of sites. Each row: site name, address, a small health bar (e.g. "18/20 online"), a status chip (All good / Needs attention / Offline), device count.
4. Click a site → **detail glass pane** (object-format below).

## Object-format rule (every Nexus detail looks the same)
1. **Big top card** — label "SYSTEM", site name, address, overall health badge.
2. **Four quick facts** row — Devices · Online · Offline · Last checked. 4 columns.
3. **Human detail blocks**:
   - **Devices by category** — collapsible groups (Cameras, Access Readers, Intercoms, Gates, Network/NVR). Each device row: name/location, type icon, **health chip** (Online emerald / Warning amber / Offline red), firmware, last-seen relative time.
   - **Open issues** — any device flagged, with a one-line reason.
   - **Connectivity** — ISP / network summary line (provider, status).
   - **Activity** — recent ("Front gate reader went offline 2h ago").
4. **Right action rail** — most common first: **Create work order** (stub `onAction('new_wo', deviceOrSiteId)`), **Open site**, **Run health check**, **View design**, **Add note**.
5. Internal scroll + bottom padding.

## Data contract (Claude replaces stubs with these)
```ts
type Health = 'online' | 'warning' | 'offline'
type Device = { id: string; name: string; type: string; category: 'camera'|'reader'|'intercom'|'gate'|'network'; health: Health; firmware?: string; last_seen?: string; issue?: string|null }
type SiteSystem = {
  id: string
  site_name: string
  address?: string | null
  isp?: string | null
  device_total: number
  online: number
  offline: number
  warning: number
  last_checked: string
  devices: Device[]
  activity: { at: string; text: string }[]
}
// GET /api/nexus/systems          -> { sites: SiteSystem[] }
async function loadSystems(): Promise<SiteSystem[]>
// onAction(name, id) -> console.log (Claude wires: new_wo → work order create with site/device prefilled, open_site → /sites/<id>)
```
Provide `loadSystems()` with ~7 realistic sites (mostly healthy, a couple with offline/warning devices so the colors show). All state in React `useState`. **No localStorage.**

## Output rules
ONE `.tsx`, `'use client'`, default export `SystemsExplorer`, no required props, data behind `loadSystems()`/`onAction()`, Tailwind core only. Safe lucide named imports: `Search, Check, Wifi, WifiOff, Activity, Wrench, ChevronRight, Shield`. If you want any of `Camera, DoorOpen, Cpu, Server, Radio, AlertCircle`, import them via `require('lucide-react')`.
