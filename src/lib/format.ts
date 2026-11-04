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

// "2027-06-01" -> "Tue, Jun 1, 2027": for dates far enough ahead that the year matters.
export function formatDateLong(dateStr: string | undefined): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return formatDateDisplay(dateStr)
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

// A sorted list of numbers as text with 1 decimal, except that two neighbours which would show the same text get an
// extra decimal, so a ranking never shows 4.4 above 4.4 with nothing to explain the order.
export function distinctNumbers(values: number[], decimals = 1): string[] {
  const text = values.map((v) => v.toFixed(decimals))
  return values.map((v, i) => {
    const clash = (j: number) => j >= 0 && j < values.length && text[j] === text[i] && values[j] !== v
    return clash(i - 1) || clash(i + 1) ? v.toFixed(decimals + 1) : text[i]
  })
}

export function uid(prefix: string): string {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// "19:00" -> "7:00 PM"; anything that isn't HH:MM comes back as given.
export function formatTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return t
  const h = +m[1]
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`
}
