import { basketsOf, gameMomentum, MIN_BASKETS, oneIn, runsOf, type GameMomentum } from "@/lib/momentum"
import { playerName } from "@/lib/players"
import { TEAM } from "@/lib/teamColors"
import { cn } from "@/lib/utils"
import type { Game, PooleanState } from "@/lib/types"

// How surprising a run is, in words. "Rare" only for runs a shuffle gives 1 time in 20 or less.
export function runVerdict(chance: number): string {
  if (chance <= 0.05) return "That one was rare."
  if (chance <= 0.15) return "Unusual, but chance does it now and then."
  return "Nothing unusual there."
}

export function runLine(state: PooleanState, m: GameMomentum): string {
  const r = m.longest
  const team = r.side === "A" ? m.game.teamA : m.game.teamB
  const who = team.map((id) => playerName(state, id)).join(" and ")
  return `${r.length} straight baskets by ${who}, ${r.points} points, from ${r.from[0]}-${r.from[1]} to ${r.to[0]}-${r.to[1]}.`
}

// Every made basket in order, colored by team, with the longest run outlined.
export function BasketStrip({ game, m }: { game: Game; m: GameMomentum }) {
  const baskets = basketsOf(game)
  const runs = runsOf(baskets)
  let i = 0
  let found = false
  return (
    <div role="img" aria-label={`Every made basket in order, Team A blue and Team B orange. The longest run is ${m.longest.length} baskets by Team ${m.longest.side}.`} className="flex flex-wrap gap-1">
      {runs.map((r, k) => {
        const start = i
        i += r.length
        const isLongest = !found && r === m.longest
        if (isLongest) found = true
        return (
          <span key={k} className={cn("flex gap-0.5 rounded-md p-0.5", isLongest && "ring-2 ring-foreground")}>
            {baskets.slice(start, start + r.length).map((b, j) => (
              <span key={j} className={cn("flex size-5 items-center justify-center rounded-sm text-[10px] font-semibold text-white", TEAM[b.side].bg)}>
                {b.points}
              </span>
            ))}
          </span>
        )
      })}
    </div>
  )
}

// The game page's "Was that run real?" card: the longest run, and how often a shuffle of the same baskets gives one that long.
export function RunCheck({ state, game }: { state: PooleanState; game: Game }) {
  const m = gameMomentum(game)
  if (!m) return <p className="text-sm text-muted-foreground">This game needs {MIN_BASKETS} made baskets, some by each team, before its runs say anything.</p>
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        <span className="font-semibold">Longest run:</span> {runLine(state, m)}
      </p>
      <BasketStrip game={game} m={m} />
      <p>
        Shuffle this game's {m.baskets} baskets ({m.nA} for Team A, {m.nB} for Team B) into a random order and a run that long turns up{" "}
        <span className="font-semibold">{oneIn(m.chance)}</span>. {runVerdict(m.chance)}
      </p>
      <p className="text-muted-foreground">
        The game had {m.runs} runs in all; a random order of the same baskets averages {m.expectedRuns.toFixed(1)}.{" "}
        <a className="underline underline-offset-2" href="#/games/how">
          How this works
        </a>
      </p>
    </div>
  )
}
