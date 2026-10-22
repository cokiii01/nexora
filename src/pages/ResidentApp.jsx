// Resident Connect — mobile-first PWA for residents (real API).
import { LOGO_SRC } from '../lib/brand'
import { useEffect, useState } from 'react'
import { SlaBar, Stage, Status } from '../components/ui'
import { api, fmt, usePoll } from '../lib/api'

const CATS = [
  ['flood', 'Flooding', '🌊'], ['drain', 'Blocked drain', '🕳️'], ['water_leak', 'Water leak', '💧'], ['water_supply', 'No water', '🚱'],
  ['waste', 'Rubbish / bin', '🗑️'], ['streetlight', 'Streetlight', '💡'], ['road', 'Road / pothole', '🚧'], ['other', 'Other', '📝'],
]
const STEPS = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED']

function Home({ user, go }) {
  const flood = usePoll('/flood', 8000)
  const water = usePoll('/water', 15000)
  const notes = usePoll('/notifications', 8000)
  const mine = usePoll('/work-orders?open_only=true', 10000)
  const zoneSensors = (flood.data?.sensors || []).filter((s) => s.kind === 'level' && s.zone === user.zone)
  const order = ['NORMAL', 'WASPADA', 'AMARAN', 'BAHAYA']
  const stage = zoneSensors.reduce((w, s) => (order.indexOf(s.stage) > order.indexOf(w) ? s.stage : w), 'NORMAL')
  const wz = water.data?.zones.find((z) => z.zone === user.zone)
  const rain = flood.data?.sensors.find((s) => s.kind === 'rain')

  return (
    <div className="ra-stack">
      <div className={`ra-hero stage-${stage}`}>
        <span>{user.zone} · {user.unit || 'Resident'}</span>
        <h2>{stage === 'NORMAL' ? 'All clear in your area' : stage === 'WASPADA' ? 'Water levels rising — stay alert' : stage === 'AMARAN' ? 'Flood warning in your zone' : 'Flash flood danger — avoid low areas'}</h2>
        <div className="ra-hero-row">
          <div><small>Flood stage</small><Stage value={stage} /></div>
          <div><small>Rain now</small><b>{fmt.num(rain?.last_value, 0)} mm/h</b></div>
          <div><small>Water network</small><b className={wz?.leak_suspected ? 'warn' : 'ok'}>{wz ? (wz.leak_suspected ? 'Repair in progress' : 'Normal') : '—'}</b></div>
        </div>
      </div>

      <button type="button" className="ra-cta" onClick={() => go('report')}>
        <span>＋</span><div><strong>Report an issue</strong><small>Photo + location, tracked until fixed</small></div>
      </button>

      {(mine.data || []).length > 0 && (
        <section className="ra-card">
          <h3>Your open reports</h3>
          {mine.data.slice(0, 3).map((w) => (
            <button type="button" key={w.id} className="ra-row" onClick={() => go('mine', w.id)}>
              <div><strong>{w.title}</strong><small className="mono">{w.ref}</small></div><Status value={w.status} />
            </button>
          ))}
        </section>
      )}

      <section className="ra-card">
        <h3>Alerts for {user.zone}</h3>
        {(notes.data || []).length === 0 && <p className="ra-muted">No alerts. You'll be notified here (and on Telegram if your township has it set up).</p>}
        {(notes.data || []).slice(0, 6).map((n) => (
          <div key={n.id} className="ra-alert">
            <Stage value={n.level} />
            <div><strong>{n.title}</strong><p>{n.body}</p><small>{fmt.dateTime(n.created_at)}</small></div>
          </div>
        ))}
      </section>
    </div>
  )
}

function Report({ user, done }) {
  const [cat, setCat] = useState('')
  const [f, setF] = useState({ title: '', description: '', location: user.unit || '' })
  const [photo, setPhoto] = useState(null)
  const [geo, setGeo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const locate = () => {
    if (!navigator.geolocation) return setErr('Location not available on this device')
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      () => setErr('Location permission denied — type the location instead'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!cat) return setErr('Pick a category')
    setBusy(true)
    setErr('')
    const form = new FormData()
    form.append('category', cat)
    form.append('title', f.title || CATS.find((c) => c[0] === cat)[1])
    form.append('description', f.description)
    form.append('location', f.location)
    if (geo) { form.append('lat', geo.lat); form.append('lng', geo.lng) }
    if (photo) form.append('photo', photo)
    try {
      const wo = await api('/work-orders', { method: 'POST', form })
      done(wo)
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  return (
    <form className="ra-stack" onSubmit={submit}>
      <section className="ra-card">
        <h3>What's the problem?</h3>
        <div className="ra-cats">
          {CATS.map(([k, l, ic]) => (
            <button type="button" key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}><span>{ic}</span>{l}</button>
          ))}
        </div>
      </section>
      <section className="ra-card cx-form">
        <label>Short title<input placeholder="e.g. Drain overflowing near playground" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label>Details<textarea rows="3" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <label>Location<input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
        <div className="cx-form-row">
          <button type="button" className="ov-btn" onClick={locate}>{geo ? `📍 GPS ±${geo.acc} m` : '📍 Use my location'}</button>
          <label className="ov-btn ra-file">{photo ? `📷 ${photo.name.slice(0, 16)}` : '📷 Add photo'}
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] || null)} hidden />
          </label>
        </div>
        {err && <p className="cx-error">{err}</p>}
        <button type="submit" className="cx-btn-primary cx-btn-block" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</button>
      </section>
    </form>
  )
}

