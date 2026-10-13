// Flood stage display names. Internal codes stay as the JPS Malay terms (WASPADA/AMARAN/BAHAYA)
// in the backend; change the English text here to rename them everywhere in the UI.
export const STAGE_LABEL = { NORMAL: 'NORMAL', WASPADA: 'ALERT', AMARAN: 'WARNING', BAHAYA: 'DANGER' }
export const stageLabel = (v) => STAGE_LABEL[v] || v
