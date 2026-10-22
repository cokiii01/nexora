import { Canvas, useFrame } from '@react-three/fiber'
import {
  Environment,
  Grid,
  Html,
  OrbitControls,
  RoundedBox,
} from '@react-three/drei'
import { Component, Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { usePoll } from '../lib/api'
import { stageLabel } from '../lib/labels'
import { WaterFloodLayer } from './TownshipWater3D'

const PALETTE = {
  ground: '#0a1215',
  plate: '#0f1b20',
  plateEdge: '#1d3a40',
  asphalt: '#0d1417',
  sidewalk: '#18262b',
  lane: '#8da3a0',
  roof: '#22343a',
  residential: '#1f2f36',
  commercial: '#1a3340',
  utility: '#1b3a33',
  windowWarm: '#ffcf8a',
  windowCool: '#6fdcf0',
  windowGreen: '#7dffd6',
}

/* The HDR environment map is downloaded from a CDN. Without internet (e.g. at a venue)
   it would crash the whole app, so it is isolated here and simply skipped on failure. */
class OptionalEnvironment extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {}
  render() {
    if (this.state.failed) return <hemisphereLight args={['#cfe9ff', '#0a1215', 0.6]} />
    return <Suspense fallback={null}>{this.props.children}</Suspense>
  }
}

