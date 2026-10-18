// Presentation layer for the guided demo: title cards, captions, spotlight, timeline and presenter controls.
// Wrap the Command Centre in <DemoLayer enabled=…>. When disabled it renders the children untouched.
import { useEffect, useMemo, useState } from 'react'
import { usePoll } from '../lib/api'
import { stageLabel } from '../lib/labels'
import { DemoContext } from './context'
import { SCENES } from './scenes'
import { useDirector } from './useDirector'

function Spotlight({ selector }) {
  const [rect, setRect] = useState(null)
  useEffect(() => {
    const list = Array.isArray(selector) ? selector : [selector]
    let scrolled = null
    const find = () => {
      const el = list.map((s) => document.querySelector(s)).find(Boolean)
      if (!el) { setRect(null); return }
      if (scrolled !== el) {
        scrolled = el
        el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      }
      const r = el.getBoundingClientRect()
      setRect((p) => (p && Math.abs(p.x - r.left) < 1 && Math.abs(p.y - r.top) < 1 && Math.abs(p.w - r.width) < 1 && Math.abs(p.h - r.height) < 1
        ? p : { x: r.left, y: r.top, w: r.width, h: r.height }))
    }
    const raf = requestAnimationFrame(find)
    const id = setInterval(find, 400)
    return () => { cancelAnimationFrame(raf); clearInterval(id) }
  }, [selector])
  if (!rect) return null
  const pad = 6
  return <div className="demo-spot" aria-hidden="true" style={{ left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2 }} />
}

