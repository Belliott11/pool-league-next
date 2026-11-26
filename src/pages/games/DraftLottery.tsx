import { useState } from "react"
import { Dices, Sparkles } from "lucide-react"
import { TeamChip } from "@/components/TeamChip"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ballsFor, cancelLottery, lotteryOf, pickOdds, revealNext, runLottery, type LotteryMode } from "@/lib/draftLottery"
import { playerName } from "@/lib/players"
import { picksMade, putSet } from "@/lib/seasonTeams"
import type { Update } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { PooleanState, SeasonTeamSet } from "@/lib/types"

const pc = (x: number) => `${Math.round(x * 100)}%`
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`

// Draft lottery night on the Season teams page (src/lib/draftLottery.ts): before the first pick, the editor can draw the first round's
// order and reveal it one pick at a time, last pick first, on everyone's phone. Visitors see it once it is drawn.
export function DraftLottery({ state, set, update, readOnly }: { state: PooleanState; set: SeasonTeamSet; update: Update; readOnly: boolean }) {
  const [mode, setMode] = useState<LotteryMode>("even")
  const l = lotteryOf(set)
  if (picksMade(set) > 0 && !l) return null
  if (!l && readOnly) return null
  const save = (next: SeasonTeamSet) => update((s) => putSet(s, next))
  const name = (id: string) => playerName(state, id)
  const team = (id: string) => set.teams.find((t) => t.id === id)!
  const n = set.teams.length

  if (!l) {
    const balls = ballsFor(set, mode, name)
    const odds = pickOdds(balls)
    const total = Object.values(balls).reduce((a, b) => a + b, 0)
    const rows = [...set.teams].sort((a, b) => balls[b.id] - balls[a.id])
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Dices aria-hidden className="size-5 text-accent" /> Draft lottery
          </CardTitle>
          <p className="text-sm text-muted-foreground">Draw the first round's order instead of setting it, then reveal it one pick at a time on everyone's phone, last pick first. The snake follows from there.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs text-muted-foreground">Balls</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name="lottery-mode" checked={mode === "even"} onChange={() => setMode("even")} className="mt-1 accent-[var(--color-primary)]" />
              <span>
                <span className="font-medium">Even.</span> <span className="text-muted-foreground">One ball each.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="lottery-mode" checked={mode === "weighted"} onChange={() => setMode("weighted")} className="mt-1 accent-[var(--color-primary)]" />
              <span>
                <span className="font-medium">Weighted.</span> <span className="text-muted-foreground">The weakest captain by power ranking holds the most balls, the strongest the fewest.</span>
              </span>
            </label>
          </fieldset>
          <ul className="flex flex-col gap-1">
            {rows.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <TeamChip team={t} /> <span className="text-muted-foreground">{t.captain ? name(t.captain) : ""}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {balls[t.id]} of {total} balls, {pc(odds[t.id][0])} at 1st
                </span>
              </li>
            ))}
          </ul>
          <Button className="self-start" onClick={() => save(runLottery(set, mode, name))}>
            <Dices aria-hidden /> Draw the lottery
          </Button>
          <p className="text-xs text-muted-foreground">The draw happens on this phone; nothing shows until you reveal each pick.</p>
        </CardContent>
      </Card>
    )
  }

  const done = l.revealed >= n
  const odds = pickOdds(l.balls)
  const nextPick = n - l.revealed // the pick number revealed next
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Dices aria-hidden className="size-5 text-accent" /> {done ? "Lottery result" : "Draft lottery: live"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {done
            ? "The first round goes in this order; the snake reverses it each round."
            : `${l.mode === "weighted" ? "Weighted toward the weakest captains." : "One ball each."} Revealed from the last pick up; the draft starts once the 1st pick is shown.`}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <ol className="flex flex-col gap-1.5" aria-live="polite">
          {l.order.map((id, i) => {
            const pick = i + 1
            const shown = pick > nextPick || done
            const t = team(id)
            return (
              <li
                key={pick}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2",
                  shown ? "animate-in fade-in zoom-in-95 duration-500" : "border-dashed text-muted-foreground",
                  !done && pick === nextPick && "border-primary",
                  done && pick === 1 && "border-gold",
                )}
              >
                <span className="w-10 font-display text-lg font-bold tabular-nums">{ordinal(pick)}</span>
                {shown ? (
                  <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
                    <span>
                      <TeamChip team={t} /> <span className="text-muted-foreground">{t.captain ? name(t.captain) : ""}</span>
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">had {pc(odds[id][i])} at this pick</span>
                  </span>
                ) : (
                  <span className={cn("flex-1", pick === nextPick && "motion-safe:animate-pulse")}>{pick === nextPick ? "Up next" : "?"}</span>
                )}
              </li>
            )
          })}
        </ol>
        {!readOnly && !done && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save(revealNext(set))}>
              <Sparkles aria-hidden /> Reveal the {ordinal(nextPick)} pick
            </Button>
            {l.revealed === 0 && (
              <>
                <Button variant="outline" onClick={() => save(runLottery(set, l.mode, name))}>
                  Draw again
                </Button>
                <Button variant="ghost" onClick={() => save(cancelLottery(set))}>
                  Call off the lottery
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
