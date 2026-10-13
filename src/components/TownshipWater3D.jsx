// Live water + flood layer for the 3D Digital Twin, driven by /api/v2 (same data as the Water and Flood pages).
//  - leaking zones pulse pink with their daily loss
//  - drains and the retention pond fill with water to the real sensor level, coloured by flood stage
//  - rain falls over the model when the rain gauge reports rainfall
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { stageLabel } from '../lib/labels'

// Footprints of the zone floors in Township3D (centre x, centre z, width, depth)
const ZONE_FOOTPRINT = {
  'Zone A': [-6.8, -4.8, 6.8, 6.2],
  'Zone B': [6.8, -4.6, 6.8, 6.5],
  'Zone C': [0, 5.4, 18, 5.9],
}

// Where each level sensor's channel sits on the model (centre x, centre z, length x, width z, wall height)
const CHANNELS = {
  'DL-A1': { pos: [-6.8, -9.45], size: [6.4, 0.75], wall: 0.7, kind: 'drain' },
  'DL-B1': { pos: [6.8, -9.45], size: [6.4, 0.75], wall: 0.7, kind: 'drain' },
  'DL-C1': { pos: [0, 9.4], size: [7.2, 1.5], wall: 0.85, kind: 'pond' },
}

// keep the leak badge clear of the zone label and sensor tags
const BADGE_OFFSET = { 'Zone A': [1.8, 3.4, 1.2], 'Zone B': [-1.6, 4.2, 1.4], 'Zone C': [5.8, 3.0, 0.6] }

const STAGE_COLOR = { NORMAL: '#4f8cff', WASPADA: '#f5c66b', AMARAN: '#fb923c', BAHAYA: '#ff4d5e' }
const TH_COLOR = { WASPADA: '#f5c66b', AMARAN: '#fb923c', BAHAYA: '#ff4d5e' }

function LeakZone({ zone, info }) {
  const fp = ZONE_FOOTPRINT[zone]
  const glow = useRef()
  const ring = useRef()
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (glow.current) glow.current.material.opacity = 0.16 + (Math.sin(t * 3) + 1) * 0.09
    if (ring.current) {
      const ph = (t * 0.45) % 1
      ring.current.scale.set(1 + ph * 0.08, 1, 1 + ph * 0.08)
      ring.current.material.opacity = 0.75 * (1 - ph)
    }
  })
  if (!fp) return null
  const [x, z, w, d] = fp
  const repaired = info.verification_pending
  const color = repaired ? '#f5c66b' : '#ff5c9a'
  return (
    <group position={[x, 0.1, z]}>
      <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <lineSegments ref={ring}>
        <edgesGeometry args={[new THREE.BoxGeometry(w, 0.02, d)]} />
        <lineBasicMaterial color={color} transparent opacity={0.8} />
      </lineSegments>
      <Html position={BADGE_OFFSET[zone] || [0, 3.1, 0]} center distanceFactor={16} style={{ pointerEvents: 'none' }}>
        <div className={`t3d-badge ${repaired ? 'warn' : 'leak'}`}>
          <strong>{repaired ? 'LEAK REPAIRED' : 'HIDDEN LEAK'}</strong>
          <span>{repaired ? 'verifying tonight' : `${info.loss_m3_per_day} m³/day · RM ${Math.round(info.loss_rm_per_year).toLocaleString()}/yr`}</span>
        </div>
      </Html>
    </group>
  )
}

