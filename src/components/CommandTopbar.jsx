import { useEffect, useState } from 'react'
import { stageLabel } from '../lib/labels'

const TITLES = {
  overview: 'Overview',
  water: 'Water & leaks',
  flood: 'Flood warning',
  workOrders: 'Work orders',
  devices: 'Devices',
  reports: 'Climate-resilience report',
  roi: 'Business case',
  digitalTwin: 'Digital Twin',
  intelligenceGraph: 'Intelligence Graph',
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])
  return now
}

function CommandTopbar({ activePage, setActivePage, summary }) {
  const now = useClock()
  const flood = summary?.flood_stage || 'NORMAL'
  const floodTone = flood === 'NORMAL' ? 'ok' : flood === 'WASPADA' ? 'warn' : 'crit'
  const leaks = summary?.leaking_zones?.length || 0
  const date = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <header className="cx-topbar">
      <div className="cx-crumbs">
        <button type="button" onClick={() => setActivePage('overview')}>NEXORA</button>
        <span aria-hidden="true">/</span>
        <strong>{TITLES[activePage]}</strong>
      </div>
      <div className="cx-top-actions">
        <span className="cx-clock">{date} · {time}</span>
        {summary && (
          <>
            <button type="button" className={`cx-pill ${floodTone}`} onClick={() => setActivePage('flood')}><i />Flood {stageLabel(flood)}</button>
            <button type="button" className={`cx-pill ${leaks ? 'crit' : 'ok'}`} onClick={() => setActivePage('water')}><i />{leaks ? `${leaks} zone leaking` : 'No leaks'}</button>
          </>
        )}
        <button type="button" className="cx-btn-primary" onClick={() => setActivePage('workOrders')}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Work orders{summary ? ` · ${summary.work_orders_open}` : ''}
        </button>
      </div>
    </header>
  )
}

export default CommandTopbar
