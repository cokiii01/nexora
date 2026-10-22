import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import { usePoll } from '../lib/api'
import { stageLabel } from '../lib/labels'

const COLORS = {
  core: '#ff9a3c',
  zone: '#ffd84d',
  team: '#ffe27a',
  incident: '#ffb52e',
  system: '#ffa6d8',
  data: '#ff8fc7',
  sensor: '#ff8fc7',
  infrastructure: '#e9a8ff',
  alert: '#ff5c7a',
  job: '#ffb52e',
  residents: '#8fe0b8',
}
const HOT = '#ff4d5e'

const FONT = '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace'

const STATIC_RING = [
  'ZONE A', 'INC-0038', 'Road Team 01', 'Predictive AI', 'Operations Centre',
  'Agentic AI', 'Electrical Team 03', 'INC-0036', 'ZONE C', 'INC-0041',
  'Water Team 02', 'ZONE B', 'Traffic Alert B',
]

const n = (id, type, status, size, extra = {}) => ({ id, type, status, size, ...extra })
const l = (source, target, relation) => ({ source, target, relation })

/* Fallback graph (backend offline) — the original hand-made graph */
const STATIC_GRAPH = {
  nodes: [
    n('NEXORA CORE', 'core', 'Operational', 9),
    n('IoT Gateway', 'data', 'Live', 6),
    n('Data Lake', 'data', 'Operational', 5),
    n('Predictive AI', 'system', 'Active', 6),
    n('Agentic AI', 'system', 'Active', 6),
    n('Operations Centre', 'system', 'Operational', 6),

    n('ZONE A', 'zone', 'Normal', 7),
    n('ZONE B', 'zone', 'Normal', 7),
    n('ZONE C', 'zone', 'Normal', 7),

    n('WT-01', 'sensor', 'Normal', 4),
    n('WT-02', 'sensor', 'Normal', 4),
    n('WT-03', 'sensor', 'Normal', 5),
    n('WT-04', 'sensor', 'Normal', 5),

    n('Pipeline A1', 'infrastructure', 'Normal', 4),
    n('Pipeline B1', 'infrastructure', 'Normal', 4),
    n('Pipeline C1', 'infrastructure', 'Normal', 4),
    n('Pipeline C2', 'infrastructure', 'Normal', 4),
    n('Pump C1', 'infrastructure', 'Normal', 5),

    n('EN-12', 'sensor', 'Normal', 5),
    n('TR-08', 'sensor', 'Normal', 5),
    n('SL-204', 'sensor', 'Normal', 4),

    n('Substation A', 'infrastructure', 'Normal', 5),
    n('Junction B', 'infrastructure', 'Normal', 5),
    n('Streetlight Grid', 'infrastructure', 'Normal', 4),

    n('INC-0041', 'incident', 'Monitoring', 6),
    n('INC-0038', 'incident', 'Active', 5),
    n('INC-0036', 'incident', 'Active', 5),
    n('Traffic Alert B', 'incident', 'Monitoring', 5),

    n('Water Team 02', 'team', 'Available', 5),
    n('Road Team 01', 'team', 'Deployed', 5),
    n('Electrical Team 03', 'team', 'Available', 5),

    n('Edge Node A', 'data', 'Online', 3),
    n('Edge Node B', 'data', 'Online', 3),
    n('Edge Node C', 'data', 'Online', 3),
  ],

  links: [
    l('NEXORA CORE', 'IoT Gateway', 'connected_to'),
    l('NEXORA CORE', 'Predictive AI', 'connected_to'),
    l('NEXORA CORE', 'Agentic AI', 'connected_to'),
    l('NEXORA CORE', 'Operations Centre', 'connected_to'),
    l('IoT Gateway', 'Data Lake', 'sends_data_to'),
    l('Data Lake', 'Predictive AI', 'sends_data_to'),
    l('Predictive AI', 'Agentic AI', 'sends_data_to'),
    l('Agentic AI', 'Operations Centre', 'sends_data_to'),

    l('ZONE A', 'NEXORA CORE', 'connected_to'),
    l('ZONE B', 'NEXORA CORE', 'connected_to'),
    l('ZONE C', 'NEXORA CORE', 'connected_to'),

    l('WT-01', 'Pipeline A1', 'monitored_by'),
    l('WT-02', 'Pipeline B1', 'monitored_by'),
    l('WT-03', 'Pipeline C1', 'monitored_by'),
    l('WT-04', 'Pipeline C2', 'monitored_by'),

    l('Pipeline A1', 'ZONE A', 'connected_to'),
    l('Pipeline B1', 'ZONE B', 'connected_to'),
    l('Pipeline C1', 'ZONE C', 'connected_to'),
    l('Pipeline C2', 'ZONE C', 'connected_to'),
    l('Pipeline C1', 'Pump C1', 'connected_to'),
    l('Pipeline C2', 'Pump C1', 'connected_to'),

    l('WT-01', 'Edge Node A', 'sends_data_to'),
    l('WT-02', 'Edge Node B', 'sends_data_to'),
    l('WT-03', 'Edge Node C', 'sends_data_to'),
    l('WT-04', 'Edge Node C', 'sends_data_to'),

    l('Edge Node A', 'IoT Gateway', 'sends_data_to'),
    l('Edge Node B', 'IoT Gateway', 'sends_data_to'),
    l('Edge Node C', 'IoT Gateway', 'sends_data_to'),
    l('Edge Node A', 'ZONE A', 'connected_to'),
    l('Edge Node B', 'ZONE B', 'connected_to'),
    l('Edge Node C', 'ZONE C', 'connected_to'),

    l('EN-12', 'Substation A', 'monitored_by'),
    l('Substation A', 'ZONE A', 'connected_to'),
    l('EN-12', 'Edge Node A', 'sends_data_to'),

    l('TR-08', 'Junction B', 'monitored_by'),
    l('Junction B', 'ZONE B', 'connected_to'),
    l('TR-08', 'Edge Node B', 'sends_data_to'),

    l('SL-204', 'Streetlight Grid', 'monitored_by'),
    l('Streetlight Grid', 'ZONE B', 'connected_to'),
    l('SL-204', 'Edge Node B', 'sends_data_to'),

    l('INC-0041', 'WT-04', 'detected_by'),
    l('INC-0041', 'ZONE C', 'affects'),
    l('INC-0041', 'Predictive AI', 'detected_by'),
    l('INC-0041', 'Water Team 02', 'handled_by'),

    l('INC-0038', 'ZONE A', 'affects'),
    l('INC-0038', 'Road Team 01', 'handled_by'),
    l('INC-0038', 'Operations Centre', 'connected_to'),

    l('INC-0036', 'SL-204', 'detected_by'),
    l('INC-0036', 'Electrical Team 03', 'handled_by'),
    l('INC-0036', 'Operations Centre', 'connected_to'),

    l('Traffic Alert B', 'TR-08', 'detected_by'),
    l('Traffic Alert B', 'ZONE B', 'affects'),
    l('Traffic Alert B', 'Operations Centre', 'connected_to'),

    l('Water Team 02', 'Operations Centre', 'connected_to'),
    l('Road Team 01', 'Operations Centre', 'connected_to'),
    l('Electrical Team 03', 'Operations Centre', 'connected_to'),

    l('ZONE A', 'ZONE B', 'connected_to'),
    l('ZONE B', 'ZONE C', 'connected_to'),
    l('ZONE C', 'ZONE A', 'connected_to'),

    l('Predictive AI', 'WT-04', 'monitored_by'),
    l('Predictive AI', 'EN-12', 'monitored_by'),
    l('Predictive AI', 'TR-08', 'monitored_by'),

    l('Agentic AI', 'Water Team 02', 'connected_to'),
    l('Agentic AI', 'Road Team 01', 'connected_to'),
    l('Agentic AI', 'Electrical Team 03', 'connected_to'),
  ],
}

