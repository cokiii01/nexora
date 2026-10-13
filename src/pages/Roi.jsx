import { useMemo, useState } from 'react'
import { Card, PageHead, Stat } from '../components/ui'
import FloodCostCompare from '../components/FloodCostCompare'
import { FLOOD_DEFAULTS, floodCost } from '../lib/floodCost'
import { fmt, usePoll } from '../lib/api'

// Every default is editable on screen. Verify prices/tariffs before quoting them in the pitch.
const DEFAULTS = {
  zones: 3, properties: 356,
  flowMeterCost: 4500, levelNodes: 3, levelNodeCost: 450, installPct: 25,
  hostingYear: 1800, simYear: 360, maintPct: 10,
  waterLossM3Day: 19, recoveryPct: 70, tariff: 2.0,
  kwhPerM3: 0.6, gridKgCo2PerKwh: 0.585,
  floodClaimsAvoided: 0,
}

const FIELDS = [
  ['Township', [['zones', 'Zones (DMAs)'], ['properties', 'Properties']]],
  ['Hardware (one-off, RM)', [['flowMeterCost', 'Inlet flow meter + logger / zone'], ['levelNodes', 'Flood level nodes'], ['levelNodeCost', 'Cost per level node'], ['installPct', 'Installation % of hardware']]],
  ['Running cost (RM / year)', [['hostingYear', 'Cloud hosting'], ['simYear', 'SIM / connectivity'], ['maintPct', 'Maintenance % of hardware']]],
  ['Water', [['waterLossM3Day', 'Leak loss found (m³/day)'], ['recoveryPct', 'Recovered after repair (%)'], ['tariff', 'Water cost (RM/m³)']]],
  ['Carbon (verify locally)', [['kwhPerM3', 'Energy to treat + pump (kWh/m³)'], ['gridKgCo2PerKwh', 'Grid factor (kg CO₂/kWh)']]],
  ['Flood (optional)', [['floodClaimsAvoided', 'Damage/claims avoided (RM/yr)']]],
]

