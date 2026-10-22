import { stageLabel } from '../lib/labels'
import { LOGO_SRC } from '../lib/brand'

// Page keys used by the sidebar.

const Icon = ({ d, children }) => (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
)

const icons = {
  overview: <Icon d="M2.5 7.2 8 2.8l5.5 4.4v6a.8.8 0 0 1-.8.8H9.8V10H6.2v4H3.3a.8.8 0 0 1-.8-.8v-6Z" />,
  water: <Icon d="M8 1.8S3.5 6.8 3.5 9.9a4.5 4.5 0 0 0 9 0C12.5 6.8 8 1.8 8 1.8Z" />,
  flood: <Icon d="M1.8 10.5c1.1 0 1.6-.9 2.6-.9s1.5.9 2.6.9 1.5-.9 2.6-.9 1.5.9 2.6.9 1.5-.9 2-.9M1.8 13.5c1.1 0 1.6-.9 2.6-.9s1.5.9 2.6.9 1.5-.9 2.6-.9 1.5.9 2.6.9 1.5-.9 2-.9M4 7.5l4-5 4 5" />,
  waste: <Icon d="M2.8 4.2h10.4M6.2 4.2V2.6h3.6v1.6M4 4.2l.7 9.2h6.6l.7-9.2M6.6 6.6v4.6M9.4 6.6v4.6" />,
  workOrders: <Icon d="M5.2 2.6h5.6M4 2.6h-.6a.8.8 0 0 0-.8.8v10a.8.8 0 0 0 .8.8h9.2a.8.8 0 0 0 .8-.8v-10a.8.8 0 0 0-.8-.8H12M5.4 7.4l1.4 1.4 3-3M5.4 11.4h5.2" />,
  devices: <Icon><rect x="4.2" y="4.2" width="7.6" height="7.6" rx="1" /><path d="M6.4 1.8v2.4M9.6 1.8v2.4M6.4 11.8v2.4M9.6 11.8v2.4M1.8 6.4h2.4M1.8 9.6h2.4M11.8 6.4h2.4M11.8 9.6h2.4" /></Icon>,
  reports: <Icon d="M3 13.5V8.5M6.3 13.5V4.5M9.7 13.5V7M13 13.5V2.5" />,
  roi: <Icon d="M2.5 11.5 6 8l2.6 2.6 4.9-5.1M10.5 5.5h3v3" />,
  digitalTwin: <Icon><path d="M8 1.8 13.5 5v6L8 14.2 2.5 11V5L8 1.8Z" /><path d="M2.5 5 8 8.2 13.5 5M8 8.2v6" /></Icon>,
  intelligenceGraph: <Icon><circle cx="4" cy="4" r="1.7" /><circle cx="12" cy="5" r="1.7" /><circle cx="7" cy="12" r="1.7" /><path d="M5.6 4.3 10.3 4.8M4.7 5.6l1.6 4.8M11.1 6.5l-3.2 4" /></Icon>,
  operations: <Icon d="M8 1.8v2.4M8 11.8v2.4M1.8 8h2.4M11.8 8h2.4M8 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />,
  sustainability: <Icon d="M13.5 2.5C7 2.5 3 5.8 3 10.2c0 1.3.4 2.4 1 3.3M13.5 2.5c0 6.3-3.3 10.3-7.6 10.3-1 0-1.9-.2-2.6-.6M13.5 2.5 6.5 9.5" />,
}

function CommandNav({ activePage, setActivePage, exitToLanding, summary, session, onLogout }) {
  const s = summary
  const sections = [
    ['Monitor', [
      { key: 'overview', label: 'Overview' },
      { key: 'water', label: 'Water & leaks', count: s?.leaking_zones?.length || null, tone: s?.leaking_zones?.length ? 'crit' : '' },
      { key: 'flood', label: 'Flood warning', count: s && s.flood_stage !== 'NORMAL' ? stageLabel(s.flood_stage) : null, tone: 'warn' },
    ]],
    ['Operate', [
      { key: 'workOrders', label: 'Work orders', count: s?.work_orders_open ?? null, tone: s?.work_orders_breached ? 'crit' : '' },
      { key: 'devices', label: 'Devices', count: s ? `${s.devices_online}/${s.devices_total}` : null },
      { key: 'reports', label: 'Resilience report' },
      { key: 'roi', label: 'Business case' },
    ]],
    ['Explore', [
      { key: 'digitalTwin', label: 'Digital Twin' },
      { key: 'intelligenceGraph', label: 'Intelligence Graph' },
    ]],
  ]

  return (
    <aside className="cx-sidebar" aria-label="Command Centre navigation">
      <button type="button" className="cx-workspace" onClick={exitToLanding} title="Back to NEXORA home">
        <span className="cx-logo" aria-hidden="true"><img src={LOGO_SRC} alt="" /></span>
        <span className="cx-workspace-copy">
          <strong>NEXORA</strong>
          <small>Township OS</small>
        </span>
        <svg className="cx-chevron" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M10 4 6 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>

      <nav className="cx-nav">
        {sections.map(([label, items]) => (
          <div key={label} className="cx-nav-group">
            <p className="cx-nav-label">{label}</p>
            {items.map((m) => (
              <button
                key={m.key}
                type="button"
                className={activePage === m.key ? 'active' : ''}
                onClick={() => setActivePage(m.key)}
                aria-current={activePage === m.key ? 'page' : undefined}
              >
                {icons[m.key]}
                <span>{m.label}</span>
                {m.count !== null && m.count !== undefined && <em className={m.tone || ''}>{m.count}</em>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="cx-sidebar-foot">
        <div className="cx-user">
          <span className="cx-avatar" aria-hidden="true">{session?.user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
          <span className="cx-user-copy">
            <strong>{session?.user?.name}</strong>
            <small>{session?.user?.role}</small>
          </span>
          <button type="button" className="cx-live-chip" onClick={onLogout}>Sign out</button>
        </div>
      </div>
    </aside>
  )
}

export default CommandNav
