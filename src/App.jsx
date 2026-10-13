import { useEffect, useState } from 'react'
import './App.css'
import './nexora-v10.css'

import CommandNav from './components/CommandNav'
import CommandTopbar from './components/CommandTopbar'
import { api, loadSession, saveSession, usePoll } from './lib/api'
import DemoLayer from './demo/DemoDirector'
import { LOGO_SRC } from './lib/brand'
import Intro from './components/Intro'
import { shouldShowIntro } from './lib/intro'

import Overview from './pages/Overview'
import Water from './pages/Water'
import Flood from './pages/Flood'
import WorkOrders from './pages/WorkOrders'
import Devices from './pages/Devices'
import Reports from './pages/Reports'
import Roi from './pages/Roi'
import Login from './pages/Login'
import ResidentApp from './pages/ResidentApp'

import DigitalTwin from './pages/DigitalTwin'
import IntelligenceGraph from './pages/IntelligenceGraph'

function CommandCentre({ session, onLogout, onExit, demo, onDemoEnd }) {
  const [activePage, setActivePage] = useState('overview')
  const [targetSensor, setTargetSensor] = useState(null)
  // The guided demo drives navigation through the same setter the sidebar uses.
  const onDemoNavigate = (scene) => {
    setActivePage(scene.page)
  }
  // Shared live snapshot for WT-04 — Digital Twin updates it, Overview reads it.
  const [liveWT04Snapshot, setLiveWT04Snapshot] = useState({ value: 3.2, status: 'Normal', connected: false })
  const summary = usePoll('/summary', 8000)

  const openSensorInDigitalTwin = (sensorID) => {
    setTargetSensor(sensorID)
    setActivePage('digitalTwin')
  }

  const props = { session, goTo: setActivePage }

  return (
    <div className="command-centre cx-shell">
      <DemoLayer enabled={demo} onNavigate={onDemoNavigate} onExit={onDemoEnd}>
      <CommandNav
        activePage={activePage}
        setActivePage={setActivePage}
        exitToLanding={onExit}
        liveWT04={liveWT04Snapshot}
        summary={summary.data}
        session={session}
        onLogout={onLogout}
      />

      <div className="cx-main">
        <CommandTopbar
          activePage={activePage}
          setActivePage={setActivePage}
          openSensor={openSensorInDigitalTwin}
          liveWT04={liveWT04Snapshot}
          summary={summary.data}
        />

        <div className={`cx-canvas cx-page-${activePage}`} key={activePage} role="main">
          {activePage === 'overview' && (
            <Overview
              setActivePage={setActivePage}
              openSensorInDigitalTwin={openSensorInDigitalTwin}
              liveWT04={liveWT04Snapshot}
              summary={summary.data}
            />
          )}
          {activePage === 'water' && <Water {...props} />}
          {activePage === 'flood' && <Flood {...props} />}
          {activePage === 'workOrders' && <WorkOrders {...props} />}
          {activePage === 'devices' && <Devices {...props} />}
          {activePage === 'reports' && <Reports {...props} />}
          {activePage === 'roi' && <Roi {...props} />}

          {activePage === 'digitalTwin' && (
            <DigitalTwin
              targetSensor={targetSensor}
              clearTargetSensor={() => setTargetSensor(null)}
              initialLiveWT04={liveWT04Snapshot}
              onLiveWT04Change={setLiveWT04Snapshot}
            />
          )}
          {activePage === 'intelligenceGraph' && <IntelligenceGraph />}
        </div>
      </div>
      </DemoLayer>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState('landing')
  const [intro, setIntro] = useState(() => shouldShowIntro())
  const [session, setSession] = useState(() => loadSession())
  const [demo, setDemo] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [demoError, setDemoError] = useState('')

  // A 401 anywhere means the saved login is no longer valid: go back to the right login screen.
  useEffect(() => {
    const expired = () => {
      setSession((s) => {
        if (s) setScreen(s.user.role === 'resident' ? 'login-resident' : 'login-staff')
        return null
      })
    }
    window.addEventListener('nexora:session-expired', expired)
    return () => window.removeEventListener('nexora:session-expired', expired)
  }, [])

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    saveSession(null)
    setSession(null)
    setDemo(false)
    setScreen('landing')
  }
  const isStaff = session && session.user.role !== 'resident'
  const isResident = session && session.user.role === 'resident'
  const openCommand = () => setScreen(isStaff ? 'command' : 'login-staff')

  // "Run guided demo": sign in with the demo operator account (no typing) and let the Demo Director take over.
  const startDemo = async () => {
    setDemoBusy(true)
    setDemoError('')
    try {
      const res = await api('/auth/login', { method: 'POST', body: { email: 'operator@nexora.demo', password: 'nexora123' } })
      saveSession(res)
      setSession(res)
      setDemo(true)
      setScreen('command')
    } catch (err) {
      setDemoError(err.status === 0 || err.status === undefined
        ? err.message
        : 'The demo needs the seeded demo accounts. Delete backend/nexora.db, restart the backend, then try again.')
    } finally {
      setDemoBusy(false)
    }
  }
  const openResident = () => setScreen(isResident ? 'resident' : 'login-resident')

  if (screen === 'login-staff' || screen === 'login-resident') {
    const mode = screen === 'login-staff' ? 'staff' : 'resident'
    return (
      <Login
        mode={mode}
        onBack={() => setScreen('landing')}
        onLogin={(s) => { setSession(s); setScreen(mode === 'staff' ? 'command' : 'resident') }}
      />
    )
  }

  if (screen === 'resident') {
    if (!isResident) return <Login mode="resident" onBack={() => setScreen('landing')} onLogin={(s) => setSession(s)} />
    return <ResidentApp session={session} onLogout={logout} backToHome={() => setScreen('landing')} />
  }

  if (screen === 'command') {
    if (!isStaff) return <Login mode="staff" onBack={() => setScreen('landing')} onLogin={(s) => setSession(s)} />
    return (
      <CommandCentre
        session={session}
        onLogout={logout}
        onExit={() => { setDemo(false); setScreen('landing') }}
        demo={demo}
        onDemoEnd={() => setDemo(false)}
      />
    )
  }
  // =========================================

  // NEXORA LANDING V4 — CINEMATIC / MINIMAL

  // =========================================



  return (

    <div className="nexora nexora-cinematic nexora-v3 nexora-v4">

      {intro && <Intro onDone={() => setIntro(false)} />}

      <div className="landing-bg" aria-hidden="true">

        <video

          className="landing-bg-video"

          autoPlay

          muted

          loop

          playsInline

          preload="auto"

          poster="/nexora-township-clean.png"

        >

          <source src="/nexora-township.mp4" type="video/mp4" />

        </video>

        <div className="landing-bg-grid" />

        <div className="landing-bg-scan" />

      </div>



      <header className="landing-nav">

        <button

          type="button"

          className="landing-brand"

          onClick={() => setScreen('landing')}

          aria-label="NEXORA home"

        >

          <span className="landing-mark" aria-hidden="true"><img src={LOGO_SRC} alt="" /></span>

          <span className="landing-wordmark">NEXORA</span>

        </button>

      </header>



      <main className="landing-hero">

        <section className="landing-copy">



          <h2>

            The township,<br />

            <strong>reimagined.</strong>

          </h2>



          <p className="landing-lead">

            Township water fails silently — hidden leaks, blocked drains, sensors that die unnoticed.

            NEXORA catches it early and keeps a person in charge of the response.

          </p>



          <div className="landing-actions">

            <button className="command-entry-btn" onClick={openCommand}>

              Explore NEXORA <b>↗</b>

            </button>



            <button className="resident-entry-btn" onClick={openResident}>

              Resident Connect

            </button>

            <button className="demo-entry-btn" onClick={startDemo} disabled={demoBusy}>

              {demoBusy ? 'Starting…' : 'Run guided demo'} <b>▶</b>

            </button>

          </div>

          {demoError && <p className="landing-demo-error" role="alert">{demoError}</p>}

        </section>

      </main>

    </div>

  )

}



export default App