const LEGACY = new Set(['EN-12', 'TR-08', 'SL-204', 'WT-03', 'Substation A', 'Junction B', 'Streetlight Grid', 'Traffic Alert B', 'Road Team 01', 'Electrical Team 03', 'INC-0038', 'INC-0036'])
STATIC_GRAPH.nodes = STATIC_GRAPH.nodes.filter((x) => !LEGACY.has(x.id))
STATIC_GRAPH.links = STATIC_GRAPH.links.filter((x) => !LEGACY.has(x.source) && !LEGACY.has(x.target))
STATIC_GRAPH.nodes.forEach((node) => { node.ring = STATIC_RING.includes(node.id) })

const INFRA_FOR = {
  'FM-A': 'Water main A', 'FM-B': 'Water main B', 'FM-C': 'Water main C', 'WT-04': 'Water main C',
  'DL-A1': 'Monsoon drain A', 'DL-B1': 'Culvert B', 'DL-C1': 'Retention pond C',
}
const SENSOR_KINDS = new Set(['flow', 'pressure', 'level', 'rain'])
const STAGE_HOT = { AMARAN: true, BAHAYA: true }

function buildLiveGraph({ devices, alerts, jobs, water }) {
  const nodes = []
  const links = []
  const ids = new Set()
  const add = (node) => { if (!ids.has(node.id)) { ids.add(node.id); nodes.push(node) } }
  const zoneId = (z) => z.toUpperCase()

  const leaking = new Set((water?.zones || []).filter((z) => z.leak_suspected).map((z) => z.zone))
  const alertsByZone = {}
  alerts.forEach((a) => { (alertsByZone[a.zone] ||= []).push(a) })

  add(n('NEXORA CORE', 'core', 'Operational', 9, { ring: false }))
  add(n('IoT Gateway', 'data', `${devices.filter((d) => d.online).length} online`, 6, { ring: true }))
  add(n('Rules Engine', 'system', `${alerts.length} active alerts`, 6, { ring: true }))
  add(n('Operations Centre', 'system', `${jobs.length} open jobs`, 6, { ring: true }))
  links.push(l('NEXORA CORE', 'IoT Gateway', 'connected_to'), l('IoT Gateway', 'Rules Engine', 'sends_data_to'),
    l('Rules Engine', 'Operations Centre', 'raises_jobs_in'), l('NEXORA CORE', 'Operations Centre', 'connected_to'))

  ;['Zone A', 'Zone B', 'Zone C'].forEach((z) => {
    const za = alertsByZone[z] || []
    const flood = za.find((a) => a.kind === 'flood')
    const status = leaking.has(z) ? 'Leak detected' : flood ? `Flood ${stageLabel(flood.level)}` : 'Normal'
    add(n(zoneId(z), 'zone', status, 7, { ring: true, hot: leaking.has(z) || (flood && STAGE_HOT[flood.level]) }))
    links.push(l(zoneId(z), 'NEXORA CORE', 'connected_to'))
    add(n(`Residents ${z.slice(-1)}`, 'residents', 'Resident Connect', 4))
    links.push(l(`Residents ${z.slice(-1)}`, zoneId(z), 'lives_in'))
  })

  devices.filter((d) => SENSOR_KINDS.has(d.kind)).forEach((d) => {
    const hotAlert = alerts.find((a) => a.device_id === d.device_id)
    const val = d.last_value === null || d.last_value === undefined ? '—' : `${Number(d.last_value).toFixed(d.kind === 'rain' ? 0 : 2)} ${d.unit}`
    const label = d.fault ? 'SENSOR FAULT' : hotAlert ? `${val} · ${stageLabel(hotAlert.level)}` : val
    add(n(d.device_id, 'sensor', label, 5, { hot: !!hotAlert || !!d.fault, live: d.source === 'device' }))
    links.push(l(d.device_id, 'IoT Gateway', 'sends_data_to'))
    const infra = INFRA_FOR[d.device_id]
    if (infra) {
      add(n(infra, 'infrastructure', 'Monitored', 5))
      links.push(l(d.device_id, infra, 'monitors'), l(infra, zoneId(d.zone), 'serves'))
    } else {
      links.push(l(d.device_id, zoneId(d.zone), 'located_in'))
    }
  })

  const jobByRef = Object.fromEntries(jobs.map((j) => [j.ref, j]))
  alerts.forEach((a) => {
    const id = `ALERT ${a.device_id}${a.kind === 'mnf' ? ' night' : ''}`
    const alertLabel = a.kind === 'flood' ? stageLabel(a.level) : a.kind === 'mnf' ? 'Night-flow leak' : a.kind === 'leak' ? 'Burst suspected'
      : a.kind === 'sensor_fault' ? 'Sensor fault' : a.level
    add(n(id, 'alert', alertLabel, 6, { ring: true, hot: true, detail: a.title }))
    if (ids.has(a.device_id)) links.push(l(id, a.device_id, 'detected_by'))
    links.push(l(id, zoneId(a.zone), 'affects'), l(id, 'Rules Engine', 'raised_by'))
    if (a.kind === 'flood' || a.kind === 'pressure') links.push(l(id, `Residents ${a.zone.slice(-1)}`, 'notified'))
    if (a.work_order_ref && jobByRef[a.work_order_ref]) {
      // job node added below; link after
      links.push(l(id, a.work_order_ref, 'opened_job'))
    }
  })

  jobs.forEach((j) => {
    const breached = j.sla?.state === 'breached'
    add(n(j.ref, 'job', breached ? 'SLA breached' : j.awaiting_approval ? 'Awaiting approval' : j.status.replace('_', ' '), 5, { hot: breached || j.awaiting_approval, ring: j.source === 'sensor', detail: j.title }))
    links.push(l(j.ref, zoneId(j.zone), 'affects'), l(j.ref, 'Operations Centre', 'tracked_in'))
    if (j.source === 'resident') links.push(l(`Residents ${j.zone.slice(-1)}`, j.ref, 'reported'))
    if (j.team) {
      add(n(j.team, 'team', 'Assigned', 5, { ring: true }))
      links.push(l(j.ref, j.team, 'handled_by'), l(j.team, 'Operations Centre', 'connected_to'))
    }
  })

  // drop links whose endpoints are missing (e.g. job closed between polls)
  const safe = links.filter((x) => ids.has(x.source) && ids.has(x.target))
  return { nodes, links: safe }
}

