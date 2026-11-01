# Gate Guard Edge — device ⇄ Nexus contract (v1)

The Edge box (Jetson Orin Nano) runs **Frigate** plus a small **Gate Guard agent**.
Nexus never relays video. The browser talks **straight to the device** for live
view, playback, snapshots and clips. Nexus only hands out short-lived **passes**
after checking that the person may use cameras at that property.

```
Browser ──(pass)──▶ https://<device>.edge.gateguard.co ──▶ Gate Guard agent ──▶ Frigate (localhost:5000)
Nexus   ──(pass, scope "api")──▶ same address              (JSON only: config, events, recordings)
```

## 1. Reaching the device
- Every box has a stable **HTTPS** address, e.g. `https://gge-0001.edge.gateguard.co`
  (Cloudflare Tunnel or equivalent — no open ports on the property network).
  Nexus refuses any address that isn't `https://`.
- WebSockets must pass through (live view uses `wss://…/live/mse/api/ws`).
- For lowest latency, enable **HTTP/2** and keep the tunnel connector on the box.
- In Nexus: Systems → property → **Setup & keys → Gate Guard Edge** (corporate only):
  - device address
  - device ID
  - device pass secret (32+ random bytes, the same value as on the box)

## 2. The pass (the agent MUST check it on every request)
```
gg1.<base64url(JSON payload)>.<base64url(HMAC-SHA256(secret, "gg1." + payload))>
payload = { v:1, sid:<site uuid>, did:<device id>, sub:<user id|"nexus">,
            sc:[scopes], cam:"*" | [camera names], iat, exp }
```
- Accept it from `Authorization: Bearer <pass>`, the `?gg=<pass>` query parameter
  (needed for `<video>`, `<img>`, HLS segment and WebSocket URLs), or a cookie the
  agent sets after the first valid `?gg=` (optional).
- Reject (401) when:
  - the signature is wrong (constant-time compare)
  - `exp` is in the past (allow 30 s of clock skew)
  - `did` isn't this box
  - the camera in the path isn't in `cam`
  - the scope doesn't cover the path
- Passes last 15 minutes; Nexus renews them before expiry.
- **HLS playlists:** when a `.m3u8` is requested with `?gg=`, rewrite every URI inside
  it (segments, init segment, variant playlists) to carry the same `?gg=`. Safari's
  built-in player can't add headers. hls.js sends `Authorization: Bearer` instead,
  and both must work.
- Reference implementation of the check: `verifyEdgePass()` in `lib/edge.ts`.

| Scope      | Paths (Frigate's own, unchanged)                                   |
|------------|--------------------------------------------------------------------|
| `live`     | `/live/mse/api/ws?src=<cam>`, `/live/webrtc/api/ws?src=<cam>`      |
| `snapshot` | `/api/<cam>/latest.webp`, `/api/<cam>/latest.jpg`                  |
| `vod`      | `/vod/<cam>/start/<s>/end/<e>/index.m3u8` (+ its segments)         |
| `events`   | `/api/events…`, `/api/events/<id>/thumbnail.webp`, `/api/events/<id>/snapshot.jpg`, `/api/review…` |
| `export`   | `/api/<cam>/start/<s>/end/<e>/clip.mp4`, `/api/events/<id>/clip.mp4` |
| `api`      | `/api/config`, `/api/version`, `/api/<cam>/recordings?after&before`, `/api/stats`, plus everything above |

## 3. CORS
- `Access-Control-Allow-Origin`: the Nexus origins only. These are `https://portal.gateguard.co` and the beta preview URL `https://gateguard-portal-git-beta-gate-guard.vercel.app`.
- `Access-Control-Allow-Headers: Authorization, Range`.
- `Access-Control-Expose-Headers: Content-Length, Content-Range`.
- Answer `OPTIONS` preflights without a pass.

## 4. What Nexus calls today (step 1 — cameras)
- **Camera list:** `GET /api/config` (keys of `cameras`, `friendly_name`, `enabled`).
- **Test button:** `GET /api/version`.
- **Event search:** `GET /api/events?after=&before=&cameras=&limit=300`. It reads:
  - `id`, `camera`, `label`, `sub_label`, `start_time`, `end_time`, `has_clip`
  - `data.top_score`
  - `data.recognized_license_plate` (Frigate LPR)
- **Timeline:** `GET /api/<cam>/recordings?after=&before=` (`start_time`, `end_time` in epoch seconds).
- **Browser playback, direct to the device:**
  - Live: MSE over WebSocket (`/live/mse/api/ws?src=<cam>&gg=…`). If the browser can't do MSE, it falls back to `latest.webp` refreshed every second.
  - Playback: HLS `/vod/<cam>/start/<s>/end/<e>/index.m3u8?gg=…`.
  - Downloads: `clip.mp4`.

## 5. Coming in step 2 (AI alerts) — device pushes to Nexus
- `POST https://portal.gateguard.co/api/edge/events`, signed with the same secret (header `X-GG-Signature: base64(HMAC-SHA256(secret, raw body))`).
- `gate_state` — from a Frigate 0.17 **state classification** model ("open"/"closed") on each gate camera. Payload: `{ device_id, camera, gate, state, since }`.
- `gate_open_too_long` — the agent's timer, set per gate in Nexus (default 5 min).
- `tailgate` — more than one vehicle (or person) crosses the gate zone during one open cycle. The agent counts Frigate objects entering the zone between `open` and `closed`.
- `heartbeat` every 60 s — CPU/GPU temperature, disk, camera health (→ the Health tile).
- Nexus turns these into Faults (auto-resolve on `closed`), texts/push to on-call, and Lexi alerts.
