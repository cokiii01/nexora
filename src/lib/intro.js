export const INTRO_KEY = 'nexora-intro-seen'

export function shouldShowIntro() {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
    return sessionStorage.getItem(INTRO_KEY) !== '1'
  } catch {
    return true
  }
}
