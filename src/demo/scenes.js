// The guided demo script. Every step that matters waits for the REAL backend state (`until`); timers only pace the captions.
//
//   lines  – captions shown in order (ms = how long each stays)
//   enter  – what to trigger on the backend when the scene starts (skipped when going back)
//   until  – polled every ~1.5 s; the scene does not finish until it returns true (or the timeout passes)
//   after  – caption shown once `until` is satisfied
import { api } from '../lib/api'

const RANK = { NORMAL: 0, WASPADA: 1, AMARAN: 2, BAHAYA: 3 }
export const SENSOR = 'DL-B1'          // the drain sensor that "breaks" in the demo
export const STORM_MM_H = 120          // strongest rainfall the level model reacts to

const worstStage = (flood) =>
  Math.max(0, ...flood.sensors.filter((s) => s.kind === 'level' && !s.fault).map((s) => RANK[s.stage] || 0))

export const resetWorld = () => api('/sim/reset', { method: 'POST' })

export const SCENES = [
  {
    id: 'living', kicker: 'Scene 1', title: 'The living township', page: 'overview',
    enter: resetWorld,
    lines: [
      { t: 'Township water fails silently.', s: 'Hidden leaks, blocked drains and sensors that die unnoticed. NEXORA watches flow meters, drain and pond levels and a rain gauge through one ingest API — the same call a real ESP32 makes.', ms: 7000 },
      { t: 'Every alert you will see comes from a readable rule.', s: 'No black box. Sensor data is simulated until hardware is installed; the rules, jobs and approvals are real.', ms: 6500 },
    ],
  },
  {
    id: 'fault', kicker: 'Scene 2', title: 'A sensor goes blind', page: 'devices',
    spotlight: `[data-demo="dev-${SENSOR}"]`,
    enter: async () => {
      await api('/sim/rain', { method: 'POST', body: { mm_per_h: STORM_MM_H } })
      await api('/sim/fault', { method: 'POST', body: { device_id: SENSOR, mode: 'stuck' } })
    },
    lines: [
      { t: 'A cloudburst builds over the township.', s: `The rain gauge climbs towards ${STORM_MM_H} mm/h.`, ms: 6000 },
      { t: `At the same moment, drain sensor ${SENSOR} freezes.`, s: 'It keeps sending the same level while the rain pours. NEXORA compares it with the rain gauge and notices.', ms: 6500 },
    ],
    waitNote: 'Confirming the flatline — the rule needs 8 identical readings in a row…',
    until: async () => (await api('/devices')).devices.some((d) => d.device_id === SENSOR && d.fault),
    timeoutMs: 90000,
    after: { t: 'Sensor fault confirmed — its readings are no longer trusted.', s: 'A maintenance job for IoT Maintenance 05 was opened automatically. Faulty data can never trigger a false flood alarm.', ms: 6500 },
  },
  {
    id: 'flood', kicker: 'Scene 3', title: 'The flood is still caught', page: 'flood',
    spotlight: '[data-demo="flood-DL-C1"]',
    lines: [
      { t: 'The remaining sensors still see the water rise.', s: 'Drain and pond levels follow the JPS stages: Normal → Alert → Warning → Danger, with hysteresis so alerts do not flicker.', ms: 7000 },
    ],
    waitNote: 'Waiting for the pond to reach Warning stage…',
    until: async () => worstStage(await api('/flood')) >= RANK.AMARAN,
    timeoutMs: 180000,
    after: { t: 'Warning stage reached.', s: 'Residents of the zone received the alert, and a dispatch job was raised — waiting for a person, not sent automatically.', ms: 6500 },
  },
  {
    id: 'twin', kicker: 'Scene 4', title: 'The same event, in 3D', page: 'digitalTwin', scroll: '.township-3d-shell',
    lines: [
      { t: 'The Digital Twin shows the live state.', s: 'Rain falls over the model, the pond and drains fill to the real sensor level — and the broken sensor is shown grey as SENSOR FAULT.', ms: 7500 },
      { t: 'Colour follows the flood stage; the model is driven by the same data as every other screen.', s: 'Nothing here is a separate animation.', ms: 5500 },
    ],
  },
  {
    id: 'graph', kicker: 'Scene 5', title: 'Everything is connected', page: 'intelligenceGraph',
    lines: [
      { t: 'The Intelligence Graph links cause and effect.', s: 'Sensor → alert → job → team → residents. The frozen sensor, the flood alert and the open jobs sit on one graph.', ms: 7500 },
      { t: 'Red nodes need attention — click one to follow its chain.', s: 'Built from live data every few seconds.', ms: 5500 },
    ],
  },
  {
    id: 'approve', kicker: 'Scene 6', title: 'A human decides', page: 'workOrders', focusApproval: true,
    spotlight: ['[data-demo="approve-btn"]', '[data-demo="approval-panel"]'],
    lines: [
      { t: 'NEXORA recommends. A person authorises.', s: 'The job shows the recommended team, why, the safety notes and the SLA. No crew is dispatched until you approve.', ms: 7000 },
    ],
    waitNote: 'Waiting for you to press “Approve dispatch”…',
    until: async () => {
      const jobs = await api('/work-orders?open_only=true')
      return jobs.some((w) => w.category === 'flood' && w.source === 'sensor' && w.approved_at)
    },
    timeoutMs: 0,
    after: { t: 'Approved — the crew is assigned.', s: 'The approval is recorded in the job timeline with your name and the time.', ms: 5500 },
  },
  {
    id: 'cost', kicker: 'Scene 7', title: 'What acting early is worth', page: 'roi',
    spotlight: '[data-demo="cost-compare"]',
    lines: [
      { t: 'Acting at Warning stage versus after the overflow.', s: 'Crew time, equipment and property damage — with the formula written out underneath.', ms: 7500 },
      { t: 'These are scenario inputs, not verified savings.', s: 'Replace each assumption with the township’s own claims and call-out data; the figures update instantly.', ms: 7000 },
    ],
  },
  {
    id: 'report', kicker: 'Scene 8', title: 'Evidence for climate adaptation', page: 'reports',
    lines: [
      { t: 'Every event feeds a climate-resilience report.', s: 'Flood exposure, approval time, sensor availability and recoverable water — printable for the township office.', ms: 7000 },
    ],
  },
  {
    id: 'close', kicker: 'Scene 9', title: 'From detection to decision', page: 'overview',
    lines: [
      { t: 'A frozen sensor, a flood alert and an approved dispatch — one chain.', s: 'Right now: the crew is assigned and the work is under way. NEXORA does not claim it is resolved until a crew says so.', ms: 7500 },
      { t: 'NEXORA — From Detection to Decision.', s: '', ms: 5000 },
    ],
  },
]
