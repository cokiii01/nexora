import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The dev server forwards API + WebSocket calls to the FastAPI backend, so the browser only ever
// talks to one origin (no CORS problems, works from localhost, 127.0.0.1, [::1] or a LAN IP / phone).
const backend = 'http://127.0.0.1:8000'
const proxy = {
  '/api': { target: backend, changeOrigin: true },
  '/ws': { target: backend.replace(/^http/, 'ws'), ws: true, changeOrigin: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
