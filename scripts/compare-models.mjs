// Does a fancier matchup model beat the one the app uses yet?
//
//   npm run compare-models                      (imported real games only)
//   npm run compare-models -- path/to/backup.json   (also counts games played in the app)
//
// Every game is predicted from only the games before it, then scored: log loss (lower is better) and
// accuracy. A challenger has to beat the current model by a clear margin, on enough games, before the
// script says to switch. Below MIN_GAMES it just says to keep logging games.
import fs from "node:fs"

const MIN_GAMES = 100 // fewer than this and a flexible model mostly fits noise
const MARGIN = 0.01 // log-loss gain a challenger needs; smaller than this is inside the noise
const SHRINK = 0.7 // same pull toward 50/50 the app applies (src/lib/matchup.ts PREGAME_SHRINK)
const UNKNOWN = 10
const START = 20

const data = JSON.parse(fs.readFileSync(new URL("../src/data/poolean-seasons.json", import.meta.url), "utf8"))
const sigmoid = (z) => 1 / (1 + Math.exp(-z))
const byPlay = (x, y) => x.date.localeCompare(y.date) || (x.created && y.created ? x.created.localeCompare(y.created) : 0) || x.n - y.n
const shrunk = (rec) => (rec ? (rec.w + 2.5) / (rec.gp + 5) - 0.5 : 0)

// Games played in the app after the imported history ends (decided, not live, not stopped early).
function appGamesFrom(file, after) {
  const st = JSON.parse(fs.readFileSync(file, "utf8"))
  const sum = (g, team) =>
    g.scoringEvents?.length || !g.liveScores?.length
      ? g.stats.filter((s) => team.includes(s.playerId)).reduce((t, s) => t + s.pts, 0)
      : g.liveScores.filter((s) => team.includes(s.pid)).reduce((t, s) => t + s.points, 0)
  return st.games
    .filter((g) => !g.liveInProgress && !g.stoppedEarly && g.date > after && g.teamA.length && g.teamB.length)
    .map((g) => ({ date: g.date, a: g.teamA, b: g.teamB, sa: sum(g, g.teamA), sb: sum(g, g.teamB) }))
    .filter((g) => g.sa !== g.sb)
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((g, i) => ({ n: i, date: g.date, a: g.a, b: g.b, w: g.sa > g.sb ? "A" : "B" }))
}

function buildRows(extra) {
  const rows = []
  const together = {}
  const against = {}
  const bump = (m, k, won) => {
    const r = m[k] || (m[k] = { w: 0, gp: 0 })
    r.gp++
    if (won) r.w++
  }
  let prevCards = null
  const seasons = data.list.map((y) => data.seasons[String(y)])
  if (extra.length) seasons.push({ games: extra, rankings: [], cards: prevCardsOf(seasons) })
  for (const season of seasons) {
    const nightPcts = {}
    const rankings = [...season.rankings].sort((x, z) => x.date.localeCompare(z.date))
    let ri = 0
    for (const g of [...season.games].sort(byPlay)) {
      while (ri < rankings.length && rankings[ri].date < g.date) {
        rankings[ri].players.forEach((p) => (nightPcts[p.slug] ||= []).push(p.pct))
        ri++
      }
      const pctOf = (id) => {
        const v = nightPcts[id]
        if (v && v.length) return v.reduce((a, b) => a + b, 0) / v.length
        return prevCards && prevCards[id] ? prevCards[id].powerPct : UNKNOWN
      }
      const avg = (ids) => ids.reduce((s, id) => s + pctOf(id), 0) / ids.length
      const chem = (ids) => {
        let s = 0
        let n = 0
        for (let i = 0; i < ids.length; i++)
          for (let j = i + 1; j < ids.length; j++) {
            s += shrunk(together[[ids[i], ids[j]].sort().join("|")])
            n++
          }
        return n ? s / n : 0
      }
      let h2h = 0
      let n = 0
      g.a.forEach((p) => g.b.forEach((q) => ((h2h += shrunk(against[`${p}|${q}`])), n++)))
      const x = [(avg(g.a) - avg(g.b)) / 10, g.a.length - g.b.length, 10 * (chem(g.a) - chem(g.b) + (n ? h2h / n : 0))]
      const aWon = g.w === "A"
      rows.push({ x, y: aWon ? 1 : 0, g })
      const pairs = (ids) => ids.flatMap((p, i) => ids.slice(i + 1).map((q) => [p, q].sort().join("|")))
      pairs(g.a).forEach((k) => bump(together, k, aWon))
      pairs(g.b).forEach((k) => bump(together, k, !aWon))
      g.a.forEach((p) =>
        g.b.forEach((q) => {
          bump(against, `${p}|${q}`, aWon)
          bump(against, `${q}|${p}`, !aWon)
        }),
      )
    }
    prevCards = season.cards
  }
  return rows
}
const prevCardsOf = (seasons) => seasons[seasons.length - 1].cards

