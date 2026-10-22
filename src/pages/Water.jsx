import { useState } from 'react'
import { ApiDown, Card, Legend, LineChart, Loading, PageHead, Stat } from '../components/ui'
import { fmt, usePoll } from '../lib/api'

function NightBars({ zone }) {
  const max = Math.max(zone.expected_night_m3h * 1.6, ...zone.nights.map((n) => n.mnf || 0)) || 1
  const expPct = (zone.expected_night_m3h / max) * 100
  return (
    <div className="wt-nights" role="img" aria-label={`Minimum night flow, last ${zone.nights.length} nights`}>
      <div className="wt-exp" style={{ bottom: `calc(16px + (100% - 16px) * ${expPct / 100})` }}><span>expected {zone.expected_night_m3h}</span></div>
      {zone.nights.map((n, i) => (
        <div key={n.night} className="wt-night" title={`${n.label}: ${n.mnf ?? 'no data'} m³/h`}>
          <i className={n.leak ? 'leak' : ''} style={{ height: `${((n.mnf || 0) / max) * 100}%`, '--d': `${200 + i * 60}ms` }} />
          <span>{n.label.split(' ')[0]}</span>
        </div>
      ))}
    </div>
  )
}

function ZoneCard({ z, i, onSelect, selected }) {
  const live = z.live
  const dev = live.deviation_pct
  return (
    <button type="button" className={`ov-card wt-zone${selected ? ' selected' : ''}${z.leak_suspected ? ' leak' : ''}`} style={{ '--i': i }} onClick={onSelect}>
      <div className="wt-zone-head">
        <strong>{z.zone}</strong>
        <span className="mono">{z.meter}</span>
        <b className={`ov-tag ${z.leak_suspected ? 'crit' : z.verification_pending ? 'warn' : 'ok'}`}>{z.leak_suspected ? 'Leak suspected' : z.verification_pending ? 'Repaired · verify tonight' : 'Healthy'}</b>
      </div>
      <div className="wt-zone-nums">
        <div><span>Night flow</span><strong>{fmt.num(z.latest_mnf_m3h, 2)}<small>m³/h</small></strong></div>
        <div><span>Excess</span><strong className={z.leak_suspected ? 'crit' : ''}>{fmt.num(z.excess_m3h, 2)}<small>m³/h</small></strong></div>
        <div><span>Loss</span><strong className={z.leak_suspected ? 'crit' : ''}>{fmt.num(z.loss_m3_per_day, 1)}<small>m³/day</small></strong></div>
      </div>
      <NightBars zone={z} />
      <p className="wt-zone-foot">
        {z.verification_pending
          ? <>Repair logged {fmt.dateTime(z.repaired_at)}. Tonight's 02:00–04:00 flow confirms the fix.</>
          : z.leak_suspected
          ? <>Leaking since <b>{z.leak_since}</b> · ≈ <b>{fmt.rm(z.loss_rm_per_year)}</b>/year</>
          : <>Live {fmt.num(live.flow_m3h, 2)} m³/h vs profile {fmt.num(live.expected_m3h, 2)} {dev !== null && <b className={Math.abs(dev) > 35 ? 'warn' : ''}>({dev > 0 ? '+' : ''}{dev}%)</b>}</>}
      </p>
    </button>
  )
}

function Water() {
  const { data, error, loading } = usePoll('/water', 5000)
  const [zone, setZone] = useState('C')
  const series = usePoll(`/water/${zone}/series?hours=48`, 15000)

  if (loading && !data) return <><ApiDown error={error} /><Loading /></>
  if (!data) return <ApiDown error={error} />

  const leaking = data.zones.filter((z) => z.leak_suspected)
  const pts = series.data?.points || []

  return (
    <section className="ov cx-module">
      <ApiDown error={error} />
      <PageHead title="Water — leak detection" desc="Each zone is a District Metered Area with one inlet meter. Hidden leaks show up as night flow that never drops." />

      <div className="ov-card cx-stats4" style={{ '--i': 0 }}>
        <Stat label="Zones leaking" value={leaking.length} unit={`/ ${data.zones.length}`} tone={leaking.length ? 'crit' : 'ok'} note={leaking.map((z) => z.zone).join(', ') || 'All healthy'} />
        <Stat label="Water lost" value={fmt.num(data.total_loss_m3_day, 1)} unit="m³/day" note={`≈ ${fmt.num(data.total_loss_m3_day * 1000 / 220, 0)} residents' daily use`} />
        <Stat label="Cost of loss" value={fmt.rm(data.total_loss_rm_year)} unit="/year" note={`at RM ${data.assumptions.tariff_rm_m3}/m³`} />
        <Stat label="Method" value="MNF" note="02:00–04:00 + live profile check" />
      </div>

      <div className="wt-zones">
        {data.zones.map((z, i) => (
          <ZoneCard key={z.zone} z={z} i={i + 1} selected={z.zone.endsWith(zone)} onSelect={() => setZone(z.zone.slice(-1))} />
        ))}
      </div>

      <div className="ov-grid">
        <Card title={`Zone ${zone} inlet flow`} sub="last 48 h" icon="〰" i={4}>
          <LineChart
            height={200}
            yLabel="m³/h"
            xFormat={(v) => new Date(v).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit' })}
            series={[
              { label: 'Expected profile', tone: 'faint', dashed: true, points: pts.map((p) => ({ x: new Date(p.ts), y: p.expected })) },
              { label: 'Measured', tone: 'violet', points: pts.map((p) => ({ x: new Date(p.ts), y: p.value })) },
            ]}
          />
          <Legend items={[{ label: 'Measured inlet flow (m³/h)', tone: 'violet' }, { label: 'Healthy demand profile', tone: 'faint' }]} />
          <p className="ov-footnote">The gap between the lines at 2–4 am is leakage — nobody is showering at 3 am.</p>
        </Card>
      </div>
    </section>
  )
}

export default Water