const RING_A = 110 
const RING_B = 68 

function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hashId = (str) => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

// Positions are derived from each node's id, so a node keeps its place when the live data refreshes.
function applyLayout(data) {
  const ring = data.nodes.filter((node) => node.ring)
  data.nodes.forEach((node) => {
    let p
    if (node.type === 'core') {
      p = [0, 0, 0]
    } else if (node.ring) {
      const i = ring.indexOf(node)
      const ang = (i / ring.length) * Math.PI * 2
      p = [Math.cos(ang) * RING_A, Math.sin(i * 1.7) * 6, Math.sin(ang) * RING_B]
    } else {
      const rand = mulberry32(hashId(node.id))
      const ang = rand() * Math.PI * 2
      const f = 0.3 + rand() * 1.2
      p = [Math.cos(ang) * RING_A * f, (rand() - 0.5) * 90, Math.sin(ang) * RING_B * f]
    }
    node.x = node.fx = p[0]
    node.y = node.fy = p[1]
    node.z = node.fz = p[2]
  })
  data.links.forEach((link, i) => {
    const rand = mulberry32(hashId(`${link.source}>${link.target}`))
    link.curv = 0.28 + rand() * 0.5
    link.rot = rand() * Math.PI * 2
    link.particles = link.relation === 'notified' || link.relation === 'opened_job' || link.relation === 'detected_by' ? 2 : i % 6 === 0 ? 1 : 0
  })
  return data
}

