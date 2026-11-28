import { useMemo, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BasketStrip, runLine, runVerdict } from "@/components/RunCheck"
import { backtestPick } from "@/lib/matchup"
import { liveTargetOf, PREGAME_WEIGHT_LIVE, winProbabilityFrom } from "@/lib/live"
import { gameOver } from "@/lib/race"
import { basketsOf, leagueMomentum, oneIn, type Basket } from "@/lib/momentum"
import { formatDateDisplay, signed } from "@/lib/format"
import { playerName } from "@/lib/players"
import { PER, gamePace } from "@/lib/per"
import { insideFences, OUTLIER_MIN_GAMES } from "@/lib/filters"
import { defensiveRating, gameDefenseStats, gameTotalPoints, getGameStats, isQualifyingGame, offensiveRating, shootingStats } from "@/lib/stats"
import { TEAM } from "@/lib/teamColors"
import { cn } from "@/lib/utils"
import { leagueValues, pointsAdded, shotEnd } from "@/lib/epa"
import { CREDIT, games as insightGames } from "@/lib/insight"
import { PlayValues, signed as signed2 } from "@/components/PointsAdded"
import { RuleHistory } from "@/components/RuleChanges"
import type { Game, PooleanState } from "@/lib/types"

// "How the numbers work": each model explained on a real moment from the league, so the method can be checked against something
// everyone remembers. Everything is worked out live from the same functions the rest of the site uses; nothing here is hand-written
// data, so it can never drift from the numbers on the other pages.

const pct = (p: number) => `${Math.round(p * 100)}%`

function Section({ id, title, intro, children }: { id: string; title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="font-display text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">{children}</CardContent>
    </Card>
  )
}

// ---------- Live odds ----------

interface Step {
  basket: Basket
  index: number
  before: [number, number]
  pBefore: number
  pWith: number
  pInstead: number // if the other team had scored the same basket instead
  ends: boolean
}

interface Walk {
  game: Game
  target: number
  pre: number | null
  start: number
  steps: Step[]
}

function walkOf(game: Game): Walk {
  const target = liveTargetOf(game)
  const pre = backtestPick(game) ?? null
  let a = 0, b = 0, nA = 0, nB = 0
  const steps: Step[] = []
  basketsOf(game).forEach((k, index) => {
    const pBefore = winProbabilityFrom(a, b, target, pre, nA, nB)
    const withA = k.side === "A"
    const pWith = withA ? winProbabilityFrom(a + k.points, b, target, pre, nA + 1, nB) : winProbabilityFrom(a, b + k.points, target, pre, nA, nB + 1)
    const pInstead = withA ? winProbabilityFrom(a, b + k.points, target, pre, nA, nB + 1) : winProbabilityFrom(a + k.points, b, target, pre, nA + 1, nB)
    steps.push({ basket: k, index, before: [a, b], pBefore, pWith, pInstead, ends: gameOver(k.a, k.b, target) })
    if (withA) (a += k.points), nA++
    else (b += k.points), nB++
  })
  return { game, target, pre, start: winProbabilityFrom(0, 0, target, pre), steps }
}

function OddsChart({ walk, at }: { walk: Walk; at: number }) {
  const pts = [walk.start, ...walk.steps.map((s) => s.pWith)]
  const W = 320, H = 110, pad = 6
  const x = (i: number) => pad + (i * (W - 2 * pad)) / Math.max(1, pts.length - 1)
  const y = (p: number) => pad + (1 - p) * (H - 2 * pad)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" role="img" aria-label={`Team A's win chance after each basket, from ${pct(walk.start)} at the start. Basket ${at + 1} is marked.`}>
      <line x1={pad} x2={W - pad} y1={y(0.5)} y2={y(0.5)} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />
      <text x={W - pad} y={y(0.5) - 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.7">50%</text>
      <polyline points={pts.map((p, i) => `${x(i)},${y(p)}`).join(" ")} fill="none" stroke="var(--color-team-a)" strokeWidth="2" strokeLinejoin="round" />
      <line x1={x(at)} x2={x(at + 1)} y1={y(pts[at])} y2={y(pts[at + 1])} stroke="currentColor" strokeWidth="3" />
      <circle cx={x(at + 1)} cy={y(pts[at + 1])} r="4" fill="currentColor" />
    </svg>
  )
}