/* deterministic pseudo-random so windows never flicker on re-render */
const rand = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function Windows({ scale, color, seed }) {
  const ref = useRef()

  const slots = useMemo(() => {
    const list = []
    const rows = Math.max(1, Math.floor((scale[1] - 0.5) / 0.42))
    const faces = [
      { cols: Math.max(1, Math.floor(scale[0] / 0.42)), w: scale[0], z: scale[2] / 2 + 0.012, ry: 0 },
      { cols: Math.max(1, Math.floor(scale[2] / 0.42)), w: scale[2], x: scale[0] / 2 + 0.012, ry: Math.PI / 2 },
    ]
    faces.forEach((face, f) => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < face.cols; c++) {
          if (rand(seed * 31 + f * 7 + r * 13 + c * 17) < 0.28) continue
          const offset = (c - (face.cols - 1) / 2) * (face.w / face.cols)
          const y = -scale[1] / 2 + 0.45 + r * 0.42
          list.push(
            f === 0
              ? { p: [offset, y, face.z], ry: 0 }
              : { p: [face.x, y, offset], ry: face.ry }
          )
        }
      }
    })
    return list
  }, [scale, seed])

  useLayoutEffect(() => {
    if (!ref.current) return
    const dummy = new THREE.Object3D()
    slots.forEach((s, i) => {
      dummy.position.set(...s.p)
      dummy.rotation.set(0, s.ry, 0)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [slots])

  return (
    <instancedMesh ref={ref} args={[null, null, slots.length]}>
      <boxGeometry args={[0.2, 0.16, 0.02]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.1}
        roughness={0.4}
      />
    </instancedMesh>
  )
}

function Building({ position, scale = [2, 2, 2], type = 'residential' }) {
  const wall =
    type === 'commercial'
      ? PALETTE.commercial
      : type === 'utility'
        ? PALETTE.utility
        : PALETTE.residential

  const windowColor =
    type === 'commercial'
      ? PALETTE.windowCool
      : type === 'utility'
        ? PALETTE.windowGreen
        : PALETTE.windowWarm

  const seed = position[0] * 3.1 + position[2] * 5.7

  return (
    <group position={position}>
      <RoundedBox
        args={[1, 1, 1]}
        scale={scale}
        radius={0.05}
        smoothness={3}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={wall}
          roughness={type === 'commercial' ? 0.35 : 0.75}
          metalness={type === 'commercial' ? 0.55 : 0.15}
        />
      </RoundedBox>

      <Windows scale={scale} color={windowColor} seed={seed} />

      {/* base plinth */}
      <mesh position={[0, -scale[1] / 2 + 0.06, 0]} receiveShadow>
        <boxGeometry args={[scale[0] + 0.12, 0.12, scale[2] + 0.12]} />
        <meshStandardMaterial color="#101c20" roughness={0.9} />
      </mesh>

      {/* roof slab + parapet */}
      <mesh position={[0, scale[1] / 2 + 0.04, 0]} castShadow>
        <boxGeometry args={[scale[0] + 0.1, 0.08, scale[2] + 0.1]} />
        <meshStandardMaterial color={PALETTE.roof} roughness={0.7} />
      </mesh>

      {/* rooftop equipment */}
      <mesh position={[scale[0] * 0.15, scale[1] / 2 + 0.17, -scale[2] * 0.15]} castShadow>
        <boxGeometry args={[scale[0] * 0.38, 0.18, scale[2] * 0.34]} />
        <meshStandardMaterial color="#2c4249" roughness={0.6} />
      </mesh>

      {type === 'commercial' && (
        <mesh position={[-scale[0] * 0.25, scale[1] / 2 + 0.55, scale[2] * 0.2]}>
          <cylinderGeometry args={[0.015, 0.025, 1, 6]} />
          <meshStandardMaterial color="#ff4d5e" emissive="#ff4d5e" emissiveIntensity={1.4} />
        </mesh>
      )}

      {/* water tank on utility building */}
      {type === 'utility' && (
        <group position={[-scale[0] * 0.25, scale[1] / 2 + 0.5, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.7, 24]} />
            <meshStandardMaterial color="#244a45" roughness={0.45} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.44, 0.44, 0.05, 24]} />
            <meshStandardMaterial color={PALETTE.windowGreen} emissive={PALETTE.windowGreen} emissiveIntensity={0.9} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function Road({ position, scale, rotation = [0, 0, 0] }) {
  return (
    <mesh position={position} scale={scale} rotation={rotation} receiveShadow>
      <boxGeometry args={[1, 0.04, 1]} />
      <meshStandardMaterial color={PALETTE.asphalt} roughness={0.95} />
    </mesh>
  )
}

function RoadLine({ position, scale, rotation = [0, 0, 0] }) {
  return (
    <mesh position={position} scale={scale} rotation={rotation}>
      <boxGeometry args={[1, 0.015, 1]} />
      <meshStandardMaterial
        color={PALETTE.lane}
        emissive="#283332"
        emissiveIntensity={0.25}
      />
    </mesh>
  )
}

/* dashed centre line along one axis */
function DashedLine({ axis = 'x', length = 24, y = 0.1 }) {
  const dashes = useMemo(() => {
    const out = []
    for (let p = -length / 2 + 0.8; p < length / 2; p += 1.2) {
      if (Math.abs(p) < 1.4) continue // leave the junction clear
      out.push(p)
    }
    return out
  }, [length])

  return dashes.map((p) => (
    <RoadLine
      key={`${axis}-${p}`}
      position={axis === 'x' ? [p, y, 0] : [0, y + 0.005, p]}
      scale={axis === 'x' ? [0.6, 0.02, 0.06] : [0.06, 0.02, 0.6]}
    />
  ))
}

function Crosswalk({ position, horizontal = true }) {
  return (
    <group position={position}>
      {[-0.6, -0.3, 0, 0.3, 0.6].map((o) => (
        <mesh key={o} position={horizontal ? [o, 0.095, 0] : [0, 0.095, o]}>
          <boxGeometry args={horizontal ? [0.14, 0.012, 1.1] : [1.1, 0.012, 0.14]} />
          <meshStandardMaterial color="#9fb3b0" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function StreetLamp({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 1.1, 8]} />
        <meshStandardMaterial color="#2c4249" />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#ffe3b0" emissive="#ffd48a" emissiveIntensity={2.2} />
      </mesh>
    </group>
  )
}

function Tree({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.6, 8]} />
        <meshStandardMaterial color="#3d3126" />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <coneGeometry args={[0.38, 0.7, 7]} />
        <meshStandardMaterial color="#1b5a47" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <coneGeometry args={[0.26, 0.5, 7]} />
        <meshStandardMaterial color="#23705a" roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

function ZoneFloor({ position, scale, color }) {
  return (
    <group position={position}>
      <mesh receiveShadow>
        <boxGeometry args={scale} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.55}
          roughness={0.95}
        />
      </mesh>
      {/* outline so each zone reads as a district */}
      <lineSegments position={[0, scale[1] / 2 + 0.002, 0]} rotation={[0, 0, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(scale[0], 0.001, scale[2])]} />
        <lineBasicMaterial color="#2f6b62" transparent opacity={0.7} />
      </lineSegments>
    </group>
  )
}

function ZoneLabel({ position, title, subtitle }) {
  return (
    <Html
      position={position}
      center
      distanceFactor={18}
      style={{ pointerEvents: 'none' }}
    >
      <div className="township-zone-label">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </Html>
  )
}

function CriticalAnomalyPulse() {
  const ringOne = useRef()
  const ringTwo = useRef()
  const glow = useRef()

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()

    if (ringOne.current) {
      const phase = (time * 0.55) % 1
      const scale = 0.8 + phase * 2.8
      ringOne.current.scale.set(scale, scale, scale)
      ringOne.current.material.opacity = Math.max(0, 0.72 * (1 - phase))
    }

    if (ringTwo.current) {
      const phase = (time * 0.55 + 0.5) % 1
      const scale = 0.8 + phase * 2.8
      ringTwo.current.scale.set(scale, scale, scale)
      ringTwo.current.material.opacity = Math.max(0, 0.5 * (1 - phase))
    }

    if (glow.current) {
      const pulse = 1 + Math.sin(time * 4.2) * 0.16
      glow.current.scale.set(pulse, pulse, pulse)
      glow.current.material.opacity = 0.13 + (Math.sin(time * 4.2) + 1) * 0.055
    }
  })

  return (
    <group>
      <mesh ref={glow} position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.15, 64]} />
        <meshBasicMaterial color="#ff3048" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh ref={ringOne} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.72, 64]} />
        <meshBasicMaterial color="#ff4d5e" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh ref={ringTwo} position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.72, 64]} />
        <meshBasicMaterial color="#ff3048" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  )
}

