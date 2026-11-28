import { useMemo, useState } from "react"
import { ArrowLeft, Dices, Share2 } from "lucide-react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dreamKey, dreamMatchup, parseDreamKey, type DreamGame } from "@/lib/dreamMatchup"
import { joinNames } from "@/lib/format"
import { playerName } from "@/lib/players"
import { shareText } from "@/lib/shareText"
import { SITE } from "@/lib/site"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// Dream matchup at #/games/dream/<a,b>.<c,d> (src/lib/dreamMatchup.ts): put anyone on either team, see the chance and one game played
// out. Changing a team changes the address, so a matchup can be sent as a link.

const pct = (p: number) => `${Math.round(p * 100)}%`

function BoxScore({ state, game, ids, label }: { state: PooleanState; game: DreamGame; ids: string[]; label: string }) {
  const lines = game.lines.filter((l) => ids.includes(l.id)).sort((x, y) => y.points - x.points)
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold">{label}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Pts</TableHead>
            <TableHead className="text-right">3s</TableHead>
            <TableHead className="text-right">Ast</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{playerName(state, l.id)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{l.points}</TableCell>
              <TableCell className="text-right tabular-nums">{l.threes}</TableCell>
              <TableCell className="text-right tabular-nums">{l.assists}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function DreamMatchupPage({ state, matchup, onBack, onPick, onOpenPlayer }: { state: PooleanState; matchup: string; onBack: () => void; onPick: (key: string) => void; onOpenPlayer: (id: string) => void }) {
  const ids = useMemo(() => new Set(state.players.map((p) => p.id)), [state.players])
  // No matchup in the address: start from the last game's two teams.
  const last = useMemo(() => [...state.games].filter((g) => !g.liveInProgress && !g.test).sort((x, y) => (x.date || "").localeCompare(y.date || "")).at(-1), [state.games])
  const [start] = useState<[string[], string[]]>(() => (matchup ? parseDreamKey(matchup, ids) : last ? [last.teamA.filter((id) => ids.has(id)), last.teamB.filter((id) => ids.has(id))] : [[], []]))
  const [a, setA] = useState(start[0])
  const [b, setB] = useState(start[1])
  const [again, setAgain] = useState(0)
  const [sent, setSent] = useState("")
  const ready = a.length > 0 && b.length > 0
  const d = useMemo(() => (ready ? dreamMatchup(state, a, b, again) : null), [state, a, b, again, ready])
  const name = (id: string) => playerName(state, id)
  const roster = [...state.players].sort((x, y) => x.name.localeCompare(y.name))
  const set = (id: string, side: "A" | "B" | null) => {
    const na = side === "A" ? [...a.filter((x) => x !== id), id] : a.filter((x) => x !== id)
    const nb = side === "B" ? [...b.filter((x) => x !== id), id] : b.filter((x) => x !== id)
    setA(na)
    setB(nb)
    setAgain(0)
    if (na.length && nb.length) onPick(dreamKey(na, nb))
  }
  const fav = d ? (d.chance >= 0.5 ? "A" : "B") : null
  const big = d ? [...d.game.plays].filter((p) => p.lead).slice(-3) : []
  const top = d ? [...d.game.lines].sort((x, y) => y.points - x.points)[0] : null
  const share = async () => {
    if (!d) return
    const lines = [
      `Dream matchup: ${joinNames(a.map(name))} against ${joinNames(b.map(name))}`,
      `${joinNames((fav === "A" ? a : b).map(name))} ${(fav === "A" ? a : b).length === 1 ? "wins" : "win"} ${pct(Math.max(d.chance, 1 - d.chance))} of the time.`,
      `One run: ${d.game.a} to ${d.game.b}${top ? `, ${name(top.id)} with ${top.points}` : ""}.`,
      `${SITE}#/games/dream/${dreamKey(a, b)}`,
    ]
    setSent(await shareText(lines.join("\n")))
    setTimeout(() => setSent(""), 2000)
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft />
        </Button>
        <h2 className="font-display text-2xl font-bold">Dream matchup</h2>
      </div>
      <p className="text-sm text-muted-foreground">Put anyone on either team. The chance comes from the same model as the live odds, and one game is played out trip by trip.</p>

      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {roster.map((p) => {
            const side = a.includes(p.id) ? "A" : b.includes(p.id) ? "B" : null
            return (
              <div key={p.id} className="flex items-center gap-2 py-0.5">
                <PlayerAvatar id={p.id} name={p.name} size="sm" />
                <span className={cn("min-w-0 flex-1 truncate text-sm", side && "font-semibold")}>{p.name}</span>
                <div className="flex rounded-md border p-0.5 text-sm" role="group" aria-label={`${p.name}'s team`}>
                  {(["A", "B"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={side === s}
                      onClick={() => set(p.id, side === s ? null : s)}
                      className={cn("min-h-9 min-w-11 rounded px-3 font-medium", side === s ? (s === "A" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground") : "text-muted-foreground")}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {!ready ? (
        <p className="text-sm text-muted-foreground">Put at least one player on each team.</p>
      ) : (
        d && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Who wins</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div className="flex items-baseline justify-between gap-2 font-display text-lg font-bold tabular-nums">
                  <span>Team A {pct(d.chance)}</span>
                  <span>Team B {pct(1 - d.chance)}</span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="bg-primary" style={{ width: pct(d.chance) }} />
                  <span className="bg-foreground/35" style={{ width: pct(1 - d.chance) }} />
                </div>
                <p>
                  {Math.abs(d.chance - 0.5) < 0.04
                    ? "A coin flip."
                    : `${joinNames((fav === "A" ? a : b).map(name))} ${(fav === "A" ? a : b).length === 1 ? "wins" : "win"} ${pct(Math.max(d.chance, 1 - d.chance))} of the time.`}
                  {a.length !== b.length && ` Team ${a.length > b.length ? "A" : "B"} has the extra player.`}
                </p>
                {d.factors.length > 0 && <p className="text-xs font-medium">Why, from the pre-game read (before the live odds soften it):</p>}
                {d.factors.length > 0 && (
                  <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {d.factors
                      .filter((f) => Math.abs(f.lean) >= 0.5)
                      .map((f) => (
                        <li key={f.label}>
                          {f.label}: leans Team {f.lean > 0 ? "A" : "B"} by {Math.abs(f.lean).toFixed(0)} points of win chance
                        </li>
                      ))}
                  </ul>
                )}
                {d.read === null && <p className="text-xs text-muted-foreground">The pre-game read has no history for these players yet, so it starts even.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>One game, played out</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="font-display text-2xl font-bold tabular-nums">
                  Team A {d.game.a}, Team B {d.game.b}
                </p>
                <p className="text-muted-foreground">
                  {d.game.leadChanges === 0 ? "Wire to wire." : `${d.game.leadChanges} lead ${d.game.leadChanges === 1 ? "change" : "changes"}.`}
                  {top ? ` ${name(top.id)} led everyone with ${top.points}.` : ""}
                </p>
                {big.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {big.map((p, i) => (
                      <li key={i}>
                        <button type="button" className="font-medium hover:underline" onClick={() => onOpenPlayer(p.scorer)}>
                          {name(p.scorer)}
                        </button>{" "}
                        hits a {p.points}
                        {p.passer ? ` off ${name(p.passer)}'s pass` : ""} to put Team {p.side} ahead, {Math.max(p.a, p.b)} to {Math.min(p.a, p.b)}.
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <BoxScore state={state} game={d.game} ids={a} label="Team A" />
                  <BoxScore state={state} game={d.game} ids={b} label="Team B" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setAgain((n) => n + 1)}>
                    <Dices aria-hidden /> Play it again
                  </Button>
                  <Button variant="outline" onClick={() => void share()}>
                    <Share2 aria-hidden /> {sent === "copied" ? "Copied" : sent === "failed" ? "Could not share" : "Share this matchup"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  One random game at those odds: each trip scores at its team's rate, a 2 or a 3 at the league's mix, and the scorer and passer are
                  drawn by each player's own makes and assists a game in filmed games (a player with few filmed games counts as closer to average).
                </p>
              </CardContent>
            </Card>
          </>
        )
      )}
    </div>
  )
}
