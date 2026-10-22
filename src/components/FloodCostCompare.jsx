// Early vs. delayed flood response — transparent formula, editable assumptions, live approval time.
import CountUp from './CountUp'
import { Card } from './ui'
import { FLOOD_DEFAULTS, FLOOD_FIELDS, floodCost } from '../lib/floodCost'
import { fmt, usePoll } from '../lib/api'

const PARTS = [['crew', 'Crew time', 'violet'], ['equip', 'Equipment', 'lilac'], ['damage', 'Property damage', 'pink']]

function Column({ title, sub, tone, c, max }) {
  return (
    <div className={`fc-col ${tone}`}>
      <header><strong>{title}</strong><span>{sub}</span></header>
      <div className="fc-total"><CountUp value={c.total} prefix="RM " duration={1400} /></div>
      <div className="fc-stack" role="img" aria-label={`${title}: ${PARTS.map(([k, l]) => `${l} RM ${Math.round(c[k])}`).join(', ')}`}>
        {PARTS.map(([k, , t]) => <i key={k} className={`fc-seg ${t}`} style={{ height: `${(c[k] / max) * 100}%` }} />)}
      </div>
      <ul>
        {PARTS.map(([k, l, t]) => <li key={k}><i className={`fc-dot ${t}`} />{l}<b>{fmt.rm(c[k])}</b></li>)}
      </ul>
    </div>
  )
}

function FloodCostCompare({ f, setF }) {
  const r = floodCost(f)
  const jobs = usePoll('/work-orders?open_only=true', 5000)
  const approved = (jobs.data || []).find((w) => w.category === 'flood' && w.approved_at)
  const mins = approved ? (new Date(approved.approved_at) - new Date(approved.created_at)) / 60000 : null
  const max = Math.max(r.early.total, r.late.total, 1)

  return (
    <Card title="Cost of waiting" sub="act at Warning vs. after overflow" icon="◐" i={1} tag="ILLUSTRATIVE" tagTone="warn" className="fc-card">
      <div data-demo="cost-compare">
        <div className="fc-grid">
          <Column title="Act early" sub="crew sent at Warning stage" tone="early" c={r.early} max={max} />
          <Column title="Act late" sub="crew sent after the overflow" tone="late" c={r.late} max={max} />
          <div className="fc-avoid">
            <span>Estimated cost avoided per event</span>
            <strong className={r.avoided > 0 ? 'ok' : 'crit'}><CountUp value={r.avoided} prefix="RM " duration={1600} delay={400} /></strong>
            <small>
              {mins === null
                ? 'Approve a flood job to see how long the decision took.'
                : `Live: this session’s flood job was approved ${mins < 1 ? 'in under a minute' : `after ${mins.toFixed(1)} min`}.`}
            </small>
          </div>
        </div>

        <p className="fc-formula">
          <b>Cost</b> = crew rate × hours + equipment + homes exposed × share flooded × damage per home.
          Early: {fmt.rm(f.crewRmH)}×{f.hoursEarly} h + {fmt.rm(f.equipEarly)} + {f.homes}×{f.shareEarly}%×{fmt.rm(f.damagePerHome)} = <b>{fmt.rm(r.early.total)}</b>.
          Late: {fmt.rm(f.crewRmH)}×{f.hoursLate} h + {fmt.rm(f.equipLate)} + {f.homes}×{f.shareLate}%×{fmt.rm(f.damagePerHome)} = <b>{fmt.rm(r.late.total)}</b>.
        </p>
        <p className="ov-footnote">
          Scenario inputs, not measured savings: the share of homes flooded early vs. late is the weakest assumption. Replace every number
          with the township’s own call-out and claims data before quoting it.
        </p>
      </div>

      <details className="fc-edit">
        <summary>Edit assumptions</summary>
        <div className="roi-form fc-form">
          <fieldset>
            {FLOOD_FIELDS.map(([k, label]) => (
              <label key={k}><span>{label}</span>
                <input type="number" step="any" min="0" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value === '' ? 0 : +e.target.value })} />
              </label>
            ))}
          </fieldset>
          <button type="button" className="ov-btn" onClick={() => setF(FLOOD_DEFAULTS)}>Reset assumptions</button>
        </div>
      </details>
    </Card>
  )
}

export default FloodCostCompare
