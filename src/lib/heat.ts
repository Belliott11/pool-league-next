// Tints a heat-map cell against an average: aqua when `value` is above `mean`, crimson below.
// A bigger gap (scaled by `spread`) and more attempts (up to `volumeFull`) make it stronger.
export function heatFill(value: number, mean: number, spread: number, volume: number, volumeFull: number) {
  const d = value - mean
  const strength = Math.min(1, Math.abs(d) / spread)
  const sure = Math.min(1, volume / volumeFull)
  const pct = Math.round(18 + 62 * strength * (0.45 + 0.55 * sure))
  return `color-mix(in oklab, var(${d >= 0 ? "--pos" : "--neg"}) ${pct}%, transparent)`
}