function SensorMarker({
  position,
  id,
  label,
  value,
  status = 'Normal',
  onClick,
}) {
  const normalizedStatus = status?.toLowerCase() || 'normal'
  const critical = normalizedStatus === 'critical'
  const warning = normalizedStatus === 'warning'

  const color = critical ? '#ff4d5e' : warning ? '#ffb84d' : '#2df0b8'

  return (
    <group position={position}>
      {/* base disc */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.06, 32]} />
        <meshStandardMaterial color="#10201f" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* stem */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.045, 1.1, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>

      {/* sensor head */}
      <mesh
        position={[0, 1.3, 0]}
        onClick={(event) => {
          event.stopPropagation()
          onClick?.()
        }}
        castShadow
      >
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={critical ? 3 : 1.5}
          roughness={0.3}
        />
      </mesh>

      {/* ground ring */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.45, 48]} />
        <meshBasicMaterial color={color} transparent opacity={critical ? 0.95 : 0.5} />
      </mesh>

      {critical && (
        <>
          <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.75, 0.82, 64]} />
            <meshBasicMaterial color="#ff4d5e" transparent opacity={0.6} />
          </mesh>

          <pointLight
            position={[0, 1.2, 0]}
            color="#ff3048"
            intensity={12}
            distance={6}
          />

          <CriticalAnomalyPulse />
        </>
      )}

      <Html position={[0, 1.8, 0]} center distanceFactor={14}>
        <button
          type="button"
          className={`township-sensor-label ${
            critical ? 'critical' : warning ? 'warning' : ''
          }`}
          onClick={onClick}
        >
          <span>{id}</span>
          <strong>{value}</strong>
          <small>
            {label} · {critical ? 'CRITICAL' : status}
          </small>
        </button>
      </Html>
    </group>
  )
}

