// Overview: live summary driven by the /api/v2 services.
// Falls back to the WT-04 snapshot from the Digital Twin when the backend is offline.
import CountUp from '../components/CountUp'
import { SlaBar, Stage, Status } from '../components/ui'
import { stageLabel } from '../lib/labels'
import { fmt, usePoll } from '../lib/api'

const ZONES = [
  { key: 'A', name: 'Zone A', type: 'Residential', residents: 542, tone: 'mint' },
  { key: 'C', name: 'Zone C', type: 'Residential', residents: 556, tone: 'violet' },
  { key: 'B', name: 'Zone B', type: 'Commercial', residents: 186, tone: 'lilac' },
]
const TOTAL_RESIDENTS = ZONES.reduce((s, z) => s + z.residents, 0)
const STAGES = ['NORMAL', 'WASPADA', 'AMARAN', 'BAHAYA']
const LEVEL_TONE = { BAHAYA: 'crit', AMARAN: 'crit', CRITICAL: 'crit', WASPADA: 'warn', WARNING: 'warn' }

function Overview({ setActivePage, openSensorInDigitalTwin, liveWT04, summary }) {
  const water = usePoll('/water', 10000)
  const flood = usePoll('/flood', 8000)
  const s = summary
  const stats = s?.stats

  const zoneFlood = (zone) => (flood.data?.sensors || [])
    .filter((x) => x.kind === 'level' && x.zone === zone)
    .reduce((w, x) => (STAGES.indexOf(x.stage) > STAGES.indexOf(w) ? x.stage : w), 'NORMAL')
  const zoneWater = (zone) => water.data?.zones.find((z) => z.zone === zone)
  const zoneJobs = (zone) => (s?.open_list || []).filter((w) => w.zone === zone).length

  const kpis = [
    { label: 'Open work orders', value: s?.work_orders_open, page: 'workOrders', pill: s ? (s.work_orders_breached ? `${s.work_orders_breached} past SLA` : 'All within SLA') : null, tone: s?.work_orders_breached ? 'crit' : 'ok' },
    { label: 'SLA met · 30 days', value: stats?.sla_met_pct, unit: '%', decimals: 1, page: 'reports', pill: stats ? `${stats.resolved} resolved` : null, tone: 'ok' },
    { label: 'Water lost to leaks', value: s?.water_loss_m3_day, unit: 'm³/day', decimals: 1, page: 'water', pill: s ? (s.leaking_zones.length ? `${fmt.rm(s.water_loss_rm_year)}/yr` : 'No leaks') : null, tone: s?.leaking_zones?.length ? 'crit' : 'ok' },
    { label: 'Sensors not trusted', value: s ? (s.sensor_faults?.length || 0) : undefined, page: 'devices', pill: s ? (s.sensor_faults?.length ? 'Fault caught' : 'All trusted') : null, tone: s?.sensor_faults?.length ? 'warn' : 'ok' },
  ]

  const alerts = s?.active_alerts || []
  const top = alerts.slice().sort((a, b) => (LEVEL_TONE[b.level] === 'crit') - (LEVEL_TONE[a.level] === 'crit'))[0]
  const tone = top ? (LEVEL_TONE[top.level] || 'warn') : liveWT04.status === 'Critical' ? 'crit' : liveWT04.status === 'Warning' ? 'warn' : 'ok'

  const cats = Object.entries(stats?.by_category || {}).sort((a, b) => b[1] - a[1]).slice(0, 7)
  const catMax = Math.max(1, ...cats.map((c) => c[1]))

  return (
    <section className="ov">
      {!s && (
        <div className="cx-banner warn">Backend offline — showing static snapshot. Start it with <code>cd backend &amp;&amp; uvicorn main:app --reload</code>.</div>
      )}

      {/* one story: water fails silently */}
      <p className="story-head">Township water fails silently — NEXORA catches it three ways</p>
      <div className="story-strip">
        <button type="button" onClick={() => setActivePage('water')}><strong>Hidden leaks</strong><span>Night-flow analysis finds loss nobody reported.</span></button>
        <button type="button" onClick={() => setActivePage('flood')}><strong>Flood blind spots</strong><span>Drain and pond levels warn before the overflow.</span></button>
        <button type="button" onClick={() => setActivePage('devices')}><strong>Failing sensors</strong><span>A frozen sensor is caught, never trusted.</span></button>
      </div>

      {/* KPI strip */}
      <div className="ov-kpis ov-card" style={{ '--i': 0 }}>
        {kpis.map((k, idx) => (
          <button key={k.label} type="button" className="ov-kpi clickable" onClick={() => setActivePage(k.page)}>
            <span className="ov-kpi-label">{k.label}</span>
            <div className="ov-kpi-row">
              <strong>{k.value === undefined || k.value === null ? '—' : <CountUp value={k.value} decimals={k.decimals || 0} delay={idx * 90} />}<small>{k.unit}</small></strong>
              {k.pill && <em className={`ov-delta ${k.tone}`}>{k.pill}</em>}
            </div>
          </button>
        ))}
      </div>

      {/* Residents by zone + priority alert */}
      <div className="ov-grid ov-grid-main">
        <article className="ov-card ov-capacity" style={{ '--i': 1 }}>
          <header className="ov-card-head">
            <div className="ov-title">
              <span className="ov-ico" aria-hidden="true">◎</span>
              <h2>Residents served</h2>
              <b className={`ov-tag ${s?.flood_stage && s.flood_stage !== 'NORMAL' ? 'warn' : 'ok'}`}>{s ? `Flood: ${stageLabel(s.flood_stage)}` : 'Snapshot'}</b>
            </div>
            <div className="ov-seg-switch" role="group" aria-label="Zone detail">
              <button type="button" onClick={() => setActivePage('digitalTwin')}>Open twin</button>
            </div>
          </header>

          <div className="ov-big">
            <strong><CountUp value={TOTAL_RESIDENTS} duration={1400} /></strong>
            <span>residents across 3 zones</span>
          </div>

          <div className="ov-segbar" role="img" aria-label="Residents by zone">
            {ZONES.map((z, i) => (
              <i key={z.key} className={z.tone} style={{ flexGrow: z.residents, '--d': `${300 + i * 220}ms` }} title={`${z.name}: ${z.residents}`} />
            ))}
          </div>
          <div className="ov-scale"><span>0</span><span>{Math.round(TOTAL_RESIDENTS / 2)}</span><span>{TOTAL_RESIDENTS.toLocaleString()}</span></div>

          <ul className="ov-legend">
            {ZONES.map((z) => <li key={z.key}><i className={z.tone} />{z.name} · {z.type} <b>{z.residents}</b></li>)}
          </ul>

          <div className="ov-zone-grid">
            {ZONES.map((z, i) => {
              const w = zoneWater(z.name)
              const f = zoneFlood(z.name)
              return (
                <button type="button" key={z.key} onClick={() => setActivePage(w?.leak_suspected ? 'water' : f !== 'NORMAL' ? 'flood' : 'workOrders')} style={{ '--r': i }}>
                  <span><i className={z.tone} />{z.name}</span>
                  <dl>
                    <div><dt>Water</dt><dd className={w?.leak_suspected ? 'warn' : ''}>{w ? (w.leak_suspected ? 'Leak' : 'OK') : '—'}</dd></div>
                    <div><dt>Flood</dt><dd className={f !== 'NORMAL' ? 'warn' : ''}>{flood.data ? (f === 'NORMAL' ? 'OK' : stageLabel(f)) : '—'}</dd></div>
                    <div><dt>Open jobs</dt><dd>{s ? zoneJobs(z.name) : '—'}</dd></div>
                  </dl>
                </button>
              )
            })}
          </div>

          <footer className="ov-card-foot">
            <p>{s?.leaking_zones?.length
              ? <>Night-flow analysis shows a hidden leak in <b>{s.leaking_zones.join(', ')}</b> — about <b>{fmt.num(s.water_loss_m3_day, 1)} m³</b> lost every day.</>
              : <>All zones within expected night flow. Zone C holds <b>43%</b> of residents.</>}</p>
            <button type="button" className="ov-btn" onClick={() => setActivePage('water')}>Open water</button>
          </footer>
        </article>

        <aside className={`ov-card ov-priority ${tone}`} style={{ '--i': 2 }}>
          <header className="ov-card-head">
            <div className="ov-title">
              <span className={`ov-dot ${tone}`} aria-hidden="true" />
              <h2>{top ? 'Priority alert' : 'Network stable'}</h2>
            </div>
            <b className={`ov-tag ${tone}`}>{top ? top.level : liveWT04.status.toUpperCase()}</b>
          </header>

          {top ? (
            <>
              <div className="ov-source"><span>{top.device_id}</span> {top.zone} · {top.kind === 'flood' ? 'Drainage' : 'Water network'}</div>
              <h3>{top.title}</h3>
              <p className="ov-muted">{top.detail}</p>
              <dl className="ov-meta">
                <div><dt>Raised</dt><dd>{fmt.ago(top.created_at)}</dd></div>
                <div><dt>Work order</dt><dd className="mono">{top.work_order_ref || '—'}</dd></div>
                <div><dt>Other alerts</dt><dd>{alerts.length - 1}</dd></div>
              </dl>
              <div className="ov-actions">
                <button type="button" className="ov-btn primary" onClick={() => setActivePage(top.kind === 'flood' ? 'flood' : 'water')}>Investigate</button>
                <button type="button" className="ov-btn" onClick={() => setActivePage('workOrders')}>Work orders</button>
              </div>
            </>
          ) : (
            <>
              <div className="ov-source"><span>WT-04</span> Water network · Zone C</div>
              <h3>{s ? 'No active alerts' : 'Water pressure snapshot'}</h3>
              <p className="ov-muted">{s ? 'All sensors are within thresholds. Alerts appear here the moment a rule trips.' : 'Live alerts need the backend.'}</p>
              <div className="ov-reading">
                <div><span>WT-04 pressure</span><strong><CountUp value={liveWT04.value} decimals={1} duration={700} /><small>bar</small></strong></div>
                <div className="ov-gauge" aria-hidden="true"><i className={tone} style={{ width: `${Math.min(100, (Number(liveWT04.value) / 5) * 100)}%` }} /></div>
              </div>
              <div className="ov-actions"><button type="button" className="ov-btn" onClick={() => openSensorInDigitalTwin('WT-04')}>View sensor</button></div>
            </>
          )}
        </aside>
      </div>

      {/* Open jobs table + jobs by category */}
      <div className="ov-grid ov-grid-main">
        <article className="ov-card ov-table-card" style={{ '--i': 3 }}>
          <header className="ov-card-head">
            <div className="ov-title">
              <span className="ov-ico" aria-hidden="true">◇</span>
              <h2>Open work orders</h2>
              <span className="ov-sub">most urgent first</span>
              {s && <b className={`ov-tag ${s.work_orders_breached ? 'crit' : 'ok'}`}>{s.work_orders_breached ? `${s.work_orders_breached} breached` : 'On track'}</b>}
            </div>
            <button type="button" className="ov-link" onClick={() => setActivePage('workOrders')}>View all →</button>
          </header>

          <div className="ov-table" role="table" aria-label="Open work orders">
            <div className="ov-tr ov-th" role="row">
              <span role="columnheader">Job</span><span role="columnheader">Zone</span><span role="columnheader">Status</span>
              <span role="columnheader">SLA</span><span role="columnheader" aria-label="Action" />
            </div>
            {(s?.open_list || []).length === 0 && <div className="cx-empty">{s ? 'No open jobs.' : 'Backend offline.'}</div>}
            {(s?.open_list || []).map((w, i) => (
              <div className="ov-tr" role="row" key={w.id} style={{ '--r': i }}>
                <span role="cell" className="ov-who">
                  <i className={`ov-avatar src-${w.source}`} aria-hidden="true">{w.source === 'sensor' ? '⚡' : w.source === 'resident' ? 'R' : 'S'}</i>
                  <span><strong>{w.title}</strong><small className="mono">{w.ref} · {w.category_label}</small></span>
                </span>
                <span role="cell" className="ov-num">{w.zone}</span>
                <span role="cell"><Status wo={w} /></span>
                <span role="cell"><SlaBar sla={w.sla} /></span>
                <span role="cell"><button type="button" className="ov-nudge" onClick={() => setActivePage('workOrders')}>Open</button></span>
              </div>
            ))}
          </div>
        </article>

        <article className="ov-card ov-activity" style={{ '--i': 4 }}>
          <header className="ov-card-head">
            <div className="ov-title">
              <span className="ov-ico" aria-hidden="true">▤</span>
              <h2>Jobs by type</h2>
              <span className="ov-sub">last 30 days</span>
            </div>
          </header>
          <div className="ov-bars" role="img" aria-label="Work orders by category, last 30 days">
            {cats.map(([c, n], i) => (
              <div className="ov-bar-col" key={c}>
                <div className="ov-bar" style={{ height: `${(n / catMax) * 100}%`, '--d': `${450 + i * 70}ms` }} title={`${c}: ${n}`}>
                  <i style={{ flexGrow: 1 }} />
                </div>
                <span>{c.split(' ')[0].replace('/', '')}</span>
              </div>
            ))}
          </div>
          <div className="ov-stats3">
            <div><span>Total</span><strong>{stats ? <CountUp value={stats.total} delay={300} /> : '—'}</strong></div>
            <div><span>By sensors</span><strong>{stats ? <CountUp value={stats.from_sensors} delay={380} /> : '—'}</strong></div>
            <div><span>Avg fix</span><strong>{stats?.avg_resolution_h ?? '—'}<small className="ov-unit">h</small></strong></div>
          </div>
          <p className="ov-footnote"><b>{s ? `${s.devices_online} of ${s.devices_total}` : '—'}</b> sensors reporting · rating <b>{stats?.avg_rating ?? '—'}/5</b> from residents.</p>
        </article>
      </div>

      {/* Night flow + flood sensors */}
      <div className="ov-grid ov-grid-even">
        <article className="ov-card ov-stages" style={{ '--i': 5 }}>
          <header className="ov-card-head">
            <div className="ov-title">
              <span className="ov-ico" aria-hidden="true">〰</span>
              <h2>Night flow vs expected</h2>
              <span className="ov-sub">last night, 02:00–04:00</span>
            </div>
            <button type="button" className="ov-link" onClick={() => setActivePage('water')}>Details →</button>
          </header>
          <ul className="ov-stage-list">
            {(water.data?.zones || []).map((z, i) => {
              const max = Math.max(...water.data.zones.map((x) => x.latest_mnf_m3h || 0), 0.01)
              return (
                <li key={z.zone}>
                  <div><span>{z.zone} · expected {z.expected_night_m3h}</span><b className={z.leak_suspected ? 'warn' : ''}>{z.latest_mnf_m3h} m³/h</b></div>
                  <div className="ov-track"><i className={z.leak_suspected ? 'pink' : 'mint'} style={{ width: `${((z.latest_mnf_m3h || 0) / max) * 100}%`, '--d': `${500 + i * 90}ms` }} /></div>
                </li>
              )
            })}
          </ul>
          <p className="ov-footnote">At 3 am almost nobody uses water — flow that doesn't drop is leakage.</p>
        </article>

        <article className="ov-card ov-env" style={{ '--i': 6 }}>
          <header className="ov-card-head">
            <div className="ov-title">
              <span className="ov-ico" aria-hidden="true">☂</span>
              <h2>Drain & pond levels</h2>
              {flood.data && <b className={`ov-tag ${s?.flood_stage === 'NORMAL' ? 'ok' : 'warn'}`}>{s?.flood_stage ? stageLabel(s.flood_stage) : '—'}</b>}
            </div>
            <button type="button" className="ov-link" onClick={() => setActivePage('flood')}>Flood view →</button>
          </header>
          <ul className="ov-stage-list">
            {(flood.data?.sensors || []).filter((x) => x.kind === 'level').map((x, i) => (
              <li key={x.device_id}>
                <div><span>{x.name}</span><span className="ov-inline"><b>{fmt.num(x.last_value, 2)} m</b> <Stage value={x.stage} /></span></div>
                <div className="ov-track"><i className={x.stage === 'NORMAL' ? 'blue' : x.stage === 'WASPADA' ? 'amber' : 'pink'} style={{ width: `${Math.min(100, ((x.last_value || 0) / x.meta.depth) * 100)}%`, '--d': `${600 + i * 80}ms` }} /></div>
              </li>
            ))}
          </ul>
          <p className="ov-footnote">Rain now: <b>{fmt.num(flood.data?.sensors.find((x) => x.kind === 'rain')?.last_value, 1)} mm/h</b>. Residents in the affected zone are alerted automatically.</p>
        </article>
      </div>
    </section>
  )
}

export default Overview
