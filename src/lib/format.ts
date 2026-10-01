// Same as app.js's formatDateDisplay(): "2026-07-05" -> "Sun, Jul 5"; anything that isn't a plain
// ISO date (legacy text dates) is shown as-is.
export function formatDateDisplay(dateStr: string | undefined): string {
  if (!dateStr) return "No date"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export function uid(prefix: string): string {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
