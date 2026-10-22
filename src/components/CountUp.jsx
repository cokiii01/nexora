import { useEffect, useRef, useState } from 'react'

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Animated number that ticks up from 0 (or from its previous value) to `value`.
export default function CountUp({ value, decimals = 0, duration = 1100, delay = 0, prefix = '', suffix = '', separator = true }) {
  const target = Number(value) || 0
  const [shown, setShown] = useState(reduceMotion() ? target : 0)
  const fromRef = useRef(reduceMotion() ? target : 0)

  useEffect(() => {
    let raf = 0
    if (reduceMotion()) {
      fromRef.current = target
      raf = requestAnimationFrame(() => setShown(target))
      return () => cancelAnimationFrame(raf)
    }
    let start = 0
    const from = fromRef.current
    const tick = (t) => {
      if (!start) start = t
      const p = Math.min(1, (t - start - delay) / duration)
      if (p < 0) { raf = requestAnimationFrame(tick); return }
      const eased = 1 - Math.pow(1 - p, 3)
      const next = from + (target - from) * eased
      setShown(next)
      fromRef.current = next
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, delay])

  const text = shown.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: separator,
  })
  return <>{prefix}{text}{suffix}</>
}
