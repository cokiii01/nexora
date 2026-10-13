# NEXORA — Township Operations Platform

Track: **Planet** — water conservation and climate resilience.

**One problem:** township water fails silently — hidden leaks, blocked drains and flood blind spots, and sensors that die unnoticed. NEXORA catches each early and keeps a person in charge of the response.
Built for the Sime Darby Property University Hackathon — *Township of Tomorrow*.

NEXORA turns cheap sensors and resident reports into **jobs that get fixed**. The core engines are rule-based,
so every alert can be explained to a judge or an engineer.

| Module | What it does | How (no AI) |
|---|---|---|
| **Water & leaks** | Finds hidden leaks per zone and puts an RM figure on them | Minimum Night Flow (02:00–04:00) per District Metered Area, plus a live demand-profile check for bursts |
| **Flood warning** | Drain and pond levels with Normal → Alert → Warning → Danger stages (JPS); residents of that zone get alerts | Thresholds with hysteresis, rate-of-rise, Telegram bot + in-app feed |
| **Sensor health** | Spots a broken sensor and keeps its readings out of the alarms | Impossible value (range check) or N identical readings while the rain gauge reports rain (flatline); opens a maintenance job |
| **Dispatch approval** | A sensor rule opens the job, a person approves sending the crew | Flood and water-leak jobs raised by sensors wait in *Awaiting approval*; the API refuses to assign or start them until approved (HTTP 409). Resident flood alerts are not held back |
| **Work orders** | Every report and sensor alert becomes a job with a team, an SLA clock, a timeline and a resident rating | SLA per category, auto-assign, status flow, public tracking code |
| **Resident Connect** | Mobile PWA: report with photo + GPS, track like a parcel, rate the fix, receive zone alerts | Installable to the phone home screen |
| **Devices** | Live sensor list; simulator ↔ real ESP32 on the same API | `POST /api/v2/ingest` with a per-device key |
| **Climate-resilience report** | Flood exposure by sensor, approval time, sensor availability and recoverable water; print to PDF, CSV export | `GET /api/v2/reports/resilience`, computed from stored alerts and jobs; estimates are labelled |
| **Business case** | Editable ROI, a flood "cost of waiting" comparison and a *Township Care* per-home-per-month model for after handover | Live water loss pulled into the calculator; every assumption editable |
| *Not in the app menu* | Waste routing prototype (code kept in `src/pages/Waste.jsx` and the backend `waste.py`) | Out of scope for the water focus |

The **Explore** section holds two views wired to the live engine:

- **Digital Twin (3D only)**: leaking zones pulse pink with their m³/day and RM/year; drains and the retention pond fill to
  the real sensor level and change colour by stage; rain falls when the gauge reports rainfall. A **Live township
  scenarios** bar (Pipe burst · Cloudburst · Heavy rain · Reset) triggers the real chain and switches to 3D.
- **Intelligence Graph**: built from live data every 5 s — zones, sensors, infrastructure, active alerts, open work
  orders, teams and residents. Red nodes need attention; click one to see what it's connected to.

The old Agent console and Sustainability pages are no longer in the menu (their code is still in `src/pages/`). The 2D map, the old
scenario simulator, the fake infrastructure panel and the IoT pipeline monitor were removed from Digital Twin.

---

## Run it locally (Windows)

Needs **Node.js 20.19+** and **Python 3.11+**.

```bat
:: 1) Backend
cd backend
py -m pip install -r requirements.txt
py -m uvicorn main:app --reload --port 8000

:: 2) Frontend (new terminal, project root)
npm install
npm run dev
```

Open http://localhost:5173 → **Explore NEXORA** → sign in with a demo account (one click):

| Account | Password | Sees |
|---|---|---|
| operator@nexora.demo | nexora123 | Command Centre, simulator controls |
| manager@nexora.demo | nexora123 | Same + reports |
| resident@nexora.demo | nexora123 | Resident Connect (Zone C) |

On first start the backend creates `backend/nexora.db`, seeds 20 devices, a week of 15-minute readings
(Zone C has a hidden 0.9 m³/h leak that began 3 nights ago) and a month of past jobs so reports aren't empty.
Delete `nexora.db` to start fresh.

## Guided demo (one click)

On the landing page press **Run guided demo**. NEXORA signs in as the demo operator and plays eight scenes:
living township → a drain sensor freezes during a cloudburst (detected as a *sensor fault*) → the flood is still caught
by the other sensors → the same event in 3D → Intelligence Graph → **a human approval** → cost of acting early vs. late →
closing. Controls: **Space** pause · **← →** previous / next scene · **F** fullscreen · timeline dots jump back.

How it stays honest:
- Each scene triggers the real backend (rain, sensor fault) and then **waits for the real state** (fault confirmed,
  Warning stage reached, job approved) — timers only pace the captions.
- Scene 6 waits until *you* press **Approve dispatch**. There is no auto-approve.
- It ends at "crew assigned, work under way" — it never claims the flood is resolved.
- If the backend is slow it keeps polling; if a step cannot start you get **Retry / Skip**.
- **Replay** and **Exit demo** call a reset: rain off, sensors repaired, and the demo's open flood / sensor-fault jobs are
  *closed with a note* (nothing is deleted). Jobs raised by residents and the hidden-leak job are left alone.

The cost scene uses **illustrative** assumptions (homes exposed, damage per home, share flooded early vs. late, crew rate)
written out as a formula and editable under *Business case → Cost of waiting*. Replace them with the township's own claims
and call-out data before quoting a number.

## 3-minute pitch demo script (manual)

