// A step of 1, 2, 2.5 or 5 times a power of ten, giving about `count` equal cells over `span`.
function niceStep(span: number, count = 5) {
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const f = raw / mag
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag
}

// Axis ends snapped to whole steps, so every grid cell is exactly the same size.
export function axis(min: number, max: number, count = 5) {
  const step = niceStep(Math.max(max - min, 1e-6), count)
  const lo = Math.floor(min / step) * step
  const hi = Math.max(Math.ceil(max / step) * step, lo + step)
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return { lo, hi, ticks }
}