let glowTexture = null
function getGlowTexture() {
  if (glowTexture) return glowTexture
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  glowTexture = new THREE.CanvasTexture(c)
  return glowTexture
}

function createLabelSprite(lines, worldPerPx) {
  const pad = 10
  const gap = lines[0].px * 0.9
  const measure = document.createElement('canvas').getContext('2d')

  let width = 0
  let height = pad * 2
  lines.forEach((ln) => {
    measure.font = `700 ${ln.px}px ${FONT}`
    width = Math.max(width, measure.measureText(ln.text).width)
    height += ln.px * 1.3
  })
  width += gap + pad * 2

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width)
  canvas.height = Math.ceil(height)
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur = 6

  let y = pad
  lines.forEach((ln) => {
    ctx.font = `700 ${ln.px}px ${FONT}`
    ctx.fillStyle = ln.color
    ctx.fillText(ln.text, gap + pad, y)
    y += ln.px * 1.3
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    })
  )
  sprite.center.set(0, 0.5)
  sprite.scale.set(canvas.width * worldPerPx, canvas.height * worldPerPx, 1)
  sprite.userData.base = 1
  return sprite
}

const fmtTime = () =>
  new Date().toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

function IntelligenceGraph() {
  const containerRef = useRef(null)
  const graphRef = useRef(null)
  const previousViewRef = useRef(null)
  const resetRef = useRef(() => {})

  const [selectedNode, setSelectedNode] = useState(null)
  const [hud, setHud] = useState({ fps: 60, time: fmtTime() })

  // Live data from the township engine (falls back to the static graph when the backend is offline)
  const devicesPoll = usePoll('/devices', 5000)
  const alertsPoll = usePoll('/alerts', 5000)
  const jobsPoll = usePoll('/work-orders?open_only=true', 5000)
  const waterPoll = usePoll('/water', 10000)
  // jobs need a login; if that call fails the graph still shows sensors + alerts live
  const live = Boolean(devicesPoll.data && alertsPoll.data)
  const liveGraph = useMemo(() => {
    if (!live) return null
    return buildLiveGraph({ devices: devicesPoll.data.devices, alerts: alertsPoll.data, jobs: jobsPoll.data || [], water: waterPoll.data })
  }, [live, devicesPoll.data, alertsPoll.data, jobsPoll.data, waterPoll.data])
  const signature = liveGraph ? liveGraph.nodes.map((x) => `${x.id}:${x.status}:${x.hot ? 1 : 0}`).join('|') + '#' + liveGraph.links.length : 'static'
  const [data, setData] = useState(() => applyLayout(STATIC_GRAPH))
  const dataRef = useRef(data)
  const lastSig = useRef('static')

  useEffect(() => {
    if (signature === lastSig.current) return
    lastSig.current = signature
    const next = applyLayout(liveGraph || STATIC_GRAPH)
    dataRef.current = next
    setData(next)
    if (graphRef.current) graphRef.current.graphData(next)
  }, [signature, liveGraph])

  const connectedIds = useMemo(() => {
    if (!selectedNode) return new Set()
    const ids = new Set([selectedNode.id])
    data.links.forEach((link) => {
      const s = typeof link.source === 'object' ? link.source.id : link.source
      const t = typeof link.target === 'object' ? link.target.id : link.target
      if (s === selectedNode.id) ids.add(t)
      if (t === selectedNode.id) ids.add(s)
    })
    return ids
  }, [selectedNode, data])

  useEffect(() => {
    let frames = 0
    let raf
    const loop = () => {
      frames++
      raf = requestAnimationFrame(loop)
    }
    loop()
    const id = setInterval(() => {
      setHud({ fps: frames, time: fmtTime() })
      frames = 0
    }, 1000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(id)
    }
  }, [])

  /* setup graph */
  useEffect(() => {
    if (!containerRef.current) return
    const element = containerRef.current

    const Graph = ForceGraph3D()(element)
    graphRef.current = Graph

    Graph.backgroundColor('#04030a')
      .showNavInfo(false)
      .graphData(dataRef.current)
      .nodeLabel(
        (node) => `
          <div style="background:rgba(5,4,12,.94);border:1px solid ${COLORS[node.type]};
            padding:8px 11px;border-radius:6px;color:white;font-family:${FONT};font-size:11px">
            <div style="color:${COLORS[node.type]};letter-spacing:1px;margin-bottom:4px">${node.type}</div>
            <strong style="font-size:13px">${node.id}</strong>
            <div style="color:#9ca3af;margin-top:4px">status · ${node.status}</div>
            ${node.detail ? `<div style="color:#d4d0dc;margin-top:4px;max-width:240px;white-space:normal">${node.detail}</div>` : ''}
          </div>`
      )
      .nodeThreeObject((node) => {
        const color = node.hot ? HOT : COLORS[node.type]
        const isRing = node.ring
        const isCore = node.type === 'core'
        const group = new THREE.Group()

        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(node.size * (isRing ? 0.2 : 0.15), 16, 16),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
        )
        dot.userData.base = 1
        group.add(dot)

        // glow
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: getGlowTexture(),
            color,
            transparent: true,
            opacity: isRing ? 0.85 : 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
        glow.scale.setScalar(node.size * (isRing ? 3.4 : 2.6))
        glow.userData.base = isRing ? 0.85 : 0.5
        group.add(glow)

        let label
        if (isCore) {
          label = createLabelSprite(
            [
              { text: '', color: '#ffffff', px: 54 },
              {
                text: `${dataRef.current.nodes.length} nodes`,
                color: '#7cb8ff',
                px: 34,
              },
            ],
            0.085
          )
        } else if (isRing) {
          label = createLabelSprite(
            [
              { text: node.id, color, px: 44 },
              { text: node.status, color: '#c9c3d6', px: 28 },
            ],
            0.082
          )
        } else {
          label = createLabelSprite([{ text: node.id, color, px: 40 }], 0.07)
        }
        group.add(label)

        return group
      })
      .nodeThreeObjectExtend(false)
      .linkColor(() => 'rgba(255, 215, 235, 0.38)')
      .linkWidth(0)
      .linkOpacity(0.9)
      .linkCurvature('curv')
      .linkCurveRotation('rot')
      .linkDirectionalParticles('particles')
      .linkDirectionalParticleWidth(1.1)
      .linkDirectionalParticleSpeed(0.003)
      .linkDirectionalParticleColor(() => '#ffe27a')
      .onNodeClick((node) => {
        const camera = Graph.camera()
        const controls = Graph.controls()

        if (!previousViewRef.current) {
          previousViewRef.current = {
            position: { ...camera.position },
            target: controls?.target
              ? { ...controls.target }
              : { x: 0, y: 0, z: 0 },
          }
        }

        if (controls) controls.autoRotate = false
        setSelectedNode(node)

        const distance = 70
        const len = Math.hypot(node.x, node.y, node.z) || 1
        const ratio = 1 + distance / len

        Graph.cameraPosition(
          {
            x: node.x * ratio || distance,
            y: node.y * ratio + 12,
            z: node.z * ratio || distance,
          },
          node,
          900
        )
      })
      .onBackgroundClick(() => resetRef.current())

    Graph.cooldownTicks(1)

    const ringPts = []
    for (let i = 0; i <= 200; i++) {
      const a = (i / 200) * Math.PI * 2
      ringPts.push(
        new THREE.Vector3(Math.cos(a) * RING_A, 0, Math.sin(a) * RING_B)
      )
    }
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineBasicMaterial({
        color: '#ffd84d',
        transparent: true,
        opacity: 0.45,
      })
    )
    Graph.scene().add(ring)

    Graph.cameraPosition({ x: 0, y: 105, z: 175 }, { x: 0, y: -5, z: 0 }, 0)

    const controls = Graph.controls()
    if (controls) {
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.rotateSpeed = 0.45
      controls.zoomSpeed = 0.65
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.35
    }

    const resizeGraph = () => {
      Graph.width(element.clientWidth)
      Graph.height(element.clientHeight)
    }
    resizeGraph()
    const resizeObserver = new ResizeObserver(resizeGraph)
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
      Graph.scene().remove(ring)
      if (Graph._destructor) Graph._destructor()
      element.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    resetRef.current = () => {
      setSelectedNode(null)
      const Graph = graphRef.current
      if (!Graph) return
      const controls = Graph.controls()
      if (controls) controls.autoRotate = true

      const prev = previousViewRef.current
      if (prev) {
        Graph.cameraPosition(prev.position, prev.target, 900)
        previousViewRef.current = null
      }
    }
  })

  useEffect(() => {
    const Graph = graphRef.current
    if (!Graph) return

    data.nodes.forEach((node) => {
      const obj = node.__threeObj
      if (!obj) return
      const dim = selectedNode && !connectedIds.has(node.id)
      obj.traverse((o) => {
        if (o.material && o.userData.base !== undefined) {
          o.material.opacity = o.userData.base * (dim ? 0.1 : 1)
        }
      })
    })

    const isActive = (link) => {
      const s = typeof link.source === 'object' ? link.source.id : link.source
      const t = typeof link.target === 'object' ? link.target.id : link.target
      return s === selectedNode?.id || t === selectedNode?.id
    }

    Graph.linkColor((link) => {
      if (!selectedNode) return 'rgba(255, 215, 235, 0.38)'
      return isActive(link)
        ? 'rgba(255, 235, 160, 0.95)'
        : 'rgba(120, 100, 140, 0.05)'
    })
  }, [selectedNode, connectedIds, data])

  const selectedConnections = selectedNode
    ? data.links.filter((link) => {
        const s = typeof link.source === 'object' ? link.source.id : link.source
        const t = typeof link.target === 'object' ? link.target.id : link.target
        return s === selectedNode.id || t === selectedNode.id
      })
    : []

  return (
    <section className="ig-page">
      <div className="ig-header">
        <h1>NEXORA Intelligence Graph</h1>
        <span>Live chain: sensor → alert → work order → team → residents. Red = needs attention.</span>
      </div>

      <div className="ig-hud">
        <b>nodes</b> {data.nodes.length}
        <b>links</b> {data.links.length}
        <b>source</b> {live ? 'live /api/v2' : 'static (backend offline)'}
        <b>zones</b> 3
        <b>realtimes</b> {hud.time}
        <b>fps</b> {hud.fps}
      </div>

      <div className="ig-stage">
        <div ref={containerRef} className="ig-canvas" />

        <div className="ig-hint">
          drag to rotate · scroll to zoom · click a node to explore
        </div>

        <div className="ig-legend">
          <Legend color={COLORS.core} label="Core" />
          <Legend color={COLORS.zone} label="Zone" />
          <Legend color={COLORS.team} label="Team" />
          <Legend color={COLORS.sensor} label="Sensor" />
          <Legend color={COLORS.infrastructure} label="Infra" />
          <Legend color={COLORS.system} label="System" />
          <Legend color={COLORS.alert} label="Alert" />
          <Legend color={COLORS.job} label="Job" />
          <Legend color={COLORS.residents} label="Residents" />
        </div>

        {selectedNode && (
          <aside className="ig-panel">
            <button
              type="button"
              className="ig-close"
              onClick={() => resetRef.current()}
            >
              ×
            </button>
            <p style={{ color: COLORS[selectedNode.type] }}>
              {selectedNode.type}
            </p>
            <h2>{selectedNode.id}</h2>

            <div className="ig-row">
              <span>status</span>
              <strong style={{ color: COLORS[selectedNode.type] }}>
                {selectedNode.status}
              </strong>
            </div>
            <div className="ig-row">
              <span>connection</span>
              <strong>{selectedConnections.length}</strong>
            </div>

            <div className="ig-divider" />

            <div className="ig-conns">
              {selectedConnections.slice(0, 6).map((link, index) => {
                const s =
                  typeof link.source === 'object' ? link.source.id : link.source
                const t =
                  typeof link.target === 'object' ? link.target.id : link.target
                const other = s === selectedNode.id ? t : s
                return (
                  <div key={`${other}-${index}`}>
                    <span>{other}</span>
                    <small>{link.relation.replaceAll('_', ' ')}</small>
                  </div>
                )
              })}
            </div>
          </aside>
        )}
      </div>

      <style>{`
        .ig-page {
          height: calc(100vh - 76px);
          min-height: 650px;
          background: #04030a;
          color: #fff;
          overflow: hidden;
          position: relative;
          font-family: ${FONT};
        }
        .ig-stage, .ig-canvas { position: absolute; inset: 0; }
        .ig-stage { overflow: hidden; }
        .ig-canvas { z-index: 1; }

        .ig-header { position: absolute; z-index: 10; top: 22px; left: 28px; pointer-events: none; }
        .ig-header h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -.2px; }
        .ig-header span { display: block; margin-top: 6px; color: #7d7890; font-size: 11px; }

        .ig-hud {
          position: absolute; z-index: 10; top: 78px; left: 28px;
          display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap;
          font-size: 12px; font-weight: 700; color: #fff; pointer-events: none;
        }
        .ig-hud b { color: #6f6a82; font-weight: 600; margin-left: 12px; }
        .ig-hud b:first-child { margin-left: 0; }

        .ig-hint { position: absolute; z-index: 8; left: 28px; bottom: 24px; color: #5d5870; font-size: 10px; pointer-events: none; }

        .ig-legend {
          position: absolute; z-index: 8; bottom: 20px; left: 50%; transform: translateX(-50%);
          display: flex; gap: 14px; padding: 8px 14px;
          border: 1px solid rgba(255,255,255,.07); background: rgba(5,4,11,.7);
          backdrop-filter: blur(12px); border-radius: 6px; pointer-events: none;
        }
        .ig-legend-item { display: flex; align-items: center; gap: 6px; color: #9a95a8; font-size: 10px; white-space: nowrap; }
        .ig-legend-dot { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }

        .ig-panel {
          position: absolute; z-index: 20; right: 24px; top: 90px; width: 250px; padding: 18px;
          border: 1px solid rgba(255,216,77,.22); background: rgba(7,5,15,.9);
          backdrop-filter: blur(20px); border-radius: 8px; box-shadow: 0 18px 60px rgba(0,0,0,.4);
        }
        .ig-close { position: absolute; top: 8px; right: 12px; border: 0; background: none; color: #716c7d; font-size: 20px; cursor: pointer; }
        .ig-close:focus-visible { outline: 2px solid #ffd84d; }
        .ig-panel > p { margin: 0 0 6px; font-size: 11px; }
        .ig-panel h2 { margin: 0 0 16px; font-size: 18px; font-weight: 700; }
        .ig-row { display: flex; justify-content: space-between; margin-top: 10px; font-size: 11px; }
        .ig-row span { color: #7d7890; }
        .ig-divider { height: 1px; background: rgba(255,255,255,.07); margin: 14px 0 6px; }
        .ig-conns > div { display: flex; justify-content: space-between; gap: 8px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,.04); }
        .ig-conns span { color: #ddd8e8; font-size: 11px; }
        .ig-conns small { color: #7d7890; font-size: 9px; }

        @media (max-width: 1000px) { .ig-legend { display: none; } }
      `}</style>
    </section>
  )
}

function Legend({ color, label }) {
  return (
    <div className="ig-legend-item">
      <span className="ig-legend-dot" style={{ background: color, color }} />
      {label}
    </div>
  )
}

export default IntelligenceGraph
