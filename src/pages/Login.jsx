import { useState } from 'react'
import { api, saveSession } from '../lib/api'
import { LOGO_SRC } from '../lib/brand'

// Set to true to show the one-click demo sign-in. Judges sign in with the credentials given in the submission.
const SHOW_DEMO_SHORTCUTS = false

const DEMO_EMAIL = { staff: 'operator@nexora.demo', resident: 'resident@nexora.demo' }

function Login({ mode, onLogin, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registering, setRegistering] = useState(false)
  const [reg, setReg] = useState({ name: '', zone: 'Zone C', unit: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const finish = (res) => {
    const wantStaff = mode === 'staff'
    const isStaff = res.user.role !== 'resident'
    if (wantStaff !== isStaff) {
      setError(wantStaff ? 'This is a resident account — use Resident Connect.' : 'Staff accounts sign in through the Command Centre.')
      return
    }
    saveSession(res)
    onLogin(res)
  }

  const submit = async (e, demoEmail) => {
    e?.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = registering && !demoEmail
        ? await api('/auth/register', { method: 'POST', body: { email, password, name: reg.name, zone: reg.zone, unit: reg.unit } })
        : await api('/auth/login', { method: 'POST', body: { email: demoEmail || email, password: demoEmail ? 'nexora123' : password } })
      finish(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cx-shell cx-auth">
      <div className="cx-auth-card">
        <button type="button" className="ov-link cx-auth-back" onClick={onBack}>← Back</button>
        <span className="cx-logo cx-auth-logo" aria-hidden="true"><img src={LOGO_SRC} alt="" /></span>
        <h1>{mode === 'staff' ? 'Command Centre' : registering ? 'Create resident account' : 'Resident Connect'}</h1>
        <p className="ov-muted">{mode === 'staff' ? 'Sign in as township operations staff.' : 'Report issues, track jobs and receive flood alerts for your zone.'}</p>

        <form onSubmit={submit} className="cx-form">
          {registering && (
            <>
              <label>Full name<input required value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} /></label>
              <div className="cx-form-row">
                <label>Zone
                  <select value={reg.zone} onChange={(e) => setReg({ ...reg, zone: e.target.value })}>
                    <option>Zone A</option><option>Zone B</option><option>Zone C</option>
                  </select>
                </label>
                <label>Unit<input placeholder="C-12-03" value={reg.unit} onChange={(e) => setReg({ ...reg, unit: e.target.value })} /></label>
              </div>
            </>
          )}
          <label>Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" required minLength={6} autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p className="cx-error" role="alert">{error}</p>}
          <button type="submit" className="cx-btn-primary cx-btn-block" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</button>
        </form>

        {mode === 'resident' && (
          <button type="button" className="ov-link cx-auth-switch" onClick={() => { setRegistering(!registering); setError('') }}>
            {registering ? 'Already registered? Sign in' : 'New resident? Create an account'}
          </button>
        )}

        {SHOW_DEMO_SHORTCUTS && !registering && (
          <button type="button" className="ov-link cx-auth-switch" disabled={busy} onClick={() => submit(null, DEMO_EMAIL[mode])}>
            Sign in with the demo account
          </button>
        )}
      </div>
    </div>
  )
}

export default Login