function Roi() {
  const water = usePoll('/water', 0)
  const [v, setV] = useState(DEFAULTS)
  const [flood, setFlood] = useState(FLOOD_DEFAULTS)
  const [synced, setSynced] = useState(false)
  const floodAnnual = floodCost(flood).annual   // 0 unless the user chooses to include flood events in the case

  if (!synced && water.data) {
    setV((p) => ({
      ...p,
      waterLossM3Day: Math.round(water.data.total_loss_m3_day * 10) / 10 || p.waterLossM3Day,
    }))
    setSynced(true)
  }

  const r = useMemo(() => {
    const hw = v.zones * v.flowMeterCost + v.levelNodes * v.levelNodeCost
    const capex = hw * (1 + v.installPct / 100)
    const opex = v.hostingYear + v.simYear + hw * (v.maintPct / 100)
    const water = v.waterLossM3Day * (v.recoveryPct / 100) * v.tariff * 365
    const floodBenefit = v.floodClaimsAvoided + floodAnnual
    const benefit = water + floodBenefit
    const net = benefit - opex
    const payback = net > 0 ? capex / (net / 12) : null
    return {
      hw, capex, opex, water, floodBenefit, benefit, net, payback,
      perHomeMonth: (capex / 5 + opex) / v.properties / 12,
      savePerHomeMonth: benefit / v.properties / 12,
      fiveYear: net * 5 - capex,
      perProp: (capex / 5 + opex) / v.properties / 12,
      waterM3: v.waterLossM3Day * (v.recoveryPct / 100) * 365,
      co2: v.waterLossM3Day * (v.recoveryPct / 100) * 365 * v.kwhPerM3 * v.gridKgCo2PerKwh,
    }
  }, [v, floodAnnual])

  const bars = [
    ['Water recovered', r.water, 'mint'], ['Flood damage avoided', r.floodBenefit, 'blue'],
  ]
  const maxBar = Math.max(1, ...bars.map((b) => b[1]))

  return (
    <section className="ov cx-module">
      <PageHead title="Business case / ROI" desc="Cost to deploy NEXORA in one township vs. what it saves. Water loss is pulled from the live system; everything is editable.">
        <button type="button" className="ov-btn" onClick={() => { setV(DEFAULTS); setFlood(FLOOD_DEFAULTS); setSynced(false) }}>Reset</button>
      </PageHead>

      <div className="ov-card cx-stats4" style={{ '--i': 0 }}>
        <Stat label="Upfront cost" value={fmt.rm(r.capex)} note={`hardware ${fmt.rm(r.hw)} + install`} />
        <Stat label="Net saving / year" value={fmt.rm(r.net)} tone={r.net > 0 ? 'ok' : 'crit'} note={`benefit ${fmt.rm(r.benefit)} − running ${fmt.rm(r.opex)}`} />
        <Stat label="Payback" value={r.payback ? fmt.num(r.payback, 1) : '—'} unit={r.payback ? 'months' : ''} tone={r.payback && r.payback < 24 ? 'ok' : 'warn'} />
        <Stat label="Cost per home" value={`RM ${fmt.num(r.perProp, 2)}`} unit="/month" note="5-yr amortised + running" />
      </div>

      <Card title="Township Care — after handover" sub="illustrative service model" icon="⌂" i={1}>
        <div className="cx-stats-inline">
          <div><span className="tc-price">RM {fmt.num(r.perHomeMonth, 2)}</span> <small>per home / month</small></div>
          <Stat label="Whole township" value={`RM ${fmt.num(r.perHomeMonth * v.properties, 0)}`} unit="/month" note={`${v.properties} homes`} />
          <Stat label="Estimated saving" value={`RM ${fmt.num(r.savePerHomeMonth, 2)}`} unit="per home / month" tone="ok" note="from the benefits below" />
        </div>
        <ul className="tc-list">
          <li>Once a township is handed to its joint management body or management corporation, it keeps leak detection, flood warning and sensor monitoring as a subscription.</li>
          <li>Includes the resilience report, human-approved dispatch and sensor upkeep.</li>
          <li>Price is hardware over 5 years plus running cost, divided by homes. It is a model to test with a real JMB/MC, not a quote.</li>
        </ul>
      </Card>

      <FloodCostCompare f={flood} setF={setFlood} />

      <div className="ov-grid ov-grid-main">
        <Card title="Assumptions" icon="✎" i={1}>
          <div className="roi-form">
            {FIELDS.map(([group, fields]) => (
              <fieldset key={group}>
                <legend>{group}</legend>
                {fields.map(([k, label]) => (
                  <label key={k}><span>{label}</span>
                    <input type="number" step="any" min="0" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value === '' ? 0 : +e.target.value })} />
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </Card>
        <Card title="Where the savings come from" sub="per year" icon="▤" i={2}>
          <ul className="ov-stage-list">
            {bars.map(([l, val, tone]) => (
              <li key={l}><div><span>{l}</span><b>{fmt.rm(val)}</b></div><div className="ov-track"><i className={`roi-${tone}`} style={{ width: `${(val / maxBar) * 100}%` }} /></div></li>
            ))}
          </ul>
          <div className="cx-stats-inline roi-impact">
            <Stat label="Water saved" value={fmt.num(r.waterM3, 0)} unit="m³/yr" tone="ok" />
            <Stat label="CO₂ avoided" value={fmt.num(r.co2 / 1000, 2)} unit="t/yr" tone="ok" />
            <Stat label="5-year net" value={fmt.rm(r.fiveYear)} tone={r.fiveYear > 0 ? 'ok' : 'crit'} />
          </div>
          <p className="ov-footnote">Scale story: one platform, many townships — sensors and setup scale per zone, software cost is shared. Verify tariff, diesel and meter prices with the operator before the pitch.</p>
        </Card>
      </div>
    </section>
  )
}

export default Roi