function Tile({ label, score, p, note, strong }: { label: string; score: string; p: number; note?: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", strong && "border-foreground")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold">{pct(p)}</div>
      <div className="text-xs text-muted-foreground">
        Team A, at {score}
        {note ? `. ${note}` : ""}
      </div>
    </div>
  )
}

function LiveOdds({ state }: { state: PooleanState }) {
  const games = useMemo(
    () => state.games.filter((g) => !g.liveInProgress && (g.winner === "A" || g.winner === "B") && basketsOf(g).length >= 6).sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [state.games],
  )
  // Start on the basket that moved the odds most in any game, leaving out the ones that end a game.
  const first = useMemo(() => {
    let best = { g: 0, i: 0, move: -1 }
    games.forEach((g, gi) =>
      walkOf(g).steps.forEach((s) => {
        const move = Math.abs(s.pWith - s.pBefore)
        if (!s.ends && move > best.move) best = { g: gi, i: s.index, move }
      }),
    )
    return best
  }, [games])
  const [gi, setGi] = useState(first.g)
  const [at, setAt] = useState(first.i)
  const walk = useMemo(() => (games[gi] ? walkOf(games[gi]) : null), [games, gi])
  if (!walk || !walk.steps.length) return <p className="text-muted-foreground">This fills in once a game has been filmed and logged.</p>
  const s = walk.steps[Math.min(at, walk.steps.length - 1)]
  const other = s.basket.side === "A" ? "B" : "A"
  const after = `${s.basket.a}-${s.basket.b}`
  const instead = s.basket.side === "A" ? `${s.before[0]}-${s.before[1] + s.basket.points}` : `${s.before[0] + s.basket.points}-${s.before[1]}`
  const forScorer = (p: number) => (s.basket.side === "A" ? p : 1 - p)
  const worth = (forScorer(s.pWith) - forScorer(s.pBefore)) * 100
  const swing = Math.abs(s.pWith - s.pInstead) * 100
  const names = (ids: string[]) => ids.map((id) => playerName(state, id)).join(", ")
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
          <span className="text-muted-foreground">Game</span>
          <select
            className="min-w-0 flex-1 truncate rounded-md border bg-background px-2 py-1"
            value={gi}
            onChange={(e) => {
              setGi(Number(e.target.value))
              setAt(0)
            }}
          >
            {games.map((x, i) => (
              <option key={x.id} value={i}>
                {formatDateDisplay(x.date)}: {names(x.teamA)} vs {names(x.teamB)}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="outline" aria-label="Previous basket" disabled={at === 0} onClick={() => setAt(at - 1)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-28 text-center tabular-nums">
            Basket {s.index + 1} of {walk.steps.length}
          </span>
          <Button size="icon" variant="outline" aria-label="Next basket" disabled={at >= walk.steps.length - 1} onClick={() => setAt(at + 1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <p>
        <span className={cn("font-semibold", TEAM[s.basket.side].text)}>{playerName(state, s.basket.scorerId)}</span> scores {s.basket.points} for Team {s.basket.side}, at{" "}
        {s.before[0]}-{s.before[1]}. First to {walk.target}, win by 2.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Tile label="Before the basket" score={`${s.before[0]}-${s.before[1]}`} p={s.pBefore} />
        <Tile label="With the basket" score={after} p={s.pWith} strong />
        <Tile label={`If Team ${other} had scored it`} score={instead} p={s.pInstead} />
      </div>
      <p>
        So the basket was worth <span className="font-semibold">{signed(worth, 0)} points</span> of win chance to Team {s.basket.side}, and the gap between it going in for
        them and the same basket going the other way was {swing.toFixed(0)} points.{" "}
        {s.ends ? "It ended the game." : worth >= 10 ? "That is a big one: late in a close game, every basket is." : "Early or lopsided, a basket moves the odds less."}
      </p>
      <OddsChart walk={walk} at={s.index} />
      <div>
        <div className="mb-1 font-semibold">What goes into it</div>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            The pre-game read for this game, made from only the nights before it:{" "}
            {walk.pre === null ? "none (a player had no history yet), so the odds start at 50/50." : `Team A ${pct(walk.pre)}. It uses power rankings, an extra player on one side, and how these players have done together and against each other.`}
          </li>
          {walk.pre !== null && (
            <li>
              The live odds take {Math.round(PREGAME_WEIGHT_LIVE * 100)}% of that read's lean, so they start at {pct(walk.start)}. Checked on every result on record, the full read was too sure.
            </li>
          )}
          <li>The read counts as 20 baskets of evidence. Each basket after that shifts how often each team is expected to score, so a team that keeps scoring is believed more.</li>
          <li>Baskets are worth 1, 2 or 3 in the league's usual mix (mostly 2s, about 1 in 6 a three). From any score, the chance is worked out exactly for the race to {walk.target}, win by 2.</li>
        </ul>
      </div>
    </>
  )
}

// ---------- Runs ----------

function Runs({ state, onOpenGame }: { state: PooleanState; onOpenGame: (id: string) => void }) {
  const m = useMemo(() => leagueMomentum(state), [state])
  if (!m) return <p className="text-muted-foreground">This fills in once a game has been filmed and logged.</p>
  const best = [...m.games].sort((a, b) => a.chance - b.chance)[0]
  const st = m.streaks
  return (
    <>
      <p>
        The rules give the ball to the team that was just scored on, so baskets mostly go back and forth on their own. A run happens when a team scores, the other side comes
        up empty, and the first team scores again. So the fair question is not "are there long runs", it is "does a run make the next basket harder to answer". Each game's
        longest run is checked against that game's own rates of scoring again right after scoring, with no memory of how long a run already is.
      </p>
      <div>
        <div className="mb-1 font-semibold">The rarest run on record</div>
        <p className="mb-2">
          {formatDateDisplay(best.game.date)}: {runLine(state, best)} Chance gives a run that long {oneIn(best.chance)}. {runVerdict(best.chance)}
        </p>
        <BasketStrip game={best.game} m={best} />
      </div>
      <div>
        <div className="mb-1 font-semibold">Over all {m.games.length} filmed games</div>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            After one basket, the other team scored next {pct(m.answerAfterOne.made / Math.max(1, m.answerAfterOne.att))} of the time ({m.answerAfterOne.att} times). After two or more in
            a row, {pct(m.answerAfterRun.made / Math.max(1, m.answerAfterRun.att))} ({m.answerAfterRun.att} times). Momentum would make the second lower. Stronger teams have more of the
            runs and their opponents answer less, which also pushes it lower, so a gap here would overstate momentum.{" "}
            {m.answerDiff === null
              ? "Too few baskets to compare yet."
              : m.answerVerdict === "early"
                ? "No sign of momentum so far."
                : m.answerDiff < 0
                  ? m.answerVerdict === "hint" ? "A hint of momentum, not proof yet." : "Teams answer clearly less often after a run."
                  : "If anything, teams answer more often after a run."}
          </li>
          <li>
            The longest run averages {m.avgLongest.toFixed(1)} baskets a game; chance gives {m.avgExpectedLongest.toFixed(1)}. {m.rare === 0 ? "No game had a run chance gives 1 time in 10 or less." : `${m.rare} game${m.rare === 1 ? "" : "s"} had a run chance gives 1 time in 10 or less; with ${m.games.length} games, chance alone would give about ${Math.max(1, Math.round(m.games.length / 10))}.`}
          </li>
          {st && (
            <li>
              Shooters: {pct(st.afterMake.made / st.afterMake.att)} right after a make ({st.afterMake.att} shots), {pct(st.afterMiss.made / st.afterMiss.att)} after a miss. Shuffling each
              player's own shots in each game gives {Math.round(st.chanceAfterMake)}% and {Math.round(st.chanceAfterMiss)}%, since better shooters take more of the shots that follow a make. So
              the gap to beat is {signed(st.chanceGap, 0)}, and the real gap is {signed(st.gap, 0)}. {st.gap > st.chanceGap ? (st.verdict === "early" ? "A touch hotter than chance, not enough to call." : "Hotter than chance.") : "No hot hand so far."}
            </li>
          )}
        </ul>
      </div>
      <div>
        <div className="mb-1 font-semibold">Every game</div>
        <ul className="flex flex-col gap-1">
          {m.games.map((g) => (
            <li key={g.game.id}>
              <button className="text-left underline-offset-2 hover:underline" onClick={() => onOpenGame(g.game.id)}>
                {formatDateDisplay(g.game.date)}: {g.longest.length} straight by Team {g.longest.side}, chance gives it {oneIn(g.chance)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

// ---------- Two-Way and outliers ----------

function TwoWay({ state, onOpenGame }: { state: PooleanState; onOpenGame: (id: string) => void }) {
  const players = useMemo(() => {
    const count = (id: string) => state.games.filter((g) => isQualifyingGame(g) && (g.teamA.includes(id) || g.teamB.includes(id))).length
    return state.players
      .map((p) => ({ id: p.id, name: p.name, n: count(p.id) }))
      .filter((p) => p.n > 0)
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
  }, [state])
  const [pid, setPid] = useState(players[0]?.id ?? "")
  const games = useMemo(
    () => state.games.filter((g) => isQualifyingGame(g) && (g.teamA.includes(pid) || g.teamB.includes(pid))).sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [state.games, pid],
  )
  const [gid, setGid] = useState<string | null>(null)
  if (!players.length) return <p className="text-muted-foreground">This fills in once a game has been filmed and logged.</p>
  const g = games.find((x) => x.id === gid) ?? games[0]
  const s = getGameStats(g, pid)
  const sh = shootingStats(g, pid)
  const def = gameDefenseStats(g, pid)
  const off = offensiveRating(s, sh)
  const dRating = defensiveRating(s, def)
  const pace = gamePace(g, gameTotalPoints(g))
  const perGame = ((off + dRating) / pace) * PER
  const offRows: [string, number, number][] = [
    ["Points", s.pts, 1],
    ["Shots made (2s and 3s)", sh.fgm, 0.4],
    ["Shots tried (2s and 3s)", sh.fga, -0.7],
    ["Free throws missed", sh.fta - sh.ftm, -0.4],
    ["Offensive rebounds", s.oreb, 0.7],
    ["Defensive rebounds", s.dreb, 0.3],
    ["Assists", s.ast, 0.7],
    ["Fouls", s.pf, -0.4],
    ["Turnovers", s.tov, -1],
  ]
  const defRows: [string, number, number][] = [
    ["Steals", s.stl, 1],
    ["Blocks on someone else's man", def.blocksNotAlreadyStopped, 0.7],
    ["Misses forced, not after getting beat", def.stops - def.beatMisses, 1],
    ["Baskets scored on them", def.timesBeaten, -1],
    ["Points scored on them", def.ptsAllowed, -0.4],
  ]
  // Outliers: this player's Two-Way per average game in every game, and the fences that decide which count.
  const per = [...games].reverse().map((x) => {
    const v = ((offensiveRating(getGameStats(x, pid), shootingStats(x, pid)) + defensiveRating(getGameStats(x, pid), gameDefenseStats(x, pid))) / gamePace(x, gameTotalPoints(x))) * PER
    return { game: x, v }
  })
  const inside = insideFences(per.map((r) => r.v))
  const sorted = per.map((r) => r.v).sort((a, b) => a - b)
  const q = (p: number) => {
    const pos = (sorted.length - 1) * p
    const lo = Math.floor(pos)
    return sorted[lo + 1] !== undefined ? sorted[lo] + (pos - lo) * (sorted[lo + 1] - sorted[lo]) : sorted[lo]
  }
  const iqr = q(0.75) - q(0.25)
  const fence: [number, number] = [q(0.25) - 1.5 * iqr, q(0.75) + 1.5 * iqr]
  const name = playerName(state, pid)
  const table = (rows: [string, number, number][], total: number, label: string) => (
    <table className="w-full max-w-md text-sm">
      <tbody>
        {rows.map(([l, v, w]) => (
          <tr key={l} className={cn(v === 0 && "text-muted-foreground")}>
            <td className="py-0.5">{l}</td>
            <td className="py-0.5 text-right tabular-nums">{Number.isInteger(v) ? v : v.toFixed(1)}</td>
            <td className="py-0.5 pl-2 text-right tabular-nums text-muted-foreground">× {w}</td>
            <td className="py-0.5 pl-2 text-right tabular-nums">{signed(v * w)}</td>
          </tr>
        ))}
        <tr className="border-t font-semibold">
          <td className="py-1" colSpan={3}>
            {label}
          </td>
          <td className="py-1 text-right tabular-nums">{signed(total)}</td>
        </tr>
      </tbody>
    </table>
  )
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Player</span>
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={pid}
            onChange={(e) => {
              setPid(e.target.value)
              setGid(null)
            }}
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Game</span>
          <select className="rounded-md border bg-background px-2 py-1" value={g.id} onChange={(e) => setGid(e.target.value)}>
            {games.map((x) => (
              <option key={x.id} value={x.id}>
                {formatDateDisplay(x.date)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 font-semibold">Offense</div>
          {table(offRows, off, "Offense")}
        </div>
        <div>
          <div className="mb-1 font-semibold">Defense</div>
          {table(defRows, dRating, "Defense")}
          <p className="mt-1 text-xs text-muted-foreground">A shot guarded by two people counts half for each.</p>
        </div>
      </div>
      <p>
        {name}'s Two-Way in this game: offense {signed(off)}, defense {signed(dRating)}, total <span className="font-semibold">{signed(off + dRating)}</span>. Games run to different
        lengths, so the Stats page's Two-Way/G scales it to an average game: this one was {(pace / PER).toFixed(2)} average games long, which makes it{" "}
        <span className="font-semibold">{signed(perGame)}</span> per game.
      </p>
      <div>
        <div className="mb-1 font-semibold">Which games count as outliers</div>
        {per.length < OUTLIER_MIN_GAMES ? (
          <p>
            {name} has {per.length} filmed game{per.length === 1 ? "" : "s"}. Outliers are only looked for once a player has {OUTLIER_MIN_GAMES}, so every game counts.
          </p>
        ) : (
          <>
            <p className="mb-2">
              Each of {name}'s games, as Two-Way per average game. The middle half runs from {q(0.25).toFixed(1)} to {q(0.75).toFixed(1)}; a game more than one and a half times that
              spread beyond it (below {fence[0].toFixed(1)} or above {fence[1].toFixed(1)}) is an outlier. Leaving outliers out only changes averages and rates, never records or
              best games, and it is worked out again every time a game is added.
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {per.map((r, i) => (
                <li key={r.game.id}>
                  <button
                    onClick={() => onOpenGame(r.game.id)}
                    className={cn("rounded-md border px-2 py-1 tabular-nums", !inside[i] && "border-dashed border-foreground font-semibold italic")}
                    aria-label={`${formatDateDisplay(r.game.date)}: ${r.v.toFixed(1)}${inside[i] ? "" : ", an outlier"}`}
                  >
                    {formatDateDisplay(r.game.date)} {signed(r.v)}
                    {!inside[i] && " (outlier)"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  )
}

// ---------- Points added ----------

// A real trip that has a miss, an offensive rebound and a make, walked through play by play.
function PointsAddedWalk({ state, onOpenGame }: { state: PooleanState; onOpenGame: (id: string) => void }) {
  const data = useMemo(() => {
    const gs = insightGames(state)
    const v = leagueValues(gs)
    const epa = pointsAdded(state)
    // Prefer a trip with three different people in it (shooter, rebounder, and a passer on the make), newest first.
    let best: { g: (typeof gs)[number]; miss: (typeof gs)[number]["scoringEvents"][number]; make: (typeof gs)[number]["scoringEvents"][number]; score: number } | null = null
    for (const g of [...gs].reverse()) {
      if (!g.scoringEvents.every((e) => typeof e.videoTime === "number")) continue
      const shots = [...g.scoringEvents].filter((e) => e.points !== 1).sort((a, b) => (a.videoTime as number) - (b.videoTime as number))
      const out = new Set(g.turnoverEvents.map((t) => t.missEventId).filter(Boolean) as string[])
      for (let i = 1; i < shots.length; i++) {
        const miss = shots[i - 1]
        const make = shots[i]
        const same = g.teamA.includes(miss.scorerId) === g.teamA.includes(make.scorerId)
        if (!same || shotEnd(g, miss, out) !== "kept" || !miss.rebounderId || shotEnd(g, make, out) !== "made") continue
        const score = new Set([miss.scorerId, miss.rebounderId, make.scorerId, make.assistId].filter(Boolean)).size
        if (!best || score > best.score) best = { g, miss, make, score }
      }
    }
    if (best) return { g: best.g, miss: best.miss, make: best.make, v, epa }
    return { g: null, miss: null, make: null, v, epa }
  }, [state])
  const { g, miss, make, v, epa } = data
  if (!epa.rows.length) return <p className="text-muted-foreground">This fills in once a game has been filmed and logged.</p>
  const keep = (k: number) => (k === 2 ? v.keep2 : v.keep3)
  const steps: { who: string; what: string; worth: number; credit: string }[] = []
  if (g && miss && make) {
    const afterMiss = keep(miss.points) * v.ep
    steps.push({ who: playerName(state, miss.scorerId), what: `misses a ${miss.points}, and it stays in`, worth: afterMiss, credit: `${playerName(state, miss.scorerId)} ${signed2(afterMiss - v.ep)}` })
    steps.push({ who: playerName(state, miss.rebounderId!), what: "gets the offensive rebound", worth: v.ep, credit: `${playerName(state, miss.rebounderId!)} ${signed2(v.ep - afterMiss)}` })
    const value = make.points - v.ep
    const passer = make.assistId && make.assistId !== make.scorerId ? make.assistId : null
    steps.push({
      who: playerName(state, make.scorerId),
      what: `makes a ${make.points}${passer ? `, from ${playerName(state, passer)}'s pass` : ""}`,
      worth: make.points,
      credit: passer ? `${playerName(state, make.scorerId)} ${signed2(value * CREDIT.scorer)}, ${playerName(state, passer)} ${signed2(value * CREDIT.assister)}` : `${playerName(state, make.scorerId)} ${signed2(value)}`,
    })
  }
  return (
    <>
      {g && (
        <div>
          <div className="mb-1 font-semibold">
            One real trip,{" "}
            <button className="underline underline-offset-2" onClick={() => onOpenGame(g.id)}>
              {formatDateDisplay(g.date)}
            </button>
          </div>
          <ol className="flex flex-col gap-1.5">
            <li>The trip starts: worth {v.ep.toFixed(2)} points.</li>
            {steps.map((s, i) => (
              <li key={i}>
                <span className="font-semibold">{s.who}</span> {s.what}: now worth {s.worth.toFixed(2)}. <span className="text-muted-foreground">({s.credit})</span>
              </li>
            ))}
          </ol>
          <p className="mt-2">
            The three plays add up to {signed2(make ? make.points - v.ep : 0)}: the trip scored {make?.points} where an average one scores {v.ep.toFixed(2)}. A missed {miss?.points} that
            stays in bounds keeps {Math.round(keep(miss?.points ?? 2) * 100)}% of the trip's worth, the chance the shooting team gets it back; one that goes out of bounds keeps none.
            Whoever guarded each shot takes the other side of its value.
          </p>
        </div>
      )}
      <div>
        <div className="mb-1 font-semibold">What each play is worth, over the filmed games the stats count</div>
        <PlayValues epa={epa} />
      </div>
      <p>
        Points added says who makes good plays whatever the score; Win chance added says whose plays mattered most to the result. Both are on the Stats page and each Player page.
      </p>
    </>
  )
}

export function HowItWorks({ state, onBack, onOpenGame }: { state: PooleanState; onBack: () => void; onOpenGame: (id: string) => void }) {
  return (
    <div className="anim-page flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          &larr; Back
        </Button>
        <h2 className="font-display text-xl font-bold">How the numbers work</h2>
      </div>
      <p className="text-sm text-muted-foreground">Each number on the site, worked through on a real moment from the league. Pick another game and the math follows.</p>
      <nav aria-label="On this page" className="flex flex-wrap gap-2 text-sm">
        {[
          ["how-odds", "Live odds"],
          ["how-runs", "Was that run real?"],
          ["how-twoway", "Two-Way and outliers"],
          ["how-epa", "Points added"],
          ["how-rules", "Rule changes"],
        ].map(([id, label]) => (
          <button key={id} className="rounded-full border px-3 py-1 hover:bg-muted" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            {label}
          </button>
        ))}
      </nav>
      <Section id="how-odds" title="Live odds, one basket at a time" intro="The win chance on the live screen, worked out on a basket from a filmed game. It starts on the basket that moved the odds most.">
        <LiveOdds state={state} />
      </Section>
      <Section id="how-runs" title="Was that run real?" intro="Every game feels like it has momentum. This checks the runs against chance that knows who gets the ball after a basket.">
        <Runs state={state} onOpenGame={onOpenGame} />
      </Section>
      <Section id="how-twoway" title="Two-Way, on one real line" intro="The Stats page's main number, added up term by term from one player's game, and the rule for which games count as outliers.">
        <TwoWay state={state} onOpenGame={onOpenGame} />
      </Section>
      <Section id="how-epa" title="Points added, one trip at a time" intro="The idea behind expected points in football, for pool basketball: every play is scored by how far it moves what the trip is worth.">
        <PointsAddedWalk state={state} onOpenGame={onOpenGame} />
      </Section>
      <Section id="how-rules" title="Rule changes" intro="Poolean's rulebook, tracked over time, so every game is matched to the rules it was played under and a change can be judged before and after.">
        <RuleHistory state={state} />
      </Section>
    </div>
  )
}