function TownshipScene({
  liveWT03,
  liveWT04,
  liveEN12,
  liveTR08,
  onSensorSelect,
  water,
  flood,
}) {
  const residentialBuildings = useMemo(
    () => [
      [-8.2, 0.7, -5.8],
      [-5.8, 0.7, -5.8],
      [-8.2, 0.7, -3.6],
      [-5.8, 0.7, -3.6],
      [-8.2, 0.7, 4.1],
      [-5.8, 0.7, 4.1],
      [-8.2, 0.7, 6.1],
      [-5.8, 0.7, 6.1],
      [5.6, 0.7, 5.4],
      [8.1, 0.7, 5.4],
      [5.6, 0.7, 7.1],
      [8.1, 0.7, 7.1],
    ],
    []
  )

  const commercialBuildings = useMemo(
    () => [
      [5.3, 1.8, -5.6, 2.2, 3.6, 2.1],
      [8.1, 2.6, -5.5, 2.0, 5.2, 2.0],
      [5.5, 1.4, -2.8, 2.3, 2.8, 1.8],
      [8.3, 2.0, -2.7, 1.9, 4.0, 1.9],
    ],
    []
  )

  const lamps = useMemo(
    () => [
      [-10, 1.15], [-6, 1.15], [-3, -1.15], [3, 1.15], [6, -1.15], [10, -1.15],
      [1.15, -8], [-1.15, -4], [1.15, 4], [-1.15, 8],
    ],
    []
  )

  const statusFloor = (status, normal, warn = '#382b16', crit = '#39151b') =>
    status === 'Critical' ? crit : status === 'Warning' ? warn : normal

  return (
    <>
      <color attach="background" args={['#060d10']} />
      <fog attach="fog" args={['#060d10', 26, 58]} />

      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#6fb6c8', '#0a1215', 0.35]} />

      <directionalLight
        position={[12, 20, 8]}
        intensity={1.8}
        color="#cfe9ff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
      />

      <pointLight position={[-8, 8, -7]} intensity={6} color="#2df0b8" distance={22} />

      {/* Model plate: ground + raised rim, like a physical scale model */}
      <mesh position={[0, -0.14, 0]} receiveShadow>
        <boxGeometry args={[25, 0.25, 21]} />
        <meshStandardMaterial color={PALETTE.ground} roughness={1} />
      </mesh>
      <mesh position={[0, -0.34, 0]}>
        <boxGeometry args={[25.6, 0.16, 21.6]} />
        <meshStandardMaterial color={PALETTE.plateEdge} roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[25.15, 0.02, 21.15]} />
        <meshStandardMaterial color="#2df0b8" emissive="#2df0b8" emissiveIntensity={0.5} />
      </mesh>

      <ZoneFloor
        position={[-6.8, 0, -4.8]}
        scale={[6.8, 0.08, 6.2]}
        color={statusFloor(liveEN12?.status, '#13342d')}
      />
      <ZoneFloor
        position={[6.8, 0, -4.6]}
        scale={[6.8, 0.08, 6.5]}
        color={statusFloor(liveTR08?.status, '#142c34')}
      />
      <ZoneFloor
        position={[0, 0, 5.4]}
        scale={[18, 0.08, 5.9]}
        color={statusFloor(liveWT04?.status, '#123129')}
      />

      {/* Sidewalks */}
      <Road position={[0, 0.035, 0]} scale={[24, 0.06, 2.5]} />
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[24, 0.04, 2.5]} />
        <meshStandardMaterial color={PALETTE.sidewalk} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[2.6, 0.04, 20]} />
        <meshStandardMaterial color={PALETTE.sidewalk} roughness={0.9} />
      </mesh>

      {/* Roads */}
      <Road position={[0, 0.04, 0]} scale={[24, 0.08, 1.7]} />
      <Road position={[0, 0.045, 0]} scale={[1.8, 0.08, 20]} />

      <DashedLine axis="x" length={24} />
      <DashedLine axis="z" length={20} />

      <Crosswalk position={[-1.6, 0, 0]} horizontal={false} />
      <Crosswalk position={[1.6, 0, 0]} horizontal={false} />
      <Crosswalk position={[0, 0, -1.6]} />
      <Crosswalk position={[0, 0, 1.6]} />

      {lamps.map(([x, z], index) => (
        <StreetLamp key={`lamp-${index}`} position={[x, 0.06, z]} />
      ))}

      {/* Residential */}
      {residentialBuildings.map((position, index) => (
        <Building
          key={`res-${index}`}
          position={position}
          scale={[1.55, 1.4 + (index % 2) * 0.35, 1.45]}
        />
      ))}

      {/* Commercial */}
      {commercialBuildings.map((building, index) => (
        <Building
          key={`commercial-${index}`}
          position={[building[0], building[1], building[2]]}
          scale={[building[3], building[4], building[5]]}
          type="commercial"
        />
      ))}

      {/* Zone C */}
      <Building position={[-3.4, 0.8, 5.2]} scale={[2.3, 1.6, 1.7]} />
      <Building position={[0, 0.95, 6.1]} scale={[2.6, 1.9, 1.8]} type="utility" />
      <Building position={[3.5, 0.75, 5.2]} scale={[2.1, 1.5, 1.7]} />

      {/* Trees */}
      {[
        [-10, -1.7], [-8.8, -1.6], [-7.6, -1.6], [-4.8, -1.5],
        [3.2, 2.2], [4.5, 2.2], [6, 2.2], [9.8, 2.3],
        [-9.8, 8.2], [-7.8, 8.2], [9.5, 8.3],
      ].map(([x, z], index) => (
        <Tree key={`tree-${index}`} position={[x, 0.05, z]} />
      ))}

      {/* Zone labels */}
      <ZoneLabel position={[-7, 4.2, -7.4]} title="ZONE A" subtitle="RESIDENTIAL" />
      <ZoneLabel position={[7, 6.5, -7.6]} title="ZONE B" subtitle="COMMERCIAL" />
      <ZoneLabel position={[0, 4.1, 8.6]} title="ZONE C" subtitle="RESIDENTIAL · WATER NETWORK" />

      <SensorMarker
        position={[2.4, 0.1, 4.2]}
        id="WT-04"
        label="WATER PRESSURE"
        value={`${liveWT04?.value ?? 3.2} bar`}
        status={liveWT04?.status ?? 'Normal'}
        onClick={() => onSensorSelect?.('WT-04')}
      />

      {/* Live water + flood layer from /api/v2 (same data as the Water and Flood pages) */}
      <WaterFloodLayer water={water} flood={flood} />

      <Grid
        args={[26, 22]}
        position={[0, -0.005, 0]}
        cellSize={0.5}
        cellThickness={0.2}
        cellColor="#12282a"
        sectionSize={2}
        sectionThickness={0.5}
        sectionColor="#1d5a52"
        fadeDistance={35}
        fadeStrength={1}
        infiniteGrid={false}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enableZoom={false}
        enableRotate
        enablePan
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 1, 0]}
      />

      <OptionalEnvironment>
        <Environment preset="city" />
      </OptionalEnvironment>
    </>
  )
}

