# NEXORA

**Township water that watches itself, with a person still in charge.**

Planet track · Sime Darby Property University Hackathon 2026 · *Township of Tomorrow*  


| | |
|---|---|
| Live app | https://nexora-phi-inky.vercel.app |
| Backend API (health) | https://nexora-s3lb.onrender.com/api/health |
| Judge login | `operator@nexora.demo` / `nexora123` |

The free backend sleeps when idle, so open the health link first and wait until it says `ok` (about a minute). The database resets whenever the backend restarts, so the app always starts clean: no alerts and no work orders.

---

## The problem

Township water fails silently:

- **Hidden leaks.** At 3 am nobody is using water, so a leak can run for days unnoticed.
- **Flood blind spots.** A drain blocks, and the first sign is a flooded road.
- **Sensors that die unnoticed.** A frozen sensor either lies or stays silent.

NEXORA catches each one early, explains why it raised the alert, and turns it into a job that a person approves and a crew fixes.

## What it does

| Module | What it does | How it works |
|---|---|---|
| **Water and leaks** | Finds hidden leaks per zone and puts a figure on the water lost | Minimum night flow (02:00 to 04:00) per zone, plus a live demand-profile check for bursts |
| **Flood warning** | Drain and pond levels move through Normal, Alert, Warning, Danger; residents in that zone are alerted | Staged thresholds with a buffer (hysteresis) so alerts do not flicker, plus rate of rise |
| **Sensor health** | Detects a broken sensor and keeps its readings out of the alarms | Range check, or 8 identical readings while the rain gauge shows rain (flatline); opens a repair job |
| **Dispatch approval** | A rule opens the job, a person decides | Sensor-raised flood and leak jobs wait for approval. The API refuses to assign them without it (HTTP 409) |
| **Work orders** | Every alert and resident report becomes a job | Team, SLA clock, timeline, tracking code, resident rating |
| **Digital Twin (3D)** | The township in 3D, driven by live data | Leaking zones pulse, drains and the pond fill to the real sensor level, rain falls when the gauge reports rain |
| **Intelligence Graph** | Cause and effect on one screen | Zones, sensors, alerts, jobs, teams and residents linked from live data, refreshed every 5 s |
| **Resident Connect** | Phone app for residents | Report with photo and GPS, track like a parcel, receive zone alerts, installable PWA |
| **Climate-resilience report** | Evidence an event leaves behind | Flood exposure, approval time, sensor availability, recoverable water; print to PDF or CSV |
| **Business case** | What acting early is worth | Editable assumptions, written-out formulas, cost of waiting vs acting early |

## How to test it (for judges)

1. Open the live app, wake the backend (see above), and sign in with the judge login.
2. Open **Overview**. It starts clean: no leaks, no open jobs.
3. Go to **Digital Twin → Live township scenarios** and press **Cloudburst 90 mm/h**.
4. Watch the 3D drains and pond fill and change colour. Open **Flood** to see the stages rise.
5. Open **Work orders**. A flood job appears and waits in *Awaiting approval*. Press **Approve dispatch**, then start and resolve it.
6. Open **Devices** to see sensor health, **Intelligence Graph** for the cause-and-effect chain, and **Reports** and **Business case** for the evidence and cost views.
7. Press **Reset weather & burst** to stop the rain. Open jobs stay until a crew resolves them.

A **Pipe burst · Zone C** scenario is also there. After about 15 seconds the flow rule trips and a "Possible burst main" job appears under Work orders.

## Tech stack

**Frontend**
- React 19 with Vite 8 (single-page app)
- Plain CSS design system (`src/nexora-v10.css`, `src/App.css`), no UI framework
- 3D Digital Twin: three.js with react-three-fiber and drei
- Intelligence Graph: 3d-force-graph
- Resident Connect: installable PWA (service worker and web manifest)
- ESLint for code quality

