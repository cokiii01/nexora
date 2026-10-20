// Presenter window: open  <site>/?prompter=1  on a second screen / phone. Shows the voice-over for the current scene.
import { useEffect, useState } from 'react'

export default function Prompter() {
  const [m, setM] = useState(null)
  useEffect(() => {
    let bc
    try { bc = new BroadcastChannel('nexora-prompter'); bc.onmessage = (e) => setM(e.data) } catch { /* unsupported */ }
    return () => bc?.close()
  }, [])
  return (
    <div className="prompter">
      <p className="prompter-hint">Prompter · start the demo in the other window (same browser)</p>
      {m && (
        <>
          <h2>{m.title}</h2>
          {m.cue && m.waiting && <div className="prompter-cue">{m.cue}</div>}
          {m.script.map((l, i) => (
            <p key={i} className={l.t === m.line ? 'now' : ''}>{l.vo || l.t}</p>
          ))}
          {m.done && <h2>Done. Stop recording.</h2>}
        </>
      )}
    </div>
  )
}
