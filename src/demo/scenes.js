// The guided demo = the 5-minute video. Every step that matters waits for the REAL backend state (`until`); timers only pace the captions.
//
//   lines  – captions shown in order. `vo` is the voice-over you read aloud; the time a line stays on screen is
//            worked out from the length of its `vo` (about 2.2 words a second), so the film and the script stay in step.
//   enter  – what to trigger on the backend when the scene starts (skipped when going back)
//   until  – polled every ~1.5 s; the scene does not finish until it returns true (or the timeout passes)
//   after  – line shown once `until` is satisfied
//   card   – 'intro' | 'outro': a full-screen title card instead of the caption bar
//   zoom   – selector to gently zoom into while the scene plays
//   cue    – note for the presenter window (e.g. "press Approve now")
import { api } from '../lib/api'

const RANK = { NORMAL: 0, WASPADA: 1, AMARAN: 2, BAHAYA: 3 }
export const SENSOR = 'DL-B1'          // the drain sensor that "breaks" in the demo
export const STORM_MM_H = 120          // strongest rainfall the level model reacts to
export const LIVE_URL = 'nexora-phi-inky.vercel.app'

const worstStage = (flood) =>
  Math.max(0, ...flood.sensors.filter((s) => s.kind === 'level' && !s.fault).map((s) => RANK[s.stage] || 0))

export const resetWorld = () => api('/sim/reset', { method: 'POST' })

// voice-over → on-screen time (words ÷ 2.2 per second, plus a short breath)
export const voMs = (vo, min = 3500) => Math.max(min, Math.round((vo.trim().split(/\s+/).length / 2.2) * 1000) + 700)
const L = (t, s, vo, min) => ({ t, s, vo, ms: voMs(vo, min) })

