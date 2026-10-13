// "Act early vs. act late" cost model for a flash-flood event. Pure arithmetic — every input is an assumption the
// township must replace with its own claims, call-out and equipment data. Nothing here is a measured saving.
export const FLOOD_DEFAULTS = {
  homes: 16,            // homes exposed to pond / drain overflow (~10 % of Zone C's 159 properties — placeholder)
  damagePerHome: 5000,  // RM average damage per flooded home (placeholder — use council / insurer claims)
  shareEarly: 10,       // % of exposed homes still flooded when the crew is sent at Warning stage
  shareLate: 60,        // % of exposed homes flooded when the crew is sent after the overflow
  crewRmH: 180,         // RM per hour for a 3-person drainage crew + vehicle
  hoursEarly: 2,        // clear the inlet, set barriers
  hoursLate: 8,         // emergency pumping, clean-up, repeat visits
  equipEarly: 300,      // RM barriers / consumables
  equipLate: 2500,      // RM pump hire, sandbags, waste disposal
  eventsYear: 0,        // events per year to include in the business case (0 = not included)
}

export const FLOOD_FIELDS = [
  ['homes', 'Homes exposed to overflow'],
  ['damagePerHome', 'Damage per flooded home (RM)'],
  ['shareEarly', 'Homes flooded if acted on early (%)'],
  ['shareLate', 'Homes flooded if acted on late (%)'],
  ['crewRmH', 'Crew cost (RM/h)'],
  ['hoursEarly', 'Crew hours — early'],
  ['hoursLate', 'Crew hours — late'],
  ['equipEarly', 'Equipment — early (RM)'],
  ['equipLate', 'Equipment — late (RM)'],
  ['eventsYear', 'Events / year to include in ROI'],
]

export function floodCost(f) {
  const side = (hours, equip, share) => {
    const crew = f.crewRmH * hours
    const damage = f.homes * (share / 100) * f.damagePerHome
    return { crew, equip, damage, total: crew + equip + damage }
  }
  const early = side(f.hoursEarly, f.equipEarly, f.shareEarly)
  const late = side(f.hoursLate, f.equipLate, f.shareLate)
  const avoided = late.total - early.total
  return { early, late, avoided, annual: Math.max(0, avoided) * f.eventsYear }
}