**Backend**
- Python with FastAPI, served by Uvicorn
- SQLite database (readings, devices, alerts, jobs, users)
- A simulator ticks every 3 seconds and feeds the same ingest API a real device would use
- Rule engines in `backend/township/`: water (night flow, burst), flood (stages), sensor health (range, flatline)
- Role-based login (resident, operator, manager): PBKDF2 password hashes and session tokens
- Optional Telegram alerts

**Hardware path**
- ESP32 with a JSN-SR04T ultrasonic sensor (`firmware/`)
- A virtual ESP32 for testing without hardware (`backend/tools/esp32_sim.py`)

**Hosting**
- Frontend on Vercel, backend on Render (free tiers); both redeploy on every push to `main`

## Where "intelligence" comes from

The alerts are **rule-based on purpose**, so every alert can be explained to an engineer or a resident and nothing is a black box. The Intelligence Graph is built from live data and is not a chatbot. The backend also contains a small Random Forest model (scikit-learn) trained on **synthetic** data (`backend/train_model.py`). It is a prototype and is not used in the alerts above.

## Data, sources and assumptions

No proprietary data was provided or used.

| Item | What it is |
|---|---|
| Sensor readings (flow, pressure, drain and pond level, rain) | **Simulated** until hardware is installed. A real ESP32 posts to the same API (`POST /api/v2/ingest`) |
| Leak, flood and sensor-fault alerts | **Real logic** running on that simulated data |
| Dispatch approval | **Real**: the API refuses unapproved dispatch with HTTP 409 |
| Cost, tariff, CO₂ and hardware figures | **Editable scenario assumptions**, not verified savings. Defaults are in `backend/township/config.py`. Replace them with the township's own data before quoting a number |
| Resident survey | 7 responses from an informal Google Form: a small sample, not statistically representative |

## Run it locally

Needs Node.js 20.19+ and Python 3.11+.

```bash
# 1) Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# 2) Frontend (new terminal, project root)
npm install
npm run dev
```

Open http://localhost:5173 and sign in with a demo account:

| Account | Password | Sees |
|---|---|---|
| operator@nexora.demo | nexora123 | Command Centre and scenario controls |
| manager@nexora.demo | nexora123 | Same, plus reports |
| resident@nexora.demo | nexora123 | Resident Connect (Zone C) |

On first start the backend creates `backend/nexora.db` and seeds 20 devices, a week of readings and a month of past jobs. Delete the file to start fresh.

Optional settings (environment variables):

| Variable | Purpose |
|---|---|
| `NEXORA_DEMO_PASSWORD` | Password for the three demo accounts (default `nexora123`) |
| `NEXORA_SEED_LEAK_M3H` | Hidden Zone C leak in the seed data (default `0`, a clean start) |
| `NEXORA_REQUIRE_APPROVAL` | `0` turns the approval step off |
| `NEXORA_FLATLINE_N` | Identical readings that mean a frozen sensor (default `8`) |
| `NEXORA_CORS_ORIGINS` | Allowed frontend URL |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Optional Telegram alerts |

Virtual ESP32 (no hardware needed):

```bash
cd backend
python tools/esp32_sim.py --scenario storm
```

## Deploy (free tiers)

- **Backend on Render:** New → Blueprint → this repo (`render.yaml`). Set `NEXORA_CORS_ORIGINS` to the Vercel URL. Free instances sleep when idle and have no persistent disk, so the database re-seeds on restart.
- **Frontend on Vercel:** import the repo, framework *Vite*, env `VITE_API_URL=https://<your-render-app>.onrender.com`.
- **Phone app:** open the Vercel URL on a phone and choose *Add to Home Screen*.

## Project layout

```
src/            React app (pages, components, 3D scenes, API client)
backend/        FastAPI app, rule engines, simulator, ESP32 simulator
firmware/       ESP32 sketch and wiring notes
public/         Logo, icons, landing video, service worker
render.yaml     Backend deploy blueprint
```

## Credits and licences

Fonts: Inter and Geist (Google Fonts, open licence). Libraries: React, Vite, three.js, react-three-fiber, drei, 3d-force-graph, FastAPI, Uvicorn, scikit-learn.  
Landing video and image: [add source and licence here].
