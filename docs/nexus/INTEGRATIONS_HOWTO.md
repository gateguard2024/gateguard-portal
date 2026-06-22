# Nexus Integrations — Easy How-To Guide

Plain, step-by-step. Three parts:
1. **Corporate** — connect a property's systems (the keys).
2. **Dealer admin** — decide who on the team can use them.
3. **Dealer staff** — use doors, cameras, relays, and network.

Words: a **site** = a property. A **system** = Brivo (doors), Eagle Eye (cameras), Shelly (relays/power), UniFi (network + access doors).

---

# PART 1 — Corporate: connect a property's systems

> Only Gate Guard corporate does this. Dealers never see or type these keys.

### Get to the right place
1. Log in. Open **Internal → Site Integrations** (or Operations → Find Property → open the site → **Site Systems → Setup**).
2. Find the property. The list shows a chip per system: **grey "—"** = not set, **amber** = saved, **green ✓** = verified. Use the **"Not connected"** filter to find properties still needing setup.
3. Click the property → the **Setup** tab → you'll see Brivo, Eagle Eye, Shelly, UniFi.

### Connect Brivo (doors + door users)
1. Click **Set up** on Brivo.
2. Type that property's own: **username, password, API key, client ID, client secret, site ID** (all from that property's Brivo account).
3. Click **Save** → **Test**. Green **Verified** = done.

### Connect Eagle Eye (cameras)
1. Click **Set up** on Eagle Eye. Type the property's **client ID + client secret** (from the Eagle Eye developer portal). **Save**.
2. Click **Connect Eagle Eye →**. Log in to Eagle Eye when it asks, approve, and it brings you back. Status turns **Verified**.
   *(One-time: in the Eagle Eye developer portal set the app's redirect URL to `https://<our-domain>/api/eagle-eye/callback`.)*

### Connect Shelly (relays / power)
1. Click **Set up** on Shelly. Type the **Cloud auth key** + **Cloud server** (e.g. `shelly-12-eu.shelly.cloud`). **Save** → **Test**.

### Connect UniFi (network + access doors)
1. Click **Set up** on UniFi.
2. **Network:** type the **Network controller URL**, **Network API key** (UniFi → Settings → API), and **site** (usually `default`).
3. **Access (doors):** type the **Access controller URL** (`https://<ip>:12445`) and **Access API token** (UniFi Access → Settings → API Token). *(The Access controller must be reachable from the internet.)*
4. **Save.**

### Edit or remove later
Same Setup tab → **Update** a system (change one field; blanks don't erase the rest) or **Remove** to disconnect it.

---

# PART 2 — Dealer admin: give your team access

> A dealer admin decides who can do what. New staff start with **nothing** until you switch it on. (You, the admin, and corporate already have everything.)

1. Open **Internal/Users** → click one of your people.
2. Find **"Site Systems access."**
3. Flip the switches for what they may do:
   - 🚪 **Doors** — unlock doors
   - 👥 **Door users** — add/remove people in Brivo
   - 📹 **Cameras** — view cameras
   - 🔌 **Relays** — switch power relays
   - 🌐 **Network** — see UniFi devices
4. Choose **All our sites** *or* **Pick sites** (check the buildings they cover).
5. It saves as you tap. Re-open to confirm. To remove access later, switch it back off.

---

# PART 3 — Dealer staff: use the systems

**Where:** Operations → Find Property → open your property → the **"Site Systems"** card with tabs. You only see what your admin turned on.

### 🛡 Security tab (the main one — no Eagle Eye needed)
- See each **door with its live camera**.
- **Unlock** a door → confirm → it opens (and is logged with your name + time).
- **Live recording** → watch the last couple minutes.
- Under a door, recent **"🔓 unlocked …"** lines → tap **▶ clip** to watch that exact moment.

### 🚪 Doors tab
- List of doors. **Unlock** (with confirm).
- **+ Camera** to link the camera that watches a door (or tap the **💡 suggested** camera). Add tags if you want.

### 🔌 Relays tab
- Your Shelly relays with ON/OFF. **Turn ON / Turn OFF** (confirm — it's a real switch). Logged.

### 🌐 Network tab
- **Connected devices** on the property's UniFi network.
- **UniFi Access doors** (if used) — **Unlock** with confirm.

### If something says "not connected" or "contact Gate Guard"
That system isn't set up for the property yet, or you don't have access to it. Ask Gate Guard (for setup) or your dealer admin (for access).

---

## Quick cheat sheet
| Who | Does what | Where |
|----|-----------|-------|
| Corporate | Enter/Test/Remove system keys | Internal → Site Integrations → site → Setup |
| Dealer admin | Switch on capabilities per person + pick sites | Internal/Users → person → Site Systems access |
| Dealer staff | Watch + unlock doors, view cameras, switch relays, see network | Operations → Find Property → site → Site Systems |
