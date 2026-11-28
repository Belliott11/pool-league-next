// Game nights in people's calendars: opening night and every night the editor has set up (state.rsvps), as an iCalendar file. One night's
// file comes from "Add to calendar" (made in the browser), and the whole list is nights.ics, written by every build (the nightsFeed plugin
// in vite.config.ts) so a phone that subscribed picks up new nights by itself. No imports: vite.config.ts uses this file too.
//
// Times are written as the league's local time with its time zone named (America/New_York), so they show right on any phone. No address:
// where the league plays is not put on a public page.

export interface Night {
  date: string // YYYY-MM-DD
  time?: string // HH:MM, 24-hour, local
  title: string
}

type Data = { openingNight?: { date: string; time?: string } | null; rsvps?: { date: string; time?: string }[] }

const SITE = "https://intel.poolean.net/"
const TZ = "America/New_York"
const HOURS = 3 // how long a night runs in the calendar

// Upcoming game nights (today on), earliest first, one per date.
export function gameNights(data: Data, today: string): Night[] {
  const out = new Map<string, Night>()
  const o = data.openingNight
  if (o?.date && o.date >= today) out.set(o.date, { date: o.date, time: o.time, title: "Pool basketball: opening night" })
  for (const r of data.rsvps ?? []) if (r.date >= today && !out.has(r.date)) out.set(r.date, { date: r.date, time: r.time, title: "Pool basketball" })
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date))
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
const compact = (date: string) => date.replace(/-/g, "")
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")

function event(n: Night, now: Date): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${n.date}@intel.poolean.net`, `DTSTAMP:${stamp(now)}`, `SUMMARY:${esc(n.title)}`]
  if (n.time && /^\d\d:\d\d$/.test(n.time)) {
    const [h, m] = n.time.split(":").map(Number)
    const endH = h + HOURS
    const end = endH < 24 ? `${compact(n.date)}T${String(endH).padStart(2, "0")}${String(m).padStart(2, "0")}00` : `${compact(n.date)}T235900`
    lines.push(`DTSTART;TZID=${TZ}:${compact(n.date)}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`, `DTEND;TZID=${TZ}:${end}`)
  } else {
    const next = new Date(`${n.date}T12:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    lines.push(`DTSTART;VALUE=DATE:${compact(n.date)}`, `DTEND;VALUE=DATE:${compact(next.toISOString().slice(0, 10))}`)
  }
  lines.push(`DESCRIPTION:${esc(`Who is coming, the night preview and live scores: ${SITE}`)}`, `URL:${SITE}`)
  // A reminder the afternoon before: about 21 hours before an evening start, or 9 AM the day before an all-day night.
  lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`${n.title} tomorrow`)}`, n.time ? "TRIGGER:-PT21H" : "TRIGGER:-PT15H", "END:VALARM", "END:VEVENT")
  return lines
}

export function icsFor(nights: Night[], now = new Date()): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Poolean Intel//Game nights//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Poolean game nights",
    `X-WR-TIMEZONE:${TZ}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    // The league's time zone spelled out, as the standard asks for any TZID used (US Eastern, daylight time from the second Sunday of
    // March to the first Sunday of November).
    "BEGIN:VTIMEZONE",
    `TZID:${TZ}`,
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...nights.flatMap((n) => event(n, now)),
    "END:VCALENDAR",
    "",
  ].join("\r\n")
}

export const FEED_PATH = "nights.ics"
export const feedUrl = () => `webcal://${SITE.replace(/^https?:\/\//, "")}${FEED_PATH}`
