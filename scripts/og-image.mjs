// The picture a group chat shows for a link to the site (og:image), made from the current league data at build time: before opening night,
// the countdown and the season's best records; during the season, the standings. The build runs daily (deploy.yml), so the countdown
// moves. Fonts are fixed-weight copies of the site's own (scripts/og-fonts, OFL), since the renderer cannot pick weights in variable fonts.
import { Resvg } from "@resvg/resvg-js"
import path from "node:path"

const FONTS = ["Anybody-Display.ttf", "HankenGrotesk-Regular.ttf", "HankenGrotesk-Bold.ttf"].map((f) => path.resolve(import.meta.dirname, "og-fonts", f))
const C = { bg: "#060a14", card: "#0e1424", text: "#f4f6fb", muted: "#8f9bb5", accent: "#6aa6ff", gold: "#f2c94c", teamB: "#ff6b78" }
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// Today in Cherry Hill, as YYYY-MM-DD.
export const cherryHillDate = (now) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
// A Cherry Hill date and time ("2027-06-01", "16:00") as a moment, daylight saving included.
function cherryHillMs(date, time = "00:00") {
  const [Y, M, D] = date.split("-").map(Number)
  const [h, m] = time.split(":").map(Number)
  const want = Date.UTC(Y, M - 1, D, h, m)
  let ms = want
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
    ms += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  }
  return ms
}
// Whole days until opening night starts, counted as the site's countdown does (src/lib/weather.ts, countdownTo): it drops by one each day
// at the start time, and deploy.yml rebuilds just after that, so the picture and the site show the same number.
const daysUntil = (date, time, now) => Math.floor((cherryHillMs(date, time) - now.getTime()) / 86_400_000)
const longDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" })
const clock = (t) => {
  const [h, m] = t.split(":").map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}

// Each player's wins and losses in the current season's decided games, best first (most wins, then the better record).
export function standings(state) {
  const since = state.currentSeasonStartedAt || ""
  const rec = new Map()
  for (const g of state.games ?? []) {
    if (g.liveInProgress || (g.date || "") < since || (g.winner !== "A" && g.winner !== "B")) continue
    for (const [team, side] of [[g.teamA, "A"], [g.teamB, "B"]])
      for (const id of team) {
        const r = rec.get(id) ?? { id, w: 0, l: 0 }
        g.winner === side ? r.w++ : r.l++
        rec.set(id, r)
      }
  }
  const name = (id) => state.players?.find((p) => p.id === id)?.name ?? id
  return [...rec.values()].sort((a, b) => b.w - a.w || a.l - b.l).map((r) => ({ ...r, name: name(r.id) }))
}

// What the picture says, as plain data (tested in og-image.test.ts).
export function ogContent(state, now = new Date()) {
  const today = cherryHillDate(now)
  const open = state.openingNight?.date
  const table = standings(state).slice(0, 3)
  if (open && open >= today) {
    const n = open === today ? 0 : Math.max(1, daysUntil(open, state.openingNight.time, now))
    return {
      kicker: "Opening night",
      headline: n === 0 ? "Tonight" : `In ${n} day${n === 1 ? "" : "s"}`,
      sub: `${longDate(open)}${state.openingNight.time ? `, ${clock(state.openingNight.time)}` : ""}`,
      tableTitle: table.length ? "Last season's best records" : "",
      table,
    }
  }
  return { kicker: "Standings", headline: table[0] ? `${table[0].name} leads` : "The season is on", sub: table[0] ? `${table[0].w}-${table[0].l} so far` : "", tableTitle: table.length ? "Top of the table" : "", table }
}

// The headline as large as fits beside the records card (Anybody Display runs about 0.72 of its size per character).
const headlineSize = (text, width) => Math.round(Math.min(84, width / (Math.max(1, text.length) * 0.72)))

export function ogSvg(c) {
  // The header's lane rope: alternating team colors.
  const rope = Array.from({ length: 30 }, (_, i) => `<rect x="${80 + i * 35}" y="148" width="28" height="6" rx="3" fill="${i % 2 ? C.teamB : C.accent}" opacity="0.85"/>`).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${C.bg}"/>
<text x="80" y="118" font-family="Anybody Display" font-size="56" fill="${C.text}">POOLEAN <tspan fill="${C.accent}">INTEL</tspan></text>
${rope}
<text x="80" y="226" font-family="Hanken Grotesk" font-weight="700" font-size="30" fill="${C.accent}" letter-spacing="3">${esc(c.kicker.toUpperCase())}</text>
<text x="80" y="306" font-family="Anybody Display" font-size="${headlineSize(c.headline, c.tableTitle ? 520 : 1040)}" fill="${C.text}">${esc(c.headline)}</text>
<text x="80" y="356" font-family="Hanken Grotesk" font-size="34" fill="${C.muted}">${esc(c.sub)}</text>
${c.tableTitle ? `<rect x="640" y="200" width="480" height="${120 + c.table.length * 58}" rx="24" fill="${C.card}"/>` : ""}
${c.tableTitle ? `<text x="680" y="252" font-family="Hanken Grotesk" font-weight="700" font-size="26" fill="${C.gold}">${esc(c.tableTitle)}</text>` : ""}
${c.table
  .map((r, i) => {
    const y = 310 + i * 58
    return `<text x="680" y="${y}" font-family="Anybody Display" font-size="34" fill="${C.muted}">${i + 1}</text>
<text x="730" y="${y}" font-family="Hanken Grotesk" font-weight="700" font-size="34" fill="${C.text}">${esc(r.name)}</text>
<text x="1080" y="${y}" font-family="Anybody Display" font-size="34" fill="${C.text}" text-anchor="end">${r.w}-${r.l}</text>`
  })
  .join("\n")}
<text x="80" y="570" font-family="Hanken Grotesk" font-size="28" fill="${C.muted}">Stats, standings and highlights for the backyard pool league</text>
</svg>`
}

export function renderOg(state, now = new Date()) {
  const svg = ogSvg(ogContent(state, now))
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Hanken Grotesk" } }).render().asPng()
}
