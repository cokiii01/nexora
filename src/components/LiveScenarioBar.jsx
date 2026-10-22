// Live township scenarios inside the Digital Twin.
// full chain fires: sensors → rules → work order → resident alert → 3D model.
import { useState } from 'react'
import { api, usePoll } from '../lib/api'
import { stageLabel } from '../lib/labels'

const SCENARIOS = [
  {
    key: 'burst', label: 'Pipe burst · Zone C', hint: '+3.5 m³/h on top of any existing Zone C leak',
    run: async () => {
      const d = await api('/devices')
      const base = d.leak?.['Zone C'] || 0
      try { sessionStorage.setItem('nexora.baseLeakC', String(base > 3 ? base - 3.5 : base)) } catch { /* storage unavailable */ }
      return api('/sim/leak', { method: 'POST', body: { zone: 'Zone C', m3h: Math.min(20, (base > 3 ? base - 3.5 : base) + 3.5) } })
    },
  },
  { key: 'storm', label: 'Cloudburst 90 mm/h', hint: 'Drains and pond rise to Warning / Danger', run: () => api('/sim/rain', { method: 'POST', body: { mm_per_h: 90 } }) },
  { key: 'heavy', label: 'Heavy rain 25 mm/h', hint: 'Drains reach Alert', run: () => api('/sim/rain', { method: 'POST', body: { mm_per_h: 25 } }) },
]

function LiveScenarioBar({ onRun }) {
  const summary = usePoll('/summary', 3000)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [active, setActive] = useState('') // last scenario started, shown highlighted
  const s = summary.data

  const run = async (sc) => {
    setBusy(sc.key)
    setMsg('')
    try {
      await sc.run()
      setActive(sc.key)
      onRun?.()
      setMsg(sc.key === 'burst'
        ? 'Burst injected. After about 15 seconds the flow rule trips: a “Possible burst main” work order opens for Zone C and the zone pulses in 3D.'
        : 'Rain started. Watch the drains fill in 3D — residents are alerted as each stage is crossed.')
    } catch (e) {
      setMsg(e.status === 401 || e.status === 403 ? 'Sign in as operator to run live scenarios.' : e.message)
    } finally {
      setBusy('')
    }
  }

  const reset = async () => {
    setBusy('reset')
    try {
      await api('/sim/reset', { method: 'POST' })
      setActive('')
      onRun?.()
      setMsg('Back to calm: rain off, burst removed, and the jobs these scenarios opened are closed with a note. Resident reports are untouched.')
    } catch (e) { setMsg(e.message) } finally { setBusy('') }
  }

  return (
    <div className="dt-live-bar">
      <div className="dt-live-head">
        <div>
          <span className="dt-live-kicker">LIVE TOWNSHIP SCENARIOS</span>
          <strong>Trigger a real event chain</strong>
        </div>
        {s && (
          <div className="dt-live-status">
            <span className={`t3d-chip stage-${s.flood_stage}`}>Flood {stageLabel(s.flood_stage)}</span>
            <span className={`t3d-chip ${s.leaking_zones.length ? 'leak' : 'ok'}`}>{s.leaking_zones.length ? `Leak: ${s.leaking_zones.join(', ')}` : 'No leaks'}</span>
            <span className="t3d-chip">{s.work_orders_open} open jobs</span>
          </div>
        )}
      </div>
      <div className="dt-live-actions">
        {SCENARIOS.map((sc) => (
          <button key={sc.key} type="button" className={sc.key === active ? 'primary' : ''} disabled={!!busy} onClick={() => run(sc)} title={sc.hint}>
            {busy === sc.key ? 'Starting…' : sc.label}
          </button>
        ))}
        <button type="button" disabled={!!busy} onClick={reset}>Reset scenarios</button>
      </div>
      {msg && <p className="dt-live-msg">{msg}</p>}
      {summary.error && !s && <p className="dt-live-msg">Live scenarios need the backend (/api/v2) running.</p>}
    </div>
  )
}

export default LiveScenarioBar
