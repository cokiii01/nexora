import { useCallback, useEffect, useRef, useState } from 'react'

// Dev: '' = same origin, Vite proxies /api and /ws to the backend (see vite.config.js).
// Production: set VITE_API_URL to the deployed backend, e.g. https://nexora-api.onrender.com
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const WS_BASE = API_BASE
  ? API_BASE.replace(/^http/, 'ws')
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
export const BACKEND_LABEL = API_BASE || 'http://127.0.0.1:8000 (via Vite proxy)'
const TOKEN_KEY = 'nexora.session'

export function loadSession() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  try {
    if (session) localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable — session lives in memory only */
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const session = loadSession()
  const headers = {}
  if (session?.token) headers.Authorization = `Bearer ${session.token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(`${API_BASE}/api/v2${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, `Cannot reach NEXORA backend at ${BACKEND_LABEL}. Is it running?`)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(', ') : data.detail
    if (res.status === 401 && session) {
      // stale token (e.g. database was reset) — drop it and tell the app to show the login screen
      saveSession(null)
      window.dispatchEvent(new Event('nexora:session-expired'))
    }
    throw new ApiError(res.status, detail || `Request failed (${res.status})`)
  }
  return data
}

export function fileUrl(path) {
  const session = loadSession()
  const sep = path.includes('?') ? '&' : '?'
  return `${API_BASE}/api/v2${path}${session?.token ? `${sep}token=${encodeURIComponent(session.token)}` : ''}`
}

/** Poll an endpoint. Returns { data, error, loading, refresh }. */
export function usePoll(path, intervalMs = 4000) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    if (!path) return
    try {
      const data = await api(path)
      if (alive.current) setState({ data, error: null, loading: false })
    } catch (error) {
      if (alive.current) setState((s) => ({ data: s.data, error, loading: false }))
    }
  }, [path])

  useEffect(() => {
    alive.current = true
    let timer
    const run = async () => {
      await refresh()
      if (alive.current && intervalMs) timer = setTimeout(run, intervalMs)
    }
    run()
    return () => {
      alive.current = false
      clearTimeout(timer)
    }
  }, [refresh, intervalMs])

  return { ...state, refresh }
}

export const fmt = {
  num: (v, d = 0) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d })),
  rm: (v) => (v === null || v === undefined ? '—' : `RM ${Number(v).toLocaleString('en-MY', { maximumFractionDigits: 0 })}`),
  time: (iso) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'),
  dateTime: (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'),
  ago: (iso) => {
    if (!iso) return '—'
    const s = (Date.now() - new Date(iso).getTime()) / 1000
    if (s < 60) return `${Math.max(0, Math.round(s))}s ago`
    if (s < 3600) return `${Math.round(s / 60)}m ago`
    if (s < 86400) return `${Math.round(s / 3600)}h ago`
    return `${Math.round(s / 86400)}d ago`
  },
  hours: (h) => {
    if (h === null || h === undefined) return '—'
    const a = Math.abs(h)
    const txt = a < 1 ? `${Math.round(a * 60)}m` : a < 48 ? `${a.toFixed(1)}h` : `${Math.round(a / 24)}d`
    return h < 0 ? `${txt} over` : txt
  },
}