// ---- L2 logistic regression by Newton iterations (no intercept)
function solve(A, b) {
  const n = b.length
  const M = A.map((r, i) => [...r, b[i]])
  for (let i = 0; i < n; i++) {
    let p = i
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r
    ;[M[i], M[p]] = [M[p], M[i]]
    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / M[i][i]
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]
    }
  }
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n]
    for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c]
    x[i] = s / M[i][i]
  }
  return x
}
function fit(X, y, lam) {
  const d = X[0].length
  const w = new Array(d).fill(0)
  for (let it = 0; it < 25; it++) {
    const g = new Array(d).fill(0)
    const H = Array.from({ length: d }, () => new Array(d).fill(0))
    X.forEach((x, i) => {
      const p = sigmoid(x.reduce((s, v, k) => s + v * w[k], 0))
      const e = p - y[i]
      const h = p * (1 - p)
      for (let a = 0; a < d; a++) {
        g[a] += e * x[a]
        for (let b = 0; b < d; b++) H[a][b] += h * x[a] * x[b]
      }
    })
    for (let a = 0; a < d; a++) {
      g[a] += lam[a] * w[a]
      H[a][a] += lam[a] + 1e-9
    }
    const step = solve(H, g)
    for (let a = 0; a < d; a++) w[a] -= step[a]
  }
  return w
}

const extraFile = process.argv[2]
let last = ""
data.list.forEach((y) => data.seasons[String(y)].games.forEach((g) => g.date > last && (last = g.date)))
const extra = extraFile ? appGamesFrom(extraFile, last) : []
const rows = buildRows(extra)

const players = new Set()
rows.forEach((r) => [...r.g.a, ...r.g.b].forEach((p) => players.add(p)))
const P = [...players].sort()
const pidx = Object.fromEntries(P.map((p, i) => [p, i]))
const indicator = (g) => {
  const v = new Array(P.length).fill(0)
  g.a.forEach((p) => (v[pidx[p]] += 1))
  g.b.forEach((p) => (v[pidx[p]] -= 1))
  return v
}
const bt = (l2) => ({
  feats: (r) => [r.x[0], ...indicator(r.g), r.g.a.length - r.g.b.length],
  lam: (d) => [0.05, ...new Array(d - 2).fill(l2), 0.05],
})
const MODELS = {
  "current (power, size, chemistry)": { feats: (r) => r.x, lam: () => [0.05, 0.05, 0.05] },
  "power only": { feats: (r) => [r.x[0]], lam: () => [0.05] },
  "power + per-player ratings (strong)": bt(3),
  "power + per-player ratings (medium)": bt(1),
  "power + per-player ratings (loose)": bt(0.5),
}
const CURRENT = "current (power, size, chemistry)"

function walkForward(model) {
  const out = []
  for (let t = START; t < rows.length; t++) {
    const tr = rows.slice(0, t)
    const w = fit(tr.map(model.feats), tr.map((r) => r.y), model.lam(model.feats(rows[0]).length))
    const p = sigmoid(SHRINK * model.feats(rows[t]).reduce((s, v, k) => s + v * w[k], 0))
    out.push({ p, y: rows[t].y })
  }
  let ok = 0
  let ll = 0
  out.forEach(({ p, y }) => {
    if ((p > 0.5) === (y === 1)) ok++
    const q = Math.min(1 - 1e-6, Math.max(1e-6, p))
    ll += -(y ? Math.log(q) : Math.log(1 - q))
  })
  return { n: out.length, acc: (100 * ok) / out.length, ll: ll / out.length }
}

console.log(`${rows.length} games (${extra.length} from the app), ${P.length} players. Each predicted from earlier games only.`)
console.log(`Coin-flip log loss is ${Math.log(2).toFixed(3)}; lower is better.\n`)
const res = Object.fromEntries(Object.entries(MODELS).map(([k, m]) => [k, walkForward(m)]))
for (const [k, r] of Object.entries(res)) console.log(k.padEnd(40), `log loss ${r.ll.toFixed(3)}   accuracy ${r.acc.toFixed(0)}%${k === CURRENT ? "   <- in the app" : ""}`)

const base = res[CURRENT]
const best = Object.entries(res).filter(([k]) => k !== CURRENT).sort((a, b) => a[1].ll - b[1].ll)[0]
console.log()
if (rows.length < MIN_GAMES) {
  console.log(`Only ${rows.length} games. A flexible model needs about ${MIN_GAMES} before the comparison means anything. Keep logging games (${MIN_GAMES - rows.length} to go).`)
} else if (base.ll - best[1].ll >= MARGIN) {
  console.log(`SWITCH: "${best[0]}" beats the current model by ${(base.ll - best[1].ll).toFixed(3)} log loss. Ask Claude to move the app to it.`)
} else {
  console.log(`KEEP the current model: nothing beats it by ${MARGIN} log loss yet. Run this again after another 25 games.`)
}
