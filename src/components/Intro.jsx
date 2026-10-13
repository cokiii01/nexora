import { useEffect, useState } from 'react'
import { LOGO_SRC } from '../lib/brand'
import { INTRO_KEY as KEY } from '../lib/intro'

// Splash shown once per browser tab: the logo spins, the name appears, then the page opens.
// Click or press any key to skip. Skipped entirely when the visitor prefers reduced motion.
export default function Intro({ onDone }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2600)
    const t2 = setTimeout(done, 3200)
    const skip = () => { setLeaving(true); setTimeout(done, 350) }
    window.addEventListener('keydown', skip)
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('keydown', skip) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function done() {
    try { sessionStorage.setItem(KEY, '1') } catch { /* private mode: just show again next time */ }
    onDone()
  }

  return (
    <div
      className={`nx-intro${leaving ? ' leaving' : ''}`}
      role="presentation"
      onClick={() => { setLeaving(true); setTimeout(done, 350) }}
    >
      <div className="nx-intro-stage">
        <div className="nx-intro-logo"><img src={LOGO_SRC} alt="" /></div>
        <p className="nx-intro-name">NEXORA</p>
        <p className="nx-intro-tag">From detection to decision</p>
      </div>
      <span className="nx-intro-skip">Click to skip</span>
    </div>
  )
}
