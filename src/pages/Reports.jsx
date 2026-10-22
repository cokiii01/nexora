import { useState } from 'react'
import { ApiDown, Card, Loading, PageHead, Stat } from '../components/ui'
import { stageLabel } from '../lib/labels'
import { fileUrl, fmt, usePoll } from '../lib/api'

function Reports({ session }) {
  const [days, setDays] = useState(30)
  const { data, error, loading } = usePoll(`/reports/monthly?days=${days}`, 30000)
  const res = usePoll(`/reports/resilience?days=${days}`, 30000).data
  const isStaff = session?.user?.role !== 'resident'
  if (!isStaff) return <section className="ov cx-module"><PageHead title="Reports" desc="Staff only." /></section>
  if (loading && !data) return <><ApiDown error={error} /><Loading /></>
  if (!data) return <ApiDown error={error} />

  const wo = data.work_orders
  const cats = Object.entries(wo.by_category).sort((a, b) => b[1] - a[1])
  const maxCat = Math.max(1, ...cats.map((c) => c[1]))

  return (
    <section className="ov cx-module rp">
      <ApiDown error={error} />
      <PageHead title="Climate-resilience report" desc={`Period: last ${days} days · generated ${fmt.dateTime(data.generated_at)}`}>
        <div className="ov-seg-switch no-print" role="group" aria-label="Period">
          {[7, 30, 90].map((d) => <button key={d} type="button" className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d} d</button>)}
        </div>
        <a className="ov-btn no-print" href={fileUrl('/reports/work-orders.csv')}>Work orders CSV</a>
        <a className="ov-btn no-print" href={fileUrl('/reports/readings.csv?device_id=FM-C&hours=168')}>Zone C flow CSV</a>
        <button type="button" className="cx-btn-primary no-print" onClick={() => window.print()}>Print / Save PDF</button>
      </PageHead>

      <div className="ov-card cx-stats4" style={{ '--i': 0 }}>
        <Stat label="Jobs handled" value={wo.total} note={`${wo.from_residents} resident · ${wo.from_sensors} sensor`} />
        <Stat label="SLA met" value={wo.sla_met_pct ?? '—'} unit="%" tone="ok" note={`${wo.resolved} resolved, ${wo.open} open`} />
        <Stat label="Avg resolution" value={wo.avg_resolution_h ?? '—'} unit="h" />
        <Stat label="Resident satisfaction" value={wo.avg_rating ?? '—'} unit="/5" />
      </div>

      {res && (
        <>
          <p className="rs-note">{res.alignment}</p>
          <div className="ov-card cx-stats4" style={{ '--i': 1 }}>
            <Stat label="Flood alerts" value={res.flood.alerts_total} note={`${res.flood.notifications_sent} resident notices sent`} />
            <Stat label="Approval time" value={res.response.avg_minutes_to_approval ?? '—'} unit={res.response.avg_minutes_to_approval == null ? '' : 'min'} note={`${res.response.jobs} sensor jobs, ${res.response.awaiting_approval} waiting`} />
            <Stat label="Sensor availability" value={res.sensors.availability_pct ?? '—'} unit="%" tone={res.sensors.faulty_now.length ? 'warn' : 'ok'} note={`${res.sensors.faults_in_period} fault${res.sensors.faults_in_period === 1 ? '' : 's'} caught in period`} />
            <Stat label="Recoverable water" value={fmt.num(res.water.recoverable_m3_year, 0)} unit="m³/yr" tone="ok" note={`estimate at ${res.water.recovery_assumption_pct}% recovery`} />
          </div>
          <div className="ov-grid ov-grid-even">
            <Card title="Highest flood exposure" icon="☂" i={2}>
              {res.flood.high_risk.length === 0
                ? <p className="rs-note">No flood alerts in this period.</p>
                : <ul className="rs-risk">{res.flood.high_risk.map((r) => <li key={r.device_id}><span>{r.name} · {r.zone}</span><b>{stageLabel(r.worst)} · {r.alerts} alert{r.alerts === 1 ? '' : 's'}</b></li>)}</ul>}
            </Card>
            <Card title="How to read this" icon="i" i={3}>
              <ul className="rs-risk">{res.notes.map((n) => <li key={n}><span>{n}</span></li>)}</ul>
            </Card>
          </div>
        </>
      )}

      <div className="ov-grid ov-grid-even">
        <Card title="Jobs by category" icon="▤" i={1}>
          <ul className="ov-stage-list">
            {cats.map(([k, n]) => (
              <li key={k}><div><span>{k}</span><b>{n}</b></div><div className="ov-track"><i className="rp-bar" style={{ width: `${(n / maxCat) * 100}%` }} /></div></li>
            ))}
          </ul>
        </Card>
        <Card title="Water loss (night-flow analysis)" icon="〰" i={2}>
          <div className="ov-table">
            <div className="ov-tr rp-tr ov-th"><span>Zone</span><span>Status</span><span>MNF / expected</span><span>Loss/day</span><span>Cost/year</span></div>
            {data.water.zones.map((z) => (
              <div className="ov-tr rp-tr" key={z.zone}>
                <span>{z.zone}</span>
                <span><b className={`ov-stage ${z.leak_suspected ? 'crit' : 'ok'}`}>{z.leak_suspected ? `Leak since ${z.leak_since}` : 'Healthy'}</b></span>
                <span className="mono">{z.latest_mnf_m3h} / {z.expected_night_m3h}</span>
                <span>{z.loss_m3_per_day} m³</span>
                <span>{fmt.rm(z.loss_rm_per_year)}</span>
              </div>
            ))}
          </div>
          <p className="ov-footnote">Tariff RM {data.water.assumptions.tariff_rm_m3}/m³, hour-day factor {data.water.assumptions.hour_day_factor}.</p>
        </Card>
      </div>

      <div className="ov-grid ov-grid-even">
        <Card title="Flood warning" icon="☂" i={4}>
          <div className="cx-stats-inline">
            {['WASPADA', 'AMARAN', 'BAHAYA'].map((l) => (
              <Stat key={l} label={stageLabel(l)} value={data.flood.alerts_by_level.find((a) => a.level === l)?.n || 0} />
            ))}
            <Stat label="Resident alerts" value={data.flood.notifications_sent} />
          </div>
        </Card>
      </div>
    </section>
  )
}

export default Reports
