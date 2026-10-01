import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { planPartyNight } from "@/lib/balance"
import { poolNameOf } from "@/lib/real"
import type { PooleanState } from "@/lib/types"
import { AttendeeChips } from "./BalanceTeams"
import { nativeSelect } from "./GameLog"

type Plan = ReturnType<typeof planPartyNight>

export function PartyPlanner({
  state,
  attendees,
  setAttendees,
  balanceAttendees,
}: {
  state: PooleanState
  attendees: string[]
  setAttendees: (ids: string[]) => void
  balanceAttendees: string[]
}) {
  const [perSide, setPerSide] = useState(0)
  const [gameCount, setGameCount] = useState(8)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [copied, setCopied] = useState("")
  const nameOf = (id: string) => poolNameOf(state, id)
  const n = attendees.length
  const sizeOptions: number[] = []
  for (let k = 2; k * 2 < n; k++) sizeOptions.push(k)

  function generate() {
    if (n < 2) return
    const count = Math.min(30, Math.max(1, gameCount || 8))
    setPlan(planPartyNight(attendees, sizeOptions.includes(perSide) ? perSide : 0, count, nameOf))
  }

  async function copy() {
    if (!plan) return
    const names = (ids: string[]) => ids.map(nameOf).join(", ")
    const text = plan.games
      .map((g, i) => {
        const odds = g.pA !== null ? ` (${Math.round(g.pA * 100)}% / ${100 - Math.round(g.pA * 100)}%)` : ""
        const sit = g.sitting.length ? `\n   Sitting: ${names(g.sitting)}` : ""
        return `Game ${i + 1}: ${names(g.a)} vs. ${names(g.b)}${odds}${sit}`
      })
      .join("\n")
    try {
      await navigator.clipboard.writeText(text)
      setCopied("Copied")
    } catch {
      setCopied("Couldn't copy. Select the schedule and copy it by hand.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Party Night Planner</CardTitle>
        <p className="text-sm text-muted-foreground">
          A whole night&apos;s schedule at once. Whoever has played the fewest games plays next, and each game is the best of 300 random
          splits, avoiding repeat teammates and opponents and keeping the Matchup Predictor&apos;s odds close to even. Not saved anywhere.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button size="sm" variant="outline" onClick={() => setAttendees([...balanceAttendees])}>
            Same people as Balance Teams
          </Button>
          {n > 0 && <span className="text-muted-foreground">{n} here</span>}
        </div>
        <AttendeeChips
          state={state}
          selected={attendees}
          onToggle={(id) => setAttendees(attendees.includes(id) ? attendees.filter((x) => x !== id) : [...attendees, id])}
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1">
            Players per side
            <select
              className={nativeSelect}
              value={sizeOptions.includes(perSide) ? perSide : 0}
              onChange={(e) => setPerSide(parseInt(e.target.value, 10))}
            >
              <option value={0}>Everyone plays</option>
              {sizeOptions.map((k) => (
                <option key={k} value={k}>
                  {k} per side ({n - 2 * k} sit)
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Games
            <Input type="number" min={1} max={30} className="w-20" value={gameCount} onChange={(e) => setGameCount(parseInt(e.target.value, 10) || 0)} />
          </label>
          <Button size="sm" disabled={n < 2} onClick={generate}>
            Plan the Night
          </Button>
        </div>
        {plan && (
          <>
            <ol className="flex flex-col gap-2">
              {plan.games.map((g, i) => {
                const pA = g.pA !== null ? Math.round(g.pA * 100) : null
                return (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border p-2 text-sm">
                    <span className="font-display font-semibold">Game {i + 1}</span>
                    <span>
                      {g.a.map(nameOf).join(", ")} <span className="text-muted-foreground">vs.</span> {g.b.map(nameOf).join(", ")}
                    </span>
                    {pA !== null && (
                      <span className="tabular-nums text-muted-foreground" title="Matchup Predictor odds, left team / right team">
                        {pA}% / {100 - pA}%
                      </span>
                    )}
                    {g.sitting.length > 0 && <span className="text-muted-foreground">Sitting: {g.sitting.map(nameOf).join(", ")}</span>}
                  </li>
                )
              })}
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={generate}>
                Reshuffle
              </Button>
              <Button size="sm" variant="outline" onClick={copy}>
                Copy Schedule
              </Button>
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {copied}
              </span>
            </div>
            <h4 className="font-display font-semibold">Who plays with whom</h4>
            <ul className="text-sm">
              {plan.summary.map((r) => (
                <li key={r.id}>
                  {nameOf(r.id)}{" "}
                  <span className="text-muted-foreground">
                    {r.games} game{r.games === 1 ? "" : "s"}, {r.teammates} of {plan.others} as teammates
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