function Tracker({ id, onBack }) {
  const [wo, setWo] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let alive = true
    const load = () => api(`/work-orders/${id}`).then((d) => alive && setWo(d)).catch((e) => alive && setErr(e.message))
    load()
    const t = setInterval(load, 8000)
    return () => { alive = false; clearInterval(t) }
  }, [id])
  const rate = async (n) => {
    try { setWo(await api(`/work-orders/${id}/rate`, { method: 'POST', body: { rating: n } })) } catch (e) { setErr(e.message) }
  }
  if (!wo) return <p className="ra-muted">{err || 'Loading…'}</p>
  const stepIdx = STEPS.indexOf(wo.status === 'CLOSED' ? 'RESOLVED' : wo.status)
  return (
    <div className="ra-stack">
      <button type="button" className="ov-link" onClick={onBack}>← All reports</button>
      <section className="ra-card">
        <span className="mono ra-ref">{wo.ref}</span>
        <h3>{wo.title}</h3>
        <p className="ra-muted">{wo.category_label} · {wo.zone}{wo.location ? ` · ${wo.location}` : ''}</p>
        <ol className="ra-steps">
          {STEPS.map((s, i) => <li key={s} className={i <= stepIdx ? 'done' : ''}><i />{s.replace('_', ' ').toLowerCase()}</li>)}
        </ol>
        <div className="wo-sla-block"><span>Target: fixed within {wo.sla_hours} h</span><SlaBar sla={wo.sla} /></div>
        {wo.team && <p className="ra-muted">Handled by <b>{wo.team}</b></p>}
      </section>
      <section className="ra-card">
        <h3>Updates</h3>
        <ol className="wo-timeline">
          {wo.events.map((ev, i) => <li key={i}><Status value={ev.status} /><div><strong>{ev.note}</strong><small>{fmt.dateTime(ev.ts)}</small></div></li>)}
        </ol>
      </section>
      {wo.status === 'RESOLVED' && !wo.rating && (
        <section className="ra-card">
          <h3>Is it fixed? Rate the job</h3>
          <div className="ra-stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => rate(n)} aria-label={`${n} stars`}>★</button>)}</div>
        </section>
      )}
      {wo.rating && <p className="ra-muted">You rated this {wo.rating}/5. Thank you!</p>}
      {err && <p className="cx-error">{err}</p>}
    </div>
  )
}

function Mine({ go, openId, setOpenId }) {
  const { data } = usePoll('/work-orders', 10000)
  if (openId) return <Tracker id={openId} onBack={() => setOpenId(null)} />
  return (
    <div className="ra-stack">
      <section className="ra-card">
        <h3>My reports</h3>
        {(data || []).length === 0 && <p className="ra-muted">Nothing reported yet. <button type="button" className="ov-link" onClick={() => go('report')}>Report an issue</button></p>}
        {(data || []).map((w) => (
          <button type="button" key={w.id} className="ra-row" onClick={() => setOpenId(w.id)}>
            <div><strong>{w.title}</strong><small className="mono">{w.ref} · {fmt.dateTime(w.created_at)}</small></div><Status value={w.status} />
          </button>
        ))}
      </section>
    </div>
  )
}

function ResidentApp({ session, onLogout, backToHome }) {
  const user = session.user
  const [tab, setTab] = useState('home')
  const [openId, setOpenId] = useState(null)
  const [toast, setToast] = useState('')

  const go = (t, id) => { setTab(t); setOpenId(id || null) }

  return (
    <div className="cx-shell ra">
      <header className="ra-top">
        <button type="button" className="cx-workspace ra-brand" onClick={backToHome}>
          <span className="cx-logo" aria-hidden="true"><img src={LOGO_SRC} alt="" /></span>
          <span className="cx-workspace-copy"><strong>Resident Connect</strong><small>Hi, {user.name.split(' ')[0]}</small></span>
        </button>
        <button type="button" className="ov-link" onClick={onLogout}>Sign out</button>
      </header>
      {toast && <div className="cx-banner ok ra-toast" role="status">{toast}</div>}
      <main className="ra-main">
        {tab === 'home' && <Home user={user} go={go} />}
        {tab === 'report' && <Report user={user} done={(wo) => { setToast(`Report ${wo.ref} sent — ${wo.category_label}, target ${wo.sla_hours} h.`); go('mine', wo.id); setTimeout(() => setToast(''), 6000) }} />}
        {tab === 'mine' && <Mine go={go} openId={openId} setOpenId={setOpenId} />}
      </main>
      <nav className="ra-tabs" aria-label="Resident navigation">
        {[['home', 'Home', '⌂'], ['report', 'Report', '＋'], ['mine', 'My reports', '☰']].map(([k, l, ic]) => (
          <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => go(k)} aria-current={tab === k ? 'page' : undefined}><span>{ic}</span>{l}</button>
        ))}
      </nav>
    </div>
  )
}

export default ResidentApp
