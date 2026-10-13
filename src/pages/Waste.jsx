import { useState } from 'react'
import { ApiDown, Card, Loading, PageHead, Stat } from '../components/ui'
import { api, fmt, usePoll } from '../lib/api'

const W = 1000, H = 700
const px = (x) => 30 + x * (W - 60)
const py = (y) => 30 + y * (H - 110)
const ZONES = [
  { name: 'Zone A', x: 0, w: 0.4, label: 'Residential' },
  { name: 'Zone B', x: 0.4, w: 0.22, label: 'Commercial' },
  { name: 'Zone C', x: 0.62, w: 0.38, label: 'Residential' },
]

function fillTone(v, t) {
  if (v >= t) return 'crit'
  if (v >= t - 20) return 'warn'
  return 'ok'
}

function Waste({ session }) {
  const [threshold, setThreshold] = useState(80)
  const { data, error, loading, refresh } = usePoll(`/waste?threshold=${threshold}`, 4000)
  const [msg, setMsg] = useState('')
  const staff = session?.user?.role !== 'resident'

  if (loading && !data) return <><ApiDown error={error} /><Loading /></>
  if (!data) return <ApiDown error={error} />

  const byId = Object.fromEntries(data.bins.map((b) => [b.device_id, { ...b, meta: JSON.parse(b.meta || '{}') }]))
  const pos = (id) => (id === 'DEPOT' ? [px(data.depot.x), py(data.depot.y)] : [px(byId[id].meta.x), py(byId[id].meta.y)])
  const routePts = data.due.length ? data.route.map(pos) : []
  const totals = data.history.totals

  const collect = async () => {
    try {
      const r = await api('/waste/collect', { method: 'POST', body: { threshold } })
      setMsg(`Truck dispatched: ${r.collected.length} bins, ${r.route_km} km (saved ${r.saved_km} km vs visiting every bin).`)
      refresh()
    } catch (e) { setMsg(e.message) }
  }

  return (
    <section className="ov cx-module">
      <ApiDown error={error} />
      <PageHead title="Waste — collect only full bins" desc="Ultrasonic fill sensors on communal bins. The truck only visits bins above the threshold, in the shortest order." />

      <div className="ov-card cx-stats4" style={{ '--i': 0 }}>
        <Stat label="Bins due" value={data.due.length} unit={`/ ${data.bins.length}`} note={`≥ ${threshold}% full`} tone={data.due.length ? 'warn' : 'ok'} />
        <Stat label="Today's route" value={fmt.num(data.route_km, 1)} unit="km" note={`vs ${fmt.num(data.baseline_km, 1)} km fixed round`} />
        <Stat label="Saved this run" value={`${fmt.num(data.saved_pct, 0)}%`} note={`${fmt.num(data.fuel_saved_l, 1)} L diesel · ${fmt.num(data.co2_saved_kg, 1)} kg CO₂`} tone="ok" />
        <Stat label="Saved to date" value={fmt.num(totals.base - totals.km, 0)} unit="km" note={`${fmt.num(totals.co2, 0)} kg CO₂ over ${totals.n} runs`} tone="ok" />
      </div>

      <div className="ov-grid ov-grid-main">
        <Card title="Collection route" sub={data.due.length ? data.route.join(' → ') : 'No collection needed'} icon="⌖" i={1} className="ws-map-card">
          <svg className="ws-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Township bin map and route">
            {ZONES.map((z) => (
              <g key={z.name}>
                <rect x={px(z.x)} y={py(0)} width={z.w * (W - 60)} height={py(1) - py(0)} className="ws-zone" rx="10" />
                <text x={px(z.x) + 12} y={py(0) + 22} className="ws-zone-label">{z.name} · {z.label}</text>
              </g>
            ))}
            {routePts.length > 1 && (
              <polyline className="ws-route" points={routePts.map((p) => p.join(',')).join(' ')} pathLength="1" />
            )}
            <g transform={`translate(${px(data.depot.x)},${py(data.depot.y)})`}>
              <rect x="-26" y="-14" width="52" height="28" rx="6" className="ws-depot" />
              <text y="5" textAnchor="middle" className="ws-depot-label">DEPOT</text>
            </g>
            {Object.values(byId).map((b) => {
              const [x, y] = pos(b.device_id)
              const v = b.last_value || 0
              const tone = fillTone(v, threshold)
              const order = data.route.indexOf(b.device_id)
              return (
                <g key={b.device_id} transform={`translate(${x},${y})`} className={`ws-bin ${tone}`}>
                  <title>{`${b.device_id}: ${v.toFixed(0)}% full`}</title>
                  <rect x="-17" y="-22" width="34" height="44" rx="6" className="ws-bin-body" />
                  <rect x="-13" y={18 - (v / 100) * 36} width="26" height={(v / 100) * 36} rx="3" className="ws-bin-fill" />
                  <text y="38" textAnchor="middle" className="ws-bin-label">{b.device_id.slice(-2)} · {v.toFixed(0)}%</text>
                  {order > 0 && <g transform="translate(18,-22)"><circle r="10" className="ws-order" /><text y="4" textAnchor="middle" className="ws-order-label">{order}</text></g>}
                </g>
              )
            })}
          </svg>
        </Card>

        <Card title="Dispatch" icon="▶" i={2}>
          <label className="cx-range">
            <span>Collect bins at or above <b>{threshold}%</b></span>
            <input type="range" min="50" max="95" step="5" value={threshold} onChange={(e) => setThreshold(+e.target.value)} />
          </label>
          <ul className="ov-stage-list ws-binlist">
            {data.bins.slice().sort((a, b) => (b.last_value || 0) - (a.last_value || 0)).map((b) => (
              <li key={b.device_id}>
                <div><span>{b.device_id} · {b.zone}</span><b>{fmt.num(b.last_value, 0)}%</b></div>
                <div className="ov-track"><i className={`ws-${fillTone(b.last_value || 0, threshold)}`} style={{ width: `${b.last_value || 0}%` }} /></div>
              </li>
            ))}
          </ul>
          {staff && <button type="button" className="cx-btn-primary cx-btn-block" disabled={!data.due.length} onClick={collect}>Dispatch truck ({data.due.length} bins)</button>}
          {msg && <p className="ov-footnote">{msg}</p>}
          <p className="ov-footnote">Route: {data.assumptions.algorithm}. Road distance = straight line × {data.assumptions.road_circuity}. Truck {data.assumptions.truck_l_per_km} L/km, diesel {data.assumptions.diesel_co2_kg_per_l} kg CO₂/L.</p>
        </Card>
      </div>
    </section>
  )
}

export default Waste