function Township3D({
  liveWT03,
  liveWT04,
  liveEN12,
  liveTR08,
  onSensorSelect,
}) {
  const water = usePoll('/water', 5000)
  const flood = usePoll('/flood', 3000)
  const stages = ['NORMAL', 'WASPADA', 'AMARAN', 'BAHAYA']
  const worst = (flood.data?.sensors || []).filter((x) => x.kind === 'level')
    .reduce((w, x) => (stages.indexOf(x.stage) > stages.indexOf(w) ? x.stage : w), 'NORMAL')
  const leaking = (water.data?.zones || []).filter((z) => z.leak_suspected).map((z) => z.zone)
  const rain = flood.data?.sensors?.find((x) => x.kind === 'rain')?.last_value

  return (
    <div className="township-3d-shell">
      {(water.data || flood.data) && (
        <div className="township-3d-live">
          <span className={`t3d-chip ${leaking.length ? 'leak' : 'ok'}`}>Water: {leaking.length ? `leak in ${leaking.join(', ')}` : 'no leaks'}</span>
          <span className={`t3d-chip stage-${worst}`}>Flood: {stageLabel(worst)}</span>
          <span className="t3d-chip">Rain {rain !== undefined ? Number(rain).toFixed(0) : '—'} mm/h</span>
        </div>
      )}
      <div className="township-3d-hud">
        <div>
          <span>SPATIAL DIGITAL TWIN</span>
          <strong>NEXORA Township · Live 3D</strong>
        </div>

        <div className="township-3d-hud-status">
          <span className="township-3d-live-dot" />
          LIVE MODEL
        </div>
      </div>

      <div className="township-3d-help">
        DRAG TO ROTATE · RIGHT-DRAG TO PAN
      </div>

      <Canvas
        shadows
        dpr={[1, 1.7]}
        camera={{ position: [16, 16, 19], fov: 42, near: 0.1, far: 150 }}
      >
        <Suspense fallback={null}>
          <TownshipScene
            liveWT03={liveWT03}
            liveWT04={liveWT04}
            liveEN12={liveEN12}
            liveTR08={liveTR08}
            onSensorSelect={onSensorSelect}
            water={water.data}
            flood={flood.data}
          />
        </Suspense>
      </Canvas>

      <div className="township-3d-legend">
        <span>
          <i className="normal" /> NORMAL
        </span>
        <span>
          <i className="warning" /> WARNING
        </span>
        <span>
          <i className="critical" /> CRITICAL
        </span>
        <span>
          <i className="t3d-leg-leak" /> LEAK
        </span>
        <span>
          <i className="t3d-leg-water" /> WATER LEVEL
        </span>
      </div>
    </div>
  )
}

export default Township3D
