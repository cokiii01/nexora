# Deploy NEXORA free (GitHub + Render + Vercel)

1. Push the folder to a GitHub repo (do NOT commit node_modules, dist, backend/nexora.db*, .env — .gitignore handles it).
2. Render (backend): New > Blueprint (uses render.yaml) or New > Web Service: Root Directory `backend`, Build `pip install -r requirements.txt`, Start `uvicorn main:app --host 0.0.0.0 --port $PORT`, Plan Free. Copy the URL, e.g. https://nexora-api.onrender.com
3. Vercel (frontend): Import the repo, Framework Vite, Root `./`, env var `VITE_API_URL` = the Render URL (no trailing slash). Deploy. Copy the Vercel URL.
4. Back on Render > Environment: set `NEXORA_CORS_ORIGINS` = the Vercel URL. Save (it redeploys).
5. Open the Vercel URL, sign in with the demo account (operator@nexora.demo / nexora123).

Free-tier notes: Render sleeps after ~15 min idle (first load ~50 s: open the /api/health URL a minute before showing it). The database resets to fresh demo data on every restart.