export const SCENES = [
  {
    id: 'intro', kicker: 'Opening', title: 'NEXORA', page: 'overview', card: 'intro',
    enter: resetWorld,
    lines: [{ t: 'NEXORA', s: 'Township water fails silently.', vo: 'Township water fails silently.', ms: 6500 }],
  },
  {
    id: 'living', kicker: 'Scene 1', title: 'The living township', page: 'overview',
    lines: [
      L('Township water fails silently.', 'Leaks nobody sees. Drains nobody checks. Sensors nobody trusts.',
        'A leak can run for days, because at three in the morning nobody is using water, so nobody notices. A drain blocks, and the first sign is a flooded road. And when a sensor freezes, it either lies, or stays silent.'),
      L('NEXORA watches the whole township.', '3 zones · flow meters · drain and pond levels · a rain gauge',
        'This is NEXORA, watching one township: three zones, flow meters, drain and pond levels, and a rain gauge. One system, one screen.'),
      L('A hidden leak, found at 3 am.', 'Zone C: night flow never drops.',
        'Already, it has found something. In Zone C the water never drops at night. That is a hidden leak, about nineteen cubic metres a day, caught without a single resident calling in.'),
      L('Every alert comes from a readable rule.', 'Sensor data is simulated until hardware is installed. Rules, jobs and approvals are real.',
        'One honest note. The sensor data here is simulated until hardware is installed. But the rules, the jobs, and the approvals you are about to see are real.'),
    ],
  },
  {
    id: 'fault', kicker: 'Scene 2', title: 'A sensor goes blind', page: 'devices',
    spotlight: `[data-demo="dev-${SENSOR}"]`, zoom: `[data-demo="dev-${SENSOR}"]`,
    enter: async () => {
      await api('/sim/rain', { method: 'POST', body: { mm_per_h: STORM_MM_H } })
      await api('/sim/fault', { method: 'POST', body: { device_id: SENSOR, mode: 'stuck' } })
    },
    lines: [
      L('A cloudburst builds.', `The rain gauge climbs towards ${STORM_MM_H} mm/h.`,
        'Now a storm builds over the township. The rain gauge climbs fast.'),
      L(`Drain sensor ${SENSOR} freezes.`, 'The same level, again and again, while the rain pours.',
        'At the same moment, a drain sensor in Zone B freezes. It keeps reporting the same level while the rain pours. A normal system would believe it.'),
      L('NEXORA checks it against the rain gauge.', 'Eight identical readings in heavy rain is not a calm drain.',
        'NEXORA does not. It checks the sensor against the rain gauge. Eight identical readings during heavy rain? That is not a calm drain. That is a broken sensor.'),
    ],
    waitNote: 'Confirming the flatline — the rule needs 8 identical readings in a row…',
    until: async () => (await api('/devices')).devices.some((d) => d.device_id === SENSOR && d.fault),
    timeoutMs: 90000,
    after: L('Sensor marked faulty. A repair job opens by itself.', 'A broken sensor can never raise a false alarm, or hide a real one.',
      'The sensor is marked as not trusted, and a repair job opens automatically. A broken sensor can never cause a false alarm, and it can never hide a real flood.'),
  },
  {
    id: 'flood', kicker: 'Scene 3', title: 'The flood is still caught', page: 'flood',
    spotlight: '[data-demo="flood-DL-C1"]',
    lines: [
      L('The other sensors still see the water rise.', 'Normal → Alert → Warning → Danger',
        'The other sensors are still working, and they see the water rising. Levels move through Normal, Alert, Warning and Danger, with a buffer so alerts do not flicker.'),
    ],
    waitNote: 'Waiting for the pond to reach Warning stage…',
    until: async () => worstStage(await api('/flood')) >= RANK.AMARAN,
    timeoutMs: 180000,
    after: L('Warning stage. Residents alerted.', 'A dispatch job is waiting for a person.',
      'The pond reaches Warning. Residents in that zone are alerted, and a dispatch job is raised. But it is not sent automatically. It is waiting for a person.'),
  },
  {
    id: 'twin', kicker: 'Scene 4', title: 'Digital Twin — the township in 3D', page: 'digitalTwin', scroll: '.township-3d-shell',
    lines: [
      L('The same event, in 3D.', 'The pond fills to the real sensor level.',
        'Now the same event, in the digital twin. This is the township in 3D, driven by the live data. Watch the retention pond: it fills to the real sensor level.'),
      L('The faulty sensor shows grey.', 'Trusted sensors stay lit. A frozen one is not trusted.',
        'See the grey sensor in Zone B? That is the one that froze. Trusted sensors stay lit, and the broken one is clearly shown as not trusted.'),
      L('Rain, drains and the pond, together.', 'Operators see where water is heading, not just a number.',
        'An operator can see where the water is heading, and which zones are exposed, instead of reading a table of numbers.'),
      L('One source of truth.', 'Nothing here is a separate animation.',
        'Nothing here is a separate animation. Every screen, including this one, runs on the same data.'),
    ],
  },
  {
    id: 'graph', kicker: 'Scene 5', title: 'Intelligence Graph — cause and effect', page: 'intelligenceGraph',
    lines: [
      L('Everything is connected.', 'Sensor → alert → job → team → residents',
        'Next, the Intelligence Graph. It links every part of the story: the frozen sensor, the flood alert, the open jobs, the crew, and the residents in that zone.'),
      L('Follow the chain from cause to action.', 'Click any node to see what it affects.',
        'You can follow the chain from cause to action, and see exactly why a job exists. Nothing is a black box.'),
      L('Now the decision.', 'The system has done its part. A person is next.',
        'The system has done its part: detected, explained, and prepared. Now it needs a person to decide.'),
    ],
  },
  {
    id: 'approve', kicker: 'Scene 6', title: 'A human decides', page: 'workOrders', focusApproval: true,
    spotlight: ['[data-demo="approve-btn"]', '[data-demo="approval-panel"]'],
    lines: [
      L('NEXORA recommends. A person authorises.', 'Team, reason, safety notes and the SLA clock.',
        'Now the decision. NEXORA recommends a team, explains why, and shows the safety notes and the SLA clock. But nothing is sent until a person approves.'),
    ],
    waitNote: 'Press “Approve dispatch” now.',
    cue: 'CLICK “Approve dispatch” now',
    until: async () => {
      const jobs = await api('/work-orders?open_only=true')
      return jobs.some((w) => w.category === 'flood' && w.source === 'sensor' && w.approved_at)
    },
    timeoutMs: 0,
    after: L('Approved. The crew is assigned.', 'Recorded with a name and the time.',
      'I press approve. The crew is assigned, and the decision is recorded with my name and the time. The system itself refuses to dispatch without it.'),
  },
  {
    id: 'cost', kicker: 'Scene 7', title: 'What acting early is worth', page: 'roi',
    spotlight: '[data-demo="cost-compare"]', zoom: '[data-demo="cost-compare"]',
    lines: [
      L('What is acting early worth?', 'Crew, equipment and property damage, with the formula shown.',
        'What is acting early worth? Crew time, equipment, and property damage, with the formula written out, for acting at Warning stage versus after the overflow.'),
      L('Scenario inputs, not verified savings.', 'Replace with the township’s own data.',
        'These are scenario inputs, not verified savings. A township replaces each assumption with its own claims data, and the numbers update instantly.'),
    ],
  },
  {
    id: 'report', kicker: 'Scene 8', title: 'Evidence for climate adaptation', page: 'reports',
    lines: [
      L('Every event becomes evidence.', 'Flood exposure · approval time · sensor availability · recoverable water',
        'Every event feeds a climate-resilience report: flood exposure, how fast a person approved, sensor availability, and water recovered. Evidence a township can show its residents and its owners.'),
    ],
  },
  {
    id: 'close', kicker: 'Scene 9', title: 'From detection to decision', page: 'overview',
    lines: [
      L('A frozen sensor, a flood alert, an approved dispatch.', 'One chain. Nothing is called resolved until a crew says so.',
        'A frozen sensor, a flood alert, and an approved dispatch: one chain. And NEXORA does not claim anything is resolved until a crew says so.'),
    ],
  },
  {
    id: 'outro', kicker: 'Closing', title: 'NEXORA', page: 'overview', card: 'outro',
    lines: [{ t: 'NEXORA', s: 'From detection to decision.', vo: 'NEXORA. From detection to decision. Thank you.', ms: 7500 }],
  },
]
