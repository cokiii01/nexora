import { useState } from 'react'
import { ApiDown, Card, LineChart, Loading, PageHead, Stage, Stat } from '../components/ui'
import { stageLabel } from '../lib/labels'
import { fmt, usePoll } from '../lib/api'

const ORDER = ['NORMAL', 'WASPADA', 'AMARAN', 'BAHAYA']

function Gauge({ s }) {
  const depth = s.meta.depth
  const th = s.meta.thresholds
  const pct = Math.min(100, ((s.last_value || 0) / depth) * 100)
  return (
    <div className={`fl-gauge stage-${s.stage}`}>
      <div className="fl-tube">
        <i style={{ height: `${pct}%` }} />
        {Object.entries(th).map(([k, v]) => (
          <span key={k} className={`fl-mark ${k}`} style={{ bottom: `${(v / depth) * 100}%` }}><em>{stageLabel(k)} {v} m</em></span>
        ))}
      </div>
    </div>
  )
}

function SensorCard({ s, i, selected, onSelect }) {
  const rise = s.rise_cm_per_10min
  return (
    <button type="button" className={`ov-card fl-sensor${selected ? ' selected' : ''}${s.fault ? ' faulty' : ''}`} style={{ '--i': i }} onClick={onSelect} data-demo={`flood-${s.device_id}`}>
      <div className="wt-zone-head">
        <strong>{s.name}</strong>
        {s.fault ? <b className="ov-stage crit" title={s.fault}>SENSOR FAULT</b> : <Stage value={s.stage} />}
      </div>
      <div className="fl-body">
        <Gauge s={s} />
        <div className="fl-nums">
          <div><span>Water level</span><strong>{fmt.num(s.last_value, 2)}<small>m</small></strong></div>
          <div><span>Rate of rise</span><strong className={rise > 10 ? 'warn' : ''}>{rise === null ? '—' : `${rise > 0 ? '+' : ''}${rise}`}<small>cm/10 min</small></strong></div>
          <div><span>Device</span><strong className="mono small">{s.device_id}</strong><small className="fl-src">{s.source === 'device' ? 'Live ESP32' : 'Simulated'} · {fmt.ago(s.last_seen)}</small></div>
        </div>
      </div>
    </button>
  )
}

function Flood() {
  const { data, error, loading } = usePoll('/flood', 3000)
  const [sel, setSel] = useState('DL-A1')
  const series = usePoll(`/devices/${sel}/series?hours=24`, 10000)

  if (loading && !data) return <><ApiDown error={error} /><Loading /></>
  if (!data) return <ApiDown error={error} />

  const levels = data.sensors.filter((s) => s.kind === 'level')
  const rain = data.sensors.find((s) => s.kind === 'rain')
  // a sensor flagged as faulty is not trusted, so it does not count towards the township stage
  const worst = levels.filter((s) => !s.fault).reduce((w, s) => (ORDER.indexOf(s.stage) > ORDER.indexOf(w) ? s.stage : w), 'NORMAL')
  const selDev = levels.find((s) => s.device_id === sel) || levels[0]
  const pts = series.data?.points || []

  return (
    <section className="ov cx-module">
      <ApiDown error={error} />
      <PageHead title="Flood early warning" desc="Ultrasonic level sensors in drains and the retention pond. Stages follow the JPS convention: Normal → Alert → Warning → Danger.">
        <span className={`cx-pill ${worst === 'NORMAL' ? 'ok' : worst === 'WASPADA' ? 'warn' : 'crit'}`}><i />Township: {stageLabel(worst)}</span>
      </PageHead>

      <div className="ov-card cx-stats4" style={{ '--i': 0 }}>
        <Stat label="Rainfall now" value={fmt.num(rain?.last_value, 1)} unit="mm/h" note={rain?.last_value > 50 ? 'Very heavy (> 50 mm/h)' : rain?.last_value > 10 ? 'Heavy' : 'Light / none'} tone={rain?.last_value > 50 ? 'crit' : ''} />
        <Stat label="Sensors above normal" value={levels.filter((s) => !s.fault && s.stage !== 'NORMAL').length} unit={`/ ${levels.length}`}
          note={levels.some((s) => s.fault) ? `${levels.filter((s) => s.fault).length} sensor not trusted (fault)` : undefined} tone={levels.some((s) => s.fault) ? 'warn' : ''} />
        <Stat label="Alerts sent" value={data.notifications.length} note={data.telegram ? 'In-app + Telegram' : 'In-app (Telegram not configured)'} />
        <Stat label="Auto work orders" value={data.alerts.filter((a) => a.work_order_ref).length} note="Raised at Warning or above" />
      </div>

      <div className="fl-grid">
        {levels.map((s, i) => <SensorCard key={s.device_id} s={s} i={i + 1} selected={s.device_id === sel} onSelect={() => setSel(s.device_id)} />)}
      </div>

      <div className="ov-grid">
        <Card title={`${selDev?.name || sel}`} sub="water level · 24 h" icon="〰" i={4}>
          <LineChart
            height={190}
            yLabel="m"
            bands={selDev ? Object.entries(selDev.meta.thresholds).map(([k, v]) => ({ y: v, label: stageLabel(k), tone: k === 'BAHAYA' ? 'crit' : k === 'AMARAN' ? 'orange' : 'warn' })) : []}
            series={[{ label: 'Level', tone: 'blue', points: pts.map((p) => ({ x: new Date(p.ts), y: p.value })) }]}
          />
        </Card>
      </div>
    </section>
  )
}

export default Flood