// Bring an element into view (no ring) — used to show the 3D canvas, which sits below the page header.
function Scroller({ selector }) {
  useEffect(() => {
    let tries = 0
    const id = setInterval(() => {
      const el = document.querySelector(selector)
      tries += 1
      if (el || tries > 24) {
        clearInterval(id)
        el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
    }, 300)
    return () => clearInterval(id)
  }, [selector])
  return null
}

function LiveChips() {
  const { data } = usePoll('/summary', 3000)
  if (!data) return null
  return (
    <ul className="demo-chips" aria-label="Live system state">
      <li className={data.flood_stage === 'NORMAL' ? '' : 'hot'}><span>Flood</span><b>{stageLabel(data.flood_stage)}</b></li>
      <li className={data.sensor_faults?.length ? 'hot' : ''}><span>Sensor faults</span><b>{data.sensor_faults?.length ?? 0}</b></li>
      <li><span>Open jobs</span><b>{data.work_orders_open}</b></li>
      <li className={data.awaiting_approval ? 'hot' : ''}><span>Awaiting approval</span><b>{data.awaiting_approval ?? 0}</b></li>
    </ul>
  )
}

function Icon({ d }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function ActiveDemo({ onNavigate, onExit, children }) {
  const d = useDirector({ onNavigate })
  const { view, start, cancel } = d
  const sc = SCENES[view.index]
  const [fs, setFs] = useState(false)
  const [hidden, setHidden] = useState(false) // H hides the caption card so the screen is clear for recording

  useEffect(() => {
    start()
    return cancel
  }, [start, cancel])

  useEffect(() => {
    const on = () => setFs(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  const exit = async (reset) => {
    await d.finish(reset)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    onExit()
  }
  const toggleFs = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen()
      else document.documentElement.requestFullscreen?.()
    } catch { /* fullscreen not available */ }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return
      if (e.key === 'ArrowRight') d.next()
      else if (e.key === 'ArrowLeft') d.prev()
      else if (e.key === ' ' && e.target?.tagName !== 'BUTTON') { e.preventDefault(); d.toggle() }
      else if (e.key === 'f' || e.key === 'F') toggleFs()
      else if (e.key === 'h' || e.key === 'H') setHidden((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [d])

  const ctx = useMemo(() => ({ running: true, scene: sc.id, focusApproval: Boolean(sc.focusApproval) }), [sc])
  const done = view.phase === 'done'

  return (
    <DemoContext.Provider value={ctx}>
      {children}
      <div className="demo-layer" data-paused={view.paused ? 'true' : undefined}>
        {!done && sc.spotlight && <Spotlight key={`spot-${sc.id}`} selector={sc.spotlight} />}
        {!done && sc.scroll && <Scroller key={`scroll-${sc.id}`} selector={sc.scroll} />}
        {!done && <div key={`title-${sc.id}`} className="demo-title" aria-hidden="true"><span>{sc.kicker} / {SCENES.length}</span><h2>{sc.title}</h2></div>}
        <div className="demo-vignette" aria-hidden="true" />

        <section className={`demo-card${hidden ? ' is-hidden' : ''}`} aria-live="polite" aria-label="Guided demo">
          {done ? (
            <>
              <span className="demo-kicker">DEMO COMPLETE</span>
              <h3>NEXORA — From Detection to Decision.</h3>
              <p>The approved dispatch and the jobs from this run are still in the system. Replay resets the weather and closes the demo jobs first.</p>
              <div className="demo-actions">
                <button type="button" className="demo-btn primary" onClick={d.start}>Replay</button>
                <button type="button" className="demo-btn" onClick={() => exit(false)}>Keep exploring</button>
                <button type="button" className="demo-btn" onClick={() => exit(true)}>Reset &amp; exit</button>
              </div>
            </>
          ) : (
            <>
              <div className="demo-top">
                <span className="demo-kicker">{sc.kicker} · {sc.title}</span>
                <span className="demo-keys" aria-hidden="true">Space pause · ← → scenes · F fullscreen · H hide</span>
              </div>
              {view.line && <h3>{view.line.t}</h3>}
              {view.line?.s && <p>{view.line.s}</p>}
              {view.waiting && <p className="demo-wait"><i aria-hidden="true" />{view.note || 'Waiting for the system…'}</p>}
              {view.error && (
                <div className="demo-error" role="alert">
                  <span>Couldn’t start this step: {view.error}</span>
                  <button type="button" className="demo-btn" onClick={() => d.answer('retry')}>Retry</button>
                  <button type="button" className="demo-btn" onClick={() => d.answer('skip')}>Skip step</button>
                </div>
              )}
              <LiveChips />
            </>
          )}

          <ol className="demo-timeline" aria-label="Scenes">
            {SCENES.map((s, i) => (
              <li key={s.id} className={i < view.index || done ? 'done' : i === view.index ? 'now' : ''}>
                <button type="button" title={s.title} aria-label={`${s.kicker}: ${s.title}`} disabled={i > view.index && !done} onClick={() => d.jump(i)}><i /></button>
              </li>
            ))}
          </ol>

          {!done && (
            <div className="demo-bar">
              <button type="button" className="demo-ico" onClick={d.prev} aria-label="Previous scene" disabled={view.index === 0}><Icon d="M15 18l-6-6 6-6" /></button>
              <button type="button" className="demo-ico big" onClick={d.toggle} aria-label={view.paused ? 'Resume' : 'Pause'}>
                <Icon d={view.paused ? 'M8 5v14l11-7z' : 'M9 5v14M15 5v14'} />
              </button>
              <button type="button" className="demo-ico" onClick={d.next} aria-label="Next scene"><Icon d="M9 18l6-6-6-6" /></button>
              <button type="button" className="demo-ico" onClick={toggleFs} aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'}><Icon d={fs ? 'M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6' : 'M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6'} /></button>
              <span className="demo-spacer" />
              <button type="button" className="demo-btn" onClick={() => exit(true)}>Exit demo</button>
            </div>
          )}
        </section>
      </div>
    </DemoContext.Provider>
  )
}

export default function DemoLayer({ enabled, onNavigate, onExit, children }) {
  if (!enabled) return <>{children}</>
  return <ActiveDemo onNavigate={onNavigate} onExit={onExit}>{children}</ActiveDemo>
}
