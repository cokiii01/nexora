// Demo Director — a small state machine that walks through SCENES.
//
//  * Cinematic pacing uses timers (how long a caption stays).
//  * Anything that matters waits for REAL backend state (`scene.until`, polled) — never a fixed delay.
//  * One run at a time: starting, going back or exiting bumps `token`, so a stale loop stops itself and can
//    never move the screen of a newer run.
//  * Pausing freezes progression only; polling carries on so the real state is not missed.
import { useCallback, useEffect, useRef, useState } from 'react'
import { SCENES, resetWorld } from './scenes'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

export function useDirector({ onNavigate }) {
  const [view, setView] = useState({ phase: 'running', index: 0, line: SCENES[0].lines[0], waiting: false, note: '', error: null, paused: false })
  const ctl = useRef({ token: 0, paused: false, skip: false, gate: null, index: 0 })
  const nav = useRef(onNavigate)
  useEffect(() => { nav.current = onNavigate }) // always call the latest navigate callback

  const cancel = useCallback(() => {
    const c = ctl.current
    c.token += 1
    c.gate?.('skip')
    c.gate = null
  }, [])

  const run = useCallback(async (from, silentFirst = false) => {
    const c = ctl.current
    c.token += 1
    c.gate?.('skip')
    c.gate = null
    c.paused = false
    const token = c.token
    const alive = () => c.token === token

    // wait `ms` of un-paused time; false = this run was cancelled
    // wall-clock based, so a busy browser (e.g. heavy 3D) never stretches or shrinks a caption
    const pace = async (ms) => {
      let left = ms
      let last = Date.now()
      while (left > 0) {
        if (!alive()) return false
        if (c.skip) return true
        await delay(100)
        const now = Date.now()
        if (!c.paused) left -= now - last
        last = now
      }
      return alive()
    }
    const hold = async () => {
      while (alive() && c.paused && !c.skip) await delay(120)
      return alive()
    }
    // poll the backend until `fn` is true; tolerant of a slow or restarting backend
    const pollUntil = async (fn, timeoutMs) => {
      const t0 = Date.now()
      while (alive()) {
        if (c.skip) return 'skipped'
        try { if (await fn()) return 'ok' } catch { /* backend slow — keep trying */ }
        if (timeoutMs && Date.now() - t0 > timeoutMs) return 'timeout'
        for (let k = 0; k < 6 && alive() && !c.skip; k += 1) await delay(250)
      }
      return 'cancelled'
    }
    const askGate = (message) => {
      setView((v) => ({ ...v, error: message }))
      return new Promise((resolve) => { c.gate = resolve })
    }

    let silent = silentFirst
    for (let i = from; i < SCENES.length; i += 1) {
      const sc = SCENES[i]
      c.skip = false
      c.index = i
      setView({ phase: 'running', index: i, line: sc.lines[0], waiting: false, note: '', error: null, paused: c.paused })
      nav.current(sc, i)

      // 1) trigger the real backend action (retry / skip if it fails)
      let entered = silent || !sc.enter
      while (!entered && alive()) {
        try {
          await sc.enter()
          entered = true
        } catch (e) {
          const choice = await askGate(e.message || 'The backend did not respond.')
          if (!alive()) return
          setView((v) => ({ ...v, error: null }))
          if (choice === 'skip') break
        }
      }
      if (!alive()) return

      // 2) captions play while we wait for the real event
      let done = silent || !sc.until
      let result = 'ok'
      const untilP = silent || !sc.until
        ? Promise.resolve('ok')
        : pollUntil(sc.until, sc.timeoutMs).then((r) => { done = true; result = r; return r })
      for (const line of sc.lines) {
        setView((v) => ({ ...v, line }))
        if (!(await pace(line.ms))) return
      }
      if (!alive()) return
      if (!done && !c.skip) setView((v) => ({ ...v, waiting: true, note: sc.waitNote || '' }))
      await untilP
      if (!alive()) return

      // 3) react to what actually happened
      if (result === 'timeout') {
        setView((v) => ({ ...v, waiting: false, line: { t: 'This is taking longer than expected.', s: 'The system has not reached this state yet. Continuing with what is on screen — nothing is being faked.', ms: 5000 } }))
        if (!(await pace(5000))) return
      } else if (result === 'ok' && sc.after && !c.skip) {
        setView((v) => ({ ...v, waiting: false, line: sc.after }))
        if (!(await pace(sc.after.ms))) return
      }
      setView((v) => ({ ...v, waiting: false }))
      if (!(await hold())) return
      silent = false
    }
    if (alive()) setView((v) => ({ ...v, phase: 'done', waiting: false, line: null }))
  }, [])

  const start = useCallback(() => run(0), [run])
  const pause = useCallback(() => { ctl.current.paused = true; setView((v) => ({ ...v, paused: true })) }, [])
  const resume = useCallback(() => { ctl.current.paused = false; setView((v) => ({ ...v, paused: false })) }, [])
  const toggle = useCallback(() => (ctl.current.paused ? resume() : pause()), [pause, resume])
  const next = useCallback(() => { ctl.current.paused = false; ctl.current.skip = true; setView((v) => ({ ...v, paused: false })) }, [])
  const jump = useCallback((i) => run(Math.max(0, Math.min(SCENES.length - 1, i)), true), [run])
  const prev = useCallback(() => jump(ctl.current.index - 1), [jump])
  const answer = useCallback((choice) => { ctl.current.gate?.(choice); ctl.current.gate = null }, [])
  const finish = useCallback(async (reset) => {
    cancel()
    if (reset) await resetWorld().catch(() => {})
  }, [cancel])

  return { view, start, cancel, pause, resume, toggle, next, prev, jump, answer, finish }
}
