import { useState } from 'react'
import { ApiDown, Card, Loading, PageHead, Stat } from '../components/ui'
import { api, fmt, usePoll } from '../lib/api'

const KIND = {
  flow: { label: 'Flow meter', hw: 'YF-DN50 / pulse output', max: 15, step: 0.1 },
  pressure: { label: 'Pressure', hw: '0–10 bar transducer (0.5–4.5 V)', max: 6, step: 0.05 },
  level: { label: 'Water level', hw: 'JSN-SR04T waterproof ultrasonic', max: 3, step: 0.01 },
  rain: { label: 'Rain gauge', hw: 'Tipping bucket (reed switch)', max: 150, step: 1 },
  bin: { label: 'Bin fill', hw: 'JSN-SR04T on bin lid', max: 100, step: 1 },
}

function DeviceRow({ d, staff, onChange }) {
  const k = KIND[d.kind]
  const [val, setVal] = useState(d.override ?? d.last_value ?? 0)
  const drive = async (v) => {
    await api(`/sim/override/${d.device_id}`, { method: 'POST', body: { value: v } }).catch(() => {})
    onChange()
  }
  const release = async () => {
    await api(`/sim/override/${d.device_id}`, { method: 'POST', body: { value: null } }).catch(() => {})
    onChange()
  }
  return (
    <div className={`ov-tr dv-tr${d.fault ? ' dv-faulty' : ''}`} role="row" data-demo={`dev-${d.device_id}`}>
      <span className="ov-who">
        <i className={`dv-dot ${d.fault ? 'fault' : d.online ? 'on' : 'off'}`} aria-hidden="true" />
        <span><strong className="mono">{d.device_id}</strong><small>{d.name}</small></span>
      </span>
      <span className="ov-num">{k.label}</span>
      <span className="dv-val"><b>{fmt.num(d.last_value, d.kind === 'bin' || d.kind === 'rain' ? 0 : 2)}</b> {d.unit}</span>
      <span>
        {d.fault
          ? <b className="ov-stage crit" title={d.fault}>FAULT</b>
          : <b className={`ov-stage ${d.source === 'device' ? 'ok' : 'low'}`}>{d.source === 'device' ? 'ESP32' : 'Sim'}</b>}
      </span>
      <span className="ov-why">{d.fault ? d.fault : `${fmt.ago(d.last_seen)} · ${d.rssi ?? '—'} dBm · ${fmt.num(d.battery, 0)}%`}</span>
      <span className="dv-ctrl">
        {staff && (
          <>
            <input type="range" min="0" max={k.max} step={k.step} value={val} onChange={(e) => setVal(+e.target.value)}
              onPointerUp={() => drive(val)} onKeyUp={() => drive(val)} aria-label={`Drive ${d.device_id}`} />
            {d.override !== null && d.override !== undefined && <button type="button" className="ov-link" onClick={release}>auto</button>}
          </>
        )}
      </span>
    </div>
  )
}

function Devices({ session }) {
  const { data, error, loading, refresh } = usePoll('/devices', 3000)
  const [kind, setKind] = useState('all')
  const staff = session?.user?.role !== 'resident'
  if (loading && !data) return <><ApiDown error={error} /><Loading /></>
  if (!data) return <ApiDown error={error} />

  const devs = data.devices.filter((d) => kind === 'all' || d.kind === kind)
  const real = data.devices.filter((d) => d.source === 'device').length
  const toggleSim = async () => {
    await api('/sim/enabled', { method: 'POST', body: { enabled: !data.sim_enabled } }).catch(() => {})
    refresh()
  }

  return (
    <section className="ov cx-module">
      <ApiDown error={error} />
      <PageHead title="Devices & sensor network" desc="Every sensor posts to one ingest API.">
        {staff && <button type="button" className={`ov-btn${data.sim_enabled ? '' : ' primary'}`} onClick={toggleSim}>{data.sim_enabled ? 'Pause simulator' : 'Resume simulator'}</button>}
      </PageHead>

      <div className="ov-card cx-stats4" style={{ '--i': 0 }}>
        <Stat label="Online" value={data.devices.filter((d) => d.online).length} unit={`/ ${data.devices.length}`} tone="ok"
          note={data.devices.some((d) => d.fault) ? `${data.devices.filter((d) => d.fault).length} sensor fault` : 'All sensors healthy'} />
        <Stat label="Real ESP32 nodes" value={real} note={real ? 'Live hardware reporting' : 'Prototype: simulated'} />
        <Stat label="Readings stored" value={fmt.num(data.devices.reduce((s, d) => s + (d.readings_count || 0), 0))} />
        <Stat label="Simulator" value={data.sim_enabled ? 'Running' : 'Paused'} tone={data.sim_enabled ? 'ok' : 'warn'} note="Same path as hardware" />
      </div>

      <Card title="Sensor nodes" icon="◉" i={1} className="ov-table-card" actions={
        <div className="ov-seg-switch" role="group" aria-label="Filter by type">
          {['all', 'flow', 'pressure', 'level', 'rain', 'bin'].map((k) => (
            <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k === 'all' ? 'All' : KIND[k].label}</button>
          ))}
        </div>
      }>
        <div className="ov-table" role="table">
          <div className="ov-tr dv-tr ov-th" role="row"><span>Device</span><span>Type</span><span>Value</span><span>Source</span><span>Last seen · signal · battery</span><span>{staff ? 'Drive value (demo)' : ''}</span></div>
          {devs.map((d) => <DeviceRow key={d.device_id} d={d} staff={staff} onChange={refresh} />)}
        </div>
      </Card>
    </section>
  )
}

export default Devices
