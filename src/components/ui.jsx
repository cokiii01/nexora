// Shared building blocks for the V10 module pages.
import { BACKEND_LABEL } from '../lib/api'
import { stageLabel } from '../lib/labels'

export function Card({ title, sub, tag, tagTone = 'ok', icon = '◇', actions, children, className = '', i = 0 }) {
  return (
    <article className={`ov-card ${className}`} style={{ '--i': i }}>
      {(title || actions) && (
        <header className="ov-card-head">
          <div className="ov-title">
            <span className="ov-ico" aria-hidden="true">{icon}</span>
            <h2>{title}</h2>
            {sub && <span className="ov-sub">{sub}</span>}
            {tag && <b className={`ov-tag ${tagTone}`}>{tag}</b>}
          </div>
          {actions && <div className="cx-card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </article>
  )
}

export function PageHead({ title, desc, children }) {
  return (
    <div className="cx-pagehead">
      <div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {children && <div className="cx-pagehead-actions">{children}</div>}
    </div>
  )
}

export function Stat({ label, value, unit, note, tone }) {
  return (
    <div className="cx-stat">
      <span>{label}</span>
      <strong className={tone || ''}>{value}{unit && <small>{unit}</small>}</strong>
      {note && <em>{note}</em>}
    </div>
  )
}

export function ApiDown({ error }) {
  if (!error) return null
  return (
    <div className="cx-banner crit" role="alert">
      <strong>Backend not reachable.</strong> {error.message} Start it with <code>cd backend &amp;&amp; uvicorn main:app --reload</code> ({BACKEND_LABEL}).
    </div>
  )
}

export function Loading() {
  return <div className="cx-loading">Loading live data…</div>
}

const STAGE_TONE = { NORMAL: 'ok', WASPADA: 'warn', AMARAN: 'orange', BAHAYA: 'crit', WARNING: 'warn', CRITICAL: 'crit', INFO: 'low' }
export function Stage({ value }) {
  return <b className={`ov-stage ${STAGE_TONE[value] || 'low'}`}>{stageLabel(value)}</b>
}

const STATUS_TONE = { SUBMITTED: 'low', ASSIGNED: 'violet', IN_PROGRESS: 'warn', RESOLVED: 'ok', CLOSED: 'ok', AWAITING_APPROVAL: 'orange' }
/** Pass the work order (`wo`) to show "Awaiting approval" for jobs a person has not yet cleared for dispatch. */
export function Status({ value, wo }) {
  const v = wo?.awaiting_approval ? 'AWAITING_APPROVAL' : (value ?? wo?.status)
  return <b className={`ov-stage ${STATUS_TONE[v] || 'low'}`}>{v?.replace('_', ' ')}</b>
}

const SLA_TONE = { on_track: 'ok', at_risk: 'warn', breached: 'crit', met: 'ok' }
export function SlaBar({ sla }) {
  if (!sla) return null
  const label = sla.state === 'met' ? 'Met' : sla.state === 'breached' ? 'Breached' : `${sla.remaining_hours < 1 ? Math.round(sla.remaining_hours * 60) + 'm' : sla.remaining_hours.toFixed(1) + 'h'} left`
  return (
    <div className={`cx-sla ${SLA_TONE[sla.state]}`}>
      <div className="cx-sla-track"><i style={{ width: `${Math.min(100, sla.pct_used)}%` }} /></div>
      <span>{label}</span>
    </div>
  )
}

/** Minimal responsive line chart. series: [{ points:[{x:Date|number,y}], tone, dashed, label }] */
export function LineChart({ series, height = 180, yLabel = '', yMin = 0, bands = [], xFormat }) {
  const all = series.flatMap((s) => s.points)
  if (!all.length) return <div className="cx-empty">No readings yet.</div>
  const xs = all.map((p) => +p.x)
  const ys = all.map((p) => p.y).concat(bands.map((b) => b.y))
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const y0 = Math.min(yMin, ...ys), y1 = Math.max(...ys) * 1.08 || 1
  const W = 600, H = height, P = { l: 38, r: 8, t: 8, b: 20 }
  const sx = (x) => P.l + ((x - x0) / (x1 - x0 || 1)) * (W - P.l - P.r)
  const sy = (y) => H - P.b - ((y - y0) / (y1 - y0 || 1)) * (H - P.t - P.b)
  const ticks = [0, 0.5, 1].map((t) => y0 + (y1 - y0) * t)
  const xt = [0, 0.25, 0.5, 0.75, 1].map((t) => x0 + (x1 - x0) * t)
  const fx = xFormat || ((v) => new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
  return (
    <svg className="cx-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={yLabel}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} className="cx-grid" />
          <text x={P.l - 6} y={sy(t) + 3} textAnchor="end" className="cx-axis">{t.toFixed(t < 10 ? 1 : 0)}</text>
        </g>
      ))}
      {xt.map((t) => <text key={t} x={sx(t)} y={H - 4} textAnchor="middle" className="cx-axis">{fx(t)}</text>)}
      {bands.map((b) => (
        <g key={b.label}>
          <line x1={P.l} x2={W - P.r} y1={sy(b.y)} y2={sy(b.y)} className={`cx-band ${b.tone}`} />
          <text x={W - P.r - 2} y={sy(b.y) - 3} textAnchor="end" className={`cx-band-label ${b.tone}`}>{b.label}</text>
        </g>
      ))}
      {series.map((s) => (
        <polyline key={s.label} className={`cx-line ${s.tone || 'violet'}${s.dashed ? ' dashed' : ''}`}
          points={s.points.map((p) => `${sx(+p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

export function Legend({ items }) {
  return (
    <ul className="ov-legend compact">
      {items.map((it) => <li key={it.label}><i className={`cx-dot-${it.tone}`} />{it.label}</li>)}
    </ul>
  )
}