1. **Overview** — "Zone C is losing ~19 m³ of water a day. Nobody reported it — the night flow did."
2. **Water** — show the pink nights on Zone C and the RM/year figure. Open the auto-created work order.
3. **Work orders** — the job is *Awaiting approval*: review the card and **Approve dispatch**, then start → resolve. Back on Water: *"Repaired · verify tonight"*.
4. **Digital Twin → Live scenarios → Cloudburst** (or pour water under the real sensor). The 3D model switches on:
   rain falls, the pond and drains fill and turn orange/red. Then **Flood**: Drains climb to Warning,
   a work order opens itself, and…
5. **Resident Connect on a phone** — the resident in Zone C already has the Danger alert. Report a blocked
   drain with a photo; it appears on the operator's screen instantly with a 24 h SLA.
6. **Resilience report** — open it to show the evidence the event left behind.
7. **Business case** — payback in months, cost per home per month.

Second terminal, no hardware needed — a virtual ESP32 posting over HTTP exactly like the firmware:

```bat
cd backend
py tools\esp32_sim.py --scenario storm
py tools\esp32_sim.py --scenario burst --zone A
```

## Hardware (when you reach the Top 10)

See [`firmware/README.md`](firmware/README.md): ESP32 + JSN-SR04T ultrasonic (~RM 80–120 for a demo rig), wiring,
and `firmware/nexora_node/nexora_node.ino`. Flash it, set `DEVICE_ID = "DL-A1"` and the device row flips
from *Sim* to *ESP32* — no backend change.

## Telegram alerts (optional, free)

1. In Telegram, talk to **@BotFather** → `/newbot` → copy the token.
2. Create a group "Penduduk Zone C", add the bot, send a message, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` to read the group's `chat.id` (negative number).
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (or `TELEGRAM_CHAT_ZONE_C`) before starting uvicorn.

## Deploy (free tiers)

- **Backend → Render**: New → Blueprint → this repo (`render.yaml`). Set `NEXORA_CORS_ORIGINS` to your Vercel URL.
  Free instances sleep after inactivity (first request ~1 min) and have no persistent disk, so the
  database re-seeds on restart. That's fine for judging; add a disk on a paid plan for real data.
- **Frontend → Vercel**: import the repo, framework *Vite*, env `VITE_API_URL=https://<your-render-app>.onrender.com`.
- Resident Connect is a PWA — on the phone open the Vercel URL → *Add to Home Screen*.

## Where the numbers come from

All engineering assumptions live in `backend/township/config.py` and are shown on screen:
night use 1.7 L/property/h, background leakage 1 L/property/h, hour-day factor 20, water cost RM 2.00/m³
(placeholder — confirm the operator's tariff), 220 L/person/day, truck 0.4 L/km, diesel 2.68 kg CO₂/L,
road circuity 1.3. Change them there (or via env vars) and every screen updates.

Governance and sensor health: `NEXORA_REQUIRE_APPROVAL=0` turns the approval step off (sensor jobs auto-assign again).
`NEXORA_FLATLINE_N` (default 8) is how many identical readings in a row mean a frozen sensor — the default suits the 3 s
simulator; raise it (e.g. 60) for a node that reports once a minute. A level sensor is only judged for flatlining while the
rain gauge reports ≥ 5 mm/h, because still water in dry weather is normal.

**Be upfront in the pitch:** sensor data is simulated until hardware is installed; zone sizes and
historical jobs are demo seed data. The detection logic, workflows and API are real.

## Architecture

```
ESP32 nodes ──HTTP JSON──▶  FastAPI /api/v2/ingest ──▶ rule engines (water · flood · pressure)
virtual ESP32 / simulator ─┘        │                         │
                                    ▼                         ▼
                              SQLite (readings,         alerts ─▶ notifications (in-app + Telegram)
                              devices, jobs, users)        └────▶ work orders (SLA, team, timeline)
                                    │
React (Vite) Command Centre  ◀──────┤  polling every 3–10 s
Resident Connect PWA         ◀──────┘
```

Key files: `src/demo/` (scenes, director, overlay), `backend/township/` (api, engine, water, waste, workorders, notify, auth, config),
`src/pages/` (Water, Flood, WorkOrders, Devices, Reports, Roi, Waste (prototype, not in the menu), ResidentApp, Login, Overview),
`src/lib/api.js` (API client), `src/nexora-v10.css` (design system).

## Replace the logo

One file: `public/nexora-logo.svg` (used in the landing page, sidebar, login and resident app). Also replace `public/favicon.svg` (browser tab) and, for the installable app, `public/icon-192.png` and `public/icon-512.png`. If your logo is a PNG, drop it in `public/` and change the path in `src/lib/brand.js`.

## Replace the landing video

File: `public/nexora-township.mp4` (plus `public/nexora-township-clean.png`, the still shown while it loads).
Best results: 1920x1080 or 3840x2160, H.264 MP4, no audio, 8–15 seconds, under about 15 MB, no text or labels burned in.
Compress a 4K file with: `ffmpeg -i in.mp4 -vf scale=1920:-2 -c:v libx264 -crf 22 -an -movflags +faststart nexora-township.mp4`
Make the poster from its first frame: `ffmpeg -i nexora-township.mp4 -frames:v 1 nexora-township-clean.png`

## Intro splash

`src/components/Intro.jsx`: the logo spins, the name appears, then the page opens (about 3 s, once per browser tab, click or any key to skip, off when the visitor prefers reduced motion). To see it again, open a new tab or clear `nexora-intro-seen` from Session Storage. To remove it, delete the `{intro && <Intro … />}` line in `src/App.jsx`.
