import { useEffect, useState } from 'react'
import { ApiDown, Card, Loading, PageHead, SlaBar, Stat, Status } from '../components/ui'
import { API_BASE, api, fmt, usePoll } from '../lib/api'
import { useDemo } from '../demo/context'

const NEXT = { SUBMITTED: 'ASSIGNED', ASSIGNED: 'IN_PROGRESS', IN_PROGRESS: 'RESOLVED', RESOLVED: 'CLOSED' }
const NEXT_LABEL = { ASSIGNED: 'Assign', IN_PROGRESS: 'Start work', RESOLVED: 'Mark resolved', CLOSED: 'Close' }

// Shown on the approval card so the person deciding knows what they are signing off.
const SAFETY = {
  flood: 'Keep the crew out of fast-flowing drains and the pond edge; confirm barriers and a spotter before entry.',
  water_leak: 'Isolate the section with the valve before excavating; check for buried services and notify affected homes.',
}

function ApprovalCard({ wo, onApprove }) {
  return (
    <div className="wo-approval" data-demo="approval-panel">
      <span className="wo-approval-kicker">HUMAN APPROVAL REQUIRED</span>
      <strong>Send {wo.recommended_team} to {wo.zone}?</strong>
      <p>This job was opened automatically by a sensor rule. NEXORA will not dispatch a crew until a person approves.</p>
      <dl>
        <div><dt>Priority</dt><dd>{wo.priority} · SLA {wo.sla_hours} h</dd></div>
        <div><dt>Recommended because</dt><dd>Rule: {wo.category_label} → {wo.recommended_team}</dd></div>
        {SAFETY[wo.category] && <div><dt>Safety</dt><dd>{SAFETY[wo.category]}</dd></div>}
      </dl>
      <button type="button" className="ov-btn primary" data-demo="approve-btn" onClick={onApprove}>Approve dispatch</button>
    </div>
  )
}

function Detail({ id, meta, onChanged, onClose }) {
  const [wo, setWo] = useState(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    api(`/work-orders/${id}`).then((d) => alive && setWo(d)).catch((e) => alive && setErr(e.message))
    return () => { alive = false }
  }, [id])

  const patch = async (body) => {
    setErr('')
    try {
      const d = await api(`/work-orders/${id}`, { method: 'PATCH', body })
      setWo(d)
      setNote('')
      onChanged()
    } catch (e) { setErr(e.message) }
  }

  const approve = async () => {
    setErr('')
    try {
      const d = await api(`/work-orders/${id}/approve`, { method: 'POST', body: { team: wo.recommended_team } })
      setWo(d)
      onChanged()
    } catch (e) { setErr(e.message) }
  }

  if (!wo) return <div className="wo-detail">{err || 'Loading…'}</div>
  const next = wo.awaiting_approval ? null : NEXT[wo.status]

  return (
    <div className="wo-detail">
      <div className="wo-detail-head">
        <div>
          <span className="mono">{wo.ref}</span>
          <h3>{wo.title}</h3>
        </div>
        <button type="button" className="ov-link" onClick={onClose} aria-label="Close details">✕</button>
      </div>
      <div className="wo-chips">
        <Status wo={wo} />
        <b className={`ov-stage ${wo.priority === 'P1' ? 'crit' : wo.priority === 'P2' ? 'warn' : 'low'}`}>{wo.priority}</b>
        <span>{wo.category_label}</span>
        <span>{wo.zone}{wo.location ? ` · ${wo.location}` : ''}</span>
        <span>{wo.source === 'sensor' ? 'Raised by sensor' : wo.source === 'resident' ? `Resident ${wo.reporter_name || ''} ${wo.reporter_unit || ''}` : 'Staff'}</span>
      </div>
      {wo.description && <p className="ov-muted">{wo.description}</p>}
      {wo.photo && <img className="wo-photo" src={`${API_BASE}/api/v2/uploads/${wo.photo}`} alt="Photo attached by reporter" />}
      {wo.lat && <a className="ov-link" href={`https://www.google.com/maps?q=${wo.lat},${wo.lng}`} target="_blank" rel="noreferrer">Open location in Maps ↗</a>}

      <div className="wo-sla-block">
        <span>SLA {wo.sla_hours} h · due {fmt.dateTime(wo.due_at)}</span>
        <SlaBar sla={wo.sla} />
      </div>

      {wo.awaiting_approval ? (
        <ApprovalCard wo={wo} onApprove={approve} />
      ) : (
        <div className="cx-form-row">
          <select value={wo.team || ''} onChange={(e) => patch({ team: e.target.value })} aria-label="Assigned team">
            <option value="" disabled>Assign team…</option>
            {meta?.teams.map((t) => <option key={t}>{t}</option>)}
          </select>
          {next && <button type="button" className="ov-btn primary" onClick={() => patch({ status: next })}>{NEXT_LABEL[next]}</button>}
          {wo.status === 'RESOLVED' && <button type="button" className="ov-btn" onClick={() => patch({ status: 'IN_PROGRESS', note: 'Re-opened' })}>Re-open</button>}
        </div>
      )}
      {wo.approved_by && <p className="ov-footnote">Dispatch approved by <b>{wo.approved_by}</b> · {fmt.dateTime(wo.approved_at)}</p>}
      <form className="cx-form-row" onSubmit={(e) => { e.preventDefault(); if (note.trim()) patch({ note }) }}>
        <input placeholder="Add a note for the timeline…" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit" className="ov-btn">Add</button>
      </form>
      {err && <p className="cx-error">{err}</p>}

      <ol className="wo-timeline">
        {wo.events.map((ev, i) => (
          <li key={i}><Status value={ev.status} /><div><strong>{ev.note}</strong><small>{fmt.dateTime(ev.ts)} · {ev.actor}</small></div></li>
        ))}
      </ol>
      {wo.rating && <p className="ov-footnote">Resident rating: <b>{'★'.repeat(wo.rating)}{'☆'.repeat(5 - wo.rating)}</b></p>}
    </div>
  )
}