function Channel({ sensor }) {
  const cfg = CHANNELS[sensor.device_id]
  const water = useRef()
  const mat = useRef()
  const faulty = Boolean(sensor.fault)
  const stage = faulty ? 'NORMAL' : sensor.stage || 'NORMAL'
  const depth = sensor.meta?.depth || 1
  const fill = Math.max(0.02, Math.min(1, (sensor.last_value || 0) / depth))

  useFrame(({ clock }, dt) => {
    if (!water.current || !cfg) return
    const cur = water.current.scale.y
    const next = cur + (fill - cur) * Math.min(1, dt * 2.5)
    water.current.scale.y = next
    water.current.position.y = (cfg.wall * next) / 2 + 0.02
    if (mat.current) {
      mat.current.emissiveIntensity = stage === 'BAHAYA' ? 0.6 + Math.sin(clock.getElapsedTime() * 6) * 0.35 : stage === 'NORMAL' ? 0.25 : 0.45
    }
  })
  if (!cfg) return null
  const [x, z] = cfg.pos
  const [len, wid] = cfg.size
  const H = cfg.wall
  const t = 0.08
  const color = faulty ? '#7a8590' : STAGE_COLOR[stage]
  const ths = Object.entries(sensor.meta?.thresholds || {})

  return (
    <group position={[x, 0, z]}>
      {/* concrete channel */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[len, 0.04, wid]} />
        <meshStandardMaterial color="#1a2326" roughness={0.95} />
      </mesh>
      {[[0, -(wid / 2 + t / 2), len + t * 2, t], [0, wid / 2 + t / 2, len + t * 2, t], [-(len / 2 + t / 2), 0, t, wid], [len / 2 + t / 2, 0, t, wid]].map(([px, pz, sx, sz], i) => (
        <mesh key={i} position={[px, H / 2, pz]} castShadow receiveShadow>
          <boxGeometry args={[sx, H, sz]} />
          <meshStandardMaterial color="#3a4a4f" roughness={0.85} transparent opacity={i === 1 ? 0.35 : 1} />
        </mesh>
      ))}
      {/* threshold marks on the back wall */}
      {ths.map(([k, v]) => (
        <mesh key={k} position={[0, (v / depth) * H, -(wid / 2) - t - 0.001]}>
          <boxGeometry args={[len + t * 2, 0.025, 0.01]} />
          <meshBasicMaterial color={TH_COLOR[k]} />
        </mesh>
      ))}
      {/* water body */}
      <mesh ref={water} scale={[1, 0.05, 1]} position={[0, 0.03, 0]}>
        <boxGeometry args={[len - 0.02, H, wid - 0.02]} />
        <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.82} roughness={0.15} metalness={0.1} />
      </mesh>
      {stage !== 'NORMAL' && <pointLight position={[0, H + 0.6, 0]} color={color} intensity={stage === 'BAHAYA' ? 10 : 5} distance={5} />}
      <Html position={[0, H + 0.9, 0]} center distanceFactor={15}>
        <div className={`t3d-badge ${faulty ? 'fault' : `stage-${stage}`}`}>
          <strong>{sensor.device_id} · {faulty ? 'SENSOR FAULT' : stageLabel(stage)}</strong>
          <span>{faulty ? 'Reading not trusted · job opened' : `${cfg.kind === 'pond' ? 'Retention pond' : 'Monsoon drain'} · ${Number(sensor.last_value || 0).toFixed(2)} m`}</span>
        </div>
      </Html>
    </group>
  )
}

function Rain({ intensity }) {
  const COUNT = 1400
  const ref = useRef()
  const positions = useMemo(() => {
    const a = new Float32Array(COUNT * 3)
    // deterministic scatter (stable across renders)
    const r = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
    for (let i = 0; i < COUNT; i++) {
      a[i * 3] = (r(i * 3) - 0.5) * 25
      a[i * 3 + 1] = r(i * 3 + 1) * 14
      a[i * 3 + 2] = (r(i * 3 + 2) - 0.5) * 21
    }
    return a
  }, [])
  useFrame((_, dt) => {
    if (!ref.current) return
    const arr = ref.current.geometry.attributes.position.array
    const speed = 9 + intensity * 0.12
    const visible = Math.min(COUNT, Math.round(COUNT * Math.min(1, intensity / 80)))
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] -= speed * dt
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] += 14
    }
    ref.current.geometry.attributes.position.needsUpdate = true
    ref.current.geometry.setDrawRange(0, visible)
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#a8c8ff" size={0.06} transparent opacity={0.7} depthWrite={false} />
    </points>
  )
}

export function WaterFloodLayer({ water, flood }) {
  const leaks = (water?.zones || []).filter((z) => z.leak_suspected || z.verification_pending)
  const levels = (flood?.sensors || []).filter((s) => s.kind === 'level')
  const rain = flood?.sensors?.find((s) => s.kind === 'rain')?.last_value || 0
  return (
    <group>
      {leaks.map((z) => <LeakZone key={z.zone} zone={z.zone} info={z} />)}
      {levels.map((s) => <Channel key={s.device_id} sensor={s} />)}
      {rain > 2 && <Rain intensity={rain} />}
    </group>
  )
}
