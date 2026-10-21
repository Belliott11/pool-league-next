import { Star } from "lucide-react"
import { useMemo } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { boardOf, keyPlayer, otherGamesThatNight, recentForm, type Result } from "@/lib/gamePreview"
import { scoreOf } from "@/lib/nightRecap"
import { playerName } from "@/lib/players"
import { TEAM } from "@/lib/teamColors"
import type { Game, PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

const DOT: Record<Result, string> = { W: "bg-pos", L: "bg-neg", T: "bg-muted-foreground/50" }

function Form({ results }: { results: Result[] }) {
  if (results.length === 0) return <span className="text-xs text-muted-foreground">new</span>
  return (
    <span role="img" aria-label={`Last ${results.length} games, oldest first: ${results.join(", ")}`} className="flex gap-1">
      {results.map((r, i) => (
        <span key={i} title={r === "W" ? "Win" : r === "L" ? "Loss" : "Tie"} className={cn("size-2.5 rounded-full", DOT[r])} />
      ))}
    </span>
  )
}

// Both sides as a lineup: number, name, recent form and rating, with each side's key player marked and compared.
export function TeamsTab({ state, game, onOpenGame }: { state: PooleanState; game: Game; onOpenGame?: (g: Game) => void }) {
  const rows = useMemo(() => boardOf(state), [state])
  const byId = useMemo(() => new Map(rows.map((r) => [r.player.id, r])), [rows])
  const sides = [
    { key: "A" as const, ids: game.teamA },
    { key: "B" as const, ids: game.teamB },
  ].map((s) => ({ ...s, key_: keyPlayer(rows, s.ids) }))
  const [ka, kb] = [sides[0].key_, sides[1].key_]
  const others = otherGamesThatNight(state, game)
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {sides.map((s) => (
          <Card key={s.key}>
            <CardHeader>
              <CardTitle className={cn("font-display", TEAM[s.key].text)}>Team {s.key}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {s.ids.map((id) => {
                const r = byId.get(id)
                const num = state.players.find((p) => p.id === id)?.number
                const isKey = s.key_?.player.id === id
                return (
                  <div key={id} className="flex items-center gap-2 text-sm">
                    <PlayerAvatar id={id} name={playerName(state, id)} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {num !== undefined && <span className="mr-1 tabular-nums text-muted-foreground">#{num}</span>}
                      {playerName(state, id)}
                      {isKey && <Star aria-label="Key player" className="ml-1 inline size-3.5 fill-gold text-gold" />}
                    </span>
                    <Form results={recentForm(state, id, game)} />
                    <span className="w-10 text-right tabular-nums text-muted-foreground">{r && r.gp > 0 ? r.twoWayPer20.toFixed(1) : "-"}</span>
                  </div>
                )
              })}
              <p className="text-xs text-muted-foreground">Last 5 games before this one, then two-way per 20.</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {ka && kb && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Key players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1.5 text-sm">
              <span className={cn("font-semibold", TEAM.A.text)}>{ka.player.name}</span>
              <span />
              <span className={cn("text-right font-semibold", TEAM.B.text)}>{kb.player.name}</span>
              {(
                [
                  ["Two-way per 20", ka.twoWayPer20.toFixed(1), kb.twoWayPer20.toFixed(1)],
                  ["Points per 20", ka.ptsPer20.toFixed(1), kb.ptsPer20.toFixed(1)],
                  ["Games", String(ka.gp), String(kb.gp)],
                  ["Record", `${ka.wins}-${ka.losses}`, `${kb.wins}-${kb.losses}`],
                ] as const
              ).map(([label, a, b]) => (
                <div key={label} className="contents">
                  <span className="tabular-nums">{a}</span>
                  <span className="text-center text-xs text-muted-foreground">{label}</span>
                  <span className="text-right tabular-nums">{b}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {others.length > 0 && onOpenGame && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Also that night</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {others.map((g) => {
              const [a, b] = scoreOf(g)
              return (
                <button key={g.id} type="button" onClick={() => onOpenGame(g)} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted">
                  <span className="min-w-0 flex-1 truncate">
                    {g.teamA.map((id) => playerName(state, id)).join(", ")} <span className="text-muted-foreground">vs</span> {g.teamB.map((id) => playerName(state, id)).join(", ")}
                  </span>
                  <span className="font-display tabular-nums">
                    <span className={a > b ? TEAM.A.text : ""}>{a}</span>-<span className={b > a ? TEAM.B.text : ""}>{b}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">FT</span>
                  </span>
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
