import { useState } from "react"
import { EmptyState } from "@/components/EmptyState"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/format"
import { headToHead, mostMetPair } from "@/lib/headToHead"
import { predictRealMatchup } from "@/lib/matchup"
import { playerName } from "@/lib/players"
import type { Game, PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// Pick any two players: their record against each other, the last few meetings, how they do as teammates, and what
// the model gives each of them in a one on one.
export function HeadToHeadCard({ state, onOpenGame }: { state: PooleanState; onOpenGame: (g: Game) => void }) {
  const start = mostMetPair(state)
  const [a, setA] = useState(start?.[0] ?? "")
  const [b, setB] = useState(start?.[1] ?? "")
  const sorted = [...state.players].sort((x, y) => x.name.localeCompare(y.name))
  if (state.players.length < 2) return null
  const h = a && b && a !== b ? headToHead(state, a, b) : null
  const odds = h ? predictRealMatchup([a], [b]) : null
  const total = h ? h.aWins + h.bWins : 0
  const last = h ? h.meetings.slice(-5).reverse() : []
  const picker = (value: string, set: (v: string) => void, label: string) => (
    <select className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => set(e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {sorted.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Head to head</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {picker(a, setA, "First player")}
          <span className="text-sm text-muted-foreground">vs</span>
          {picker(b, setB, "Second player")}
        </div>
        {!h ? (
          <EmptyState title="Pick two players" hint="See their record against each other and how they do as teammates." />
        ) : h.meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {playerName(state, a)} and {playerName(state, b)} have never been on opposite teams.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <PlayerAvatar id={a} name={playerName(state, a)} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex justify-between text-sm font-semibold tabular-nums">
                  <span>{h.aWins}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {total} {total === 1 ? "game" : "games"}
                  </span>
                  <span>{h.bWins}</span>
                </div>
                <div role="img" aria-label={`${playerName(state, a)} ${h.aWins}, ${playerName(state, b)} ${h.bWins}`} className="flex h-2 overflow-hidden rounded-full bg-muted">
                  <span className="bg-[var(--team-a)]" style={{ width: `${total ? (h.aWins / total) * 100 : 50}%` }} />
                  <span className="bg-[var(--team-b)]" style={{ width: `${total ? (h.bWins / total) * 100 : 50}%` }} />
                </div>
              </div>
              <PlayerAvatar id={b} name={playerName(state, b)} size="sm" />
            </div>
            <p className="text-sm">
              Points when they face each other: {playerName(state, a)} {h.aPts.toFixed(1)}, {playerName(state, b)} {h.bPts.toFixed(1)}.
            </p>
            {odds && (
              <p className="text-sm">
                Model odds in a one on one: {playerName(state, a)} {Math.round(odds.pA * 100)}%, {playerName(state, b)} {Math.round((1 - odds.pA) * 100)}%.
              </p>
            )}
            <ul className="flex flex-col gap-1" aria-label="Last meetings">
              {last.map((m) => (
                <li key={m.game.id}>
                  <button type="button" className="flex w-full items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted" onClick={() => onOpenGame(m.game)}>
                    <span>{formatDateDisplay(m.date)}</span>
                    <span className={cn("font-semibold tabular-nums")}>
                      {playerName(state, m.aScore > m.bScore ? a : b)} {Math.max(m.aScore, m.bScore)}-{Math.min(m.aScore, m.bScore)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {h && h.togetherWins + h.togetherLosses > 0 && (
          <p className="text-sm text-muted-foreground">
            As teammates: {h.togetherWins}-{h.togetherLosses}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