function NewJob({ meta, onCreated }) {
  const [f, setF] = useState({ category: 'road', title: '', zone: 'Zone A', location: '', description: '' })
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    const form = new FormData()
    Object.entries(f).forEach(([k, v]) => form.append(k, v))
    try {
      await api('/work-orders', { method: 'POST', form })
      setF({ ...f, title: '', location: '', description: '' })
      onCreated()
    } catch (e2) { setErr(e2.message) }
  }
  return (
    <form className="cx-form" onSubmit={submit}>
      <div className="cx-form-row">
        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Category">
          {meta?.categories.map((c) => <option key={c.key} value={c.key}>{c.label} · {c.sla_hours}h</option>)}
        </select>
        <select value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} aria-label="Zone"><option>Zone A</option><option>Zone B</option><option>Zone C</option></select>
      </div>
      <input required placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <input placeholder="Location (street / block)" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
      <textarea rows="2" placeholder="Details" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      {err && <p className="cx-error">{err}</p>}
      <button type="submit" className="ov-btn primary">Create job</button>
    </form>
  )
}

function WorkOrders() {
  const [filter, setFilter] = useState('open')
  const q = filter === 'open' ? '?open_only=true' : filter === 'all' ? '' : `?status=${filter}`
  const { data, error, loading, refresh } = usePoll(`/work-orders${q}`, 5000)
  const sum = usePoll('/summary', 10000)
  const metaPoll = usePoll('/meta', 0)
  const [sel, setSel] = useState(null)
  const [creating, setCreating] = useState(false)
  const stats = sum.data?.stats
  // During the guided demo, open the job that is waiting for a decision (derived — no effect needed).
  const demo = useDemo()
  const waiting = (data || []).filter((w) => w.awaiting_approval)
  const autoSel = demo?.focusApproval ? (waiting.find((w) => w.category === 'flood') || waiting[0])?.id ?? null : null
  const shown = sel ?? autoSel

  if (loading && !data) return <><ApiDown error={error} /><Loading /></>

  return (
    <section className="ov cx-module">
      <ApiDown error={error} />
      <PageHead title="Work orders" desc="Every resident report and sensor alert becomes a job with an owner, an SLA clock and a public tracking code.">
        <button type="button" className="cx-btn-primary" onClick={() => setCreating(!creating)}>{creating ? 'Cancel' : '+ New job'}</button>
      </PageHead>

      <div className="ov-card cx-stats4" style={{ '--i': 0 }}>
        <Stat label="Open jobs" value={sum.data?.work_orders_open ?? '—'} note={`${sum.data?.work_orders_breached ?? 0} past SLA`} tone={sum.data?.work_orders_breached ? 'crit' : ''} />
        <Stat label="SLA met (30 d)" value={stats?.sla_met_pct ?? '—'} unit="%" tone="ok" />
        <Stat label="Avg resolution" value={stats?.avg_resolution_h ?? '—'} unit="h" />
        <Stat label="Resident rating" value={stats?.avg_rating ?? '—'} unit="/5" note={`${stats?.from_sensors ?? 0} jobs raised by sensors`} />
      </div>

      {creating && <Card title="New job" icon="+" i={1}><NewJob meta={metaPoll.data} onCreated={() => { setCreating(false); refresh() }} /></Card>}

      <div className={`wo-layout${shown ? ' has-detail' : ''}`}>
        <Card title="Jobs" icon="◇" i={1} className="ov-table-card" actions={
          <div className="ov-seg-switch" role="group" aria-label="Filter">
            {[['open', 'Open'], ['RESOLVED', 'Resolved'], ['all', 'All']].map(([k, l]) => (
              <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        }>
          <div className="ov-table" role="table">
            <div className="ov-tr wo-tr ov-th" role="row">
              <span>Job</span><span>Zone</span><span>Status</span><span>Team</span><span>SLA</span>
            </div>
            {(data || []).length === 0 && <div className="cx-empty">No jobs in this view.</div>}
            {(data || []).map((w, i) => (
              <button type="button" key={w.id} className={`ov-tr wo-tr${shown === w.id ? ' selected' : ''}`} style={{ '--r': i }} onClick={() => setSel(w.id)}>
                <span className="ov-who">
                  <i className={`ov-avatar src-${w.source}`} aria-hidden="true">{w.source === 'sensor' ? '⚡' : w.source === 'resident' ? 'R' : 'S'}</i>
                  <span><strong>{w.title}</strong><small className="mono">{w.ref} · {w.category_label}</small></span>
                </span>
                <span className="ov-num">{w.zone}</span>
                <span><Status wo={w} /></span>
                <span className="ov-why">{w.team || (w.recommended_team ? `Suggested: ${w.recommended_team}` : 'Unassigned')}</span>
                <span><SlaBar sla={w.sla} /></span>
              </button>
            ))}
          </div>
        </Card>
        {shown && <Detail key={shown} id={shown} meta={metaPoll.data} onChanged={() => { setSel(shown); refresh() }} onClose={() => setSel(null)} />}
      </div>
    </section>
  )
}

export default WorkOrders
