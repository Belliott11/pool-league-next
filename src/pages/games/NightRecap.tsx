import { Copy, Share2, Trophy } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/EmptyState"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateDisplay } from "@/lib/format"
import { gameDays, recapText, summarizeNight } from "@/lib/nightRecap"
import { playerName } from "@/lib/players"
import { shareNightCard } from "@/lib/shareCard"
import { TEAM } from "@/lib/teamColors"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// A day's games in one place: results, who led the night, and a picture or text to send around. Games scored
// live count with their points; games with a box score add rebounds, assists, steals and blocks.
export function NightRecap({ state, onBack, onOpenGame, onOpenPlayer, initialDate }: { state: PooleanState; onBack: () => void; onOpenGame: (id: string) => void; onOpenPlayer: (id: string) => void; initialDate?: string }) {
  const days = useMemo(() => gameDays(state), [state])
  const [date, setDate] = useState(initialDate && days.includes(initialDate) ? initialDate : (days[0] ?? ""))
  const [copied, setCopied] = useState(false)
  const s = useMemo(() => summarizeNight(state, date), [state, date])
  const label = formatDateDisplay(date)
  const name = (id: string) => playerName(state, id)
  const names = (ids: string[]) => ids.map(name).join(", ")
  const anyBox = s.players.some((p) => p.boxGames > 0)

  if (days.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="outline" size="sm" className="self-start" onClick={onBack}>
          &larr; Back to Games
        </Button>
        <EmptyState title="No games yet" hint="Once a game is played, its night shows up here." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          &larr; Back to Games
        </Button>
        <h2 className="font-display text-xl font-bold">Night recap</h2>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Which night">
          {days.map((d) => (
            <option key={d} value={d}>
              {formatDateDisplay(d)}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void shareNightCard(state, s, label).catch(() => {})}>
            <Share2 aria-hidden /> Share picture
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(recapText(state, s, label, name)).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1800)
              })
            }}
          >
            <Copy aria-hidden /> {copied ? "Copied" : "Copy text"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          ["Games", s.games.length],
          ["Points", s.totalPoints],
          ["Players", s.players.length],
        ].map(([k, v]) => (
          <Card key={k}>
            <CardContent className="py-4">
              <div className="font-display text-3xl font-bold tabular-nums">{v}</div>
              <div className="text-xs text-muted-foreground">{k}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-2" aria-label="Results">
        <h3 className="font-display text-lg font-bold">Results</h3>
        {s.games.map((g, i) => (
          <button key={g.id} type="button" onClick={() => onOpenGame(g.id)} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border bg-card p-3 text-left active:scale-[0.99]">
            <span className={cn("min-w-0 truncate text-sm", g.winner === "A" ? "font-semibold" : "text-muted-foreground")}>{names(g.teamA)}</span>
            <span className="flex flex-col items-center">
              <span className="font-display text-2xl font-bold tabular-nums">
                <span className={TEAM.A.text}>{g.scoreA}</span>
                <span className="px-1 text-muted-foreground">-</span>
                <span className={TEAM.B.text}>{g.scoreB}</span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                Game {i + 1}
                {g.live ? " · live" : g.liveOnly ? " · scored live" : ""}
              </span>
            </span>
            <span className={cn("min-w-0 truncate text-right text-sm", g.winner === "B" ? "font-semibold" : "text-muted-foreground")}>{names(g.teamB)}</span>
          </button>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        {s.topScorer && (
          <Badge variant="secondary" className="h-auto gap-1 px-3 py-1.5 text-sm">
            <Trophy aria-hidden className="size-3.5" /> Top scorer: {name(s.topScorer.id)}, {s.topScorer.pts}
          </Badge>
        )}
        {s.mostWins && (
          <Badge variant="secondary" className="h-auto px-3 py-1.5 text-sm">
            Most wins: {name(s.mostWins.id)}, {s.mostWins.wins}-{s.mostWins.losses}
          </Badge>
        )}
        {s.biggestWin && (
          <Badge variant="secondary" className="h-auto px-3 py-1.5 text-sm">
            Biggest win: {s.biggestWin.scoreA}-{s.biggestWin.scoreB}
          </Badge>
        )}
        {s.closest && (
          <Badge variant="secondary" className="h-auto px-3 py-1.5 text-sm">
            Closest: {s.closest.scoreA}-{s.closest.scoreB}
          </Badge>
        )}
      </div>

      {s.players.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Player lines">
          <h3 className="font-display text-lg font-bold">The night by player</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>W-L</TableHead>
                <TableHead>PTS</TableHead>
                <TableHead>Best</TableHead>
                {anyBox && (
                  <>
                    <TableHead>REB</TableHead>
                    <TableHead>AST</TableHead>
                    <TableHead>STL</TableHead>
                    <TableHead>BLK</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.players.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <button type="button" className="flex items-center gap-2 font-bold text-accent hover:underline" onClick={() => onOpenPlayer(p.id)}>
                      <PlayerAvatar id={p.id} name={name(p.id)} size="sm" />
                      {name(p.id)}
                    </button>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {p.wins}-{p.losses}
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">{p.pts}</TableCell>
                  <TableCell className="tabular-nums">{p.best}</TableCell>
                  {anyBox && (
                    <>
                      <TableCell className="tabular-nums">{p.boxGames ? p.reb : "-"}</TableCell>
                      <TableCell className="tabular-nums">{p.boxGames ? p.ast : "-"}</TableCell>
                      <TableCell className="tabular-nums">{p.boxGames ? p.stl : "-"}</TableCell>
                      <TableCell className="tabular-nums">{p.boxGames ? p.blk : "-"}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {anyBox && <p className="text-xs text-muted-foreground">Rebounds, assists, steals and blocks count only games with a box score; games scored live show points only.</p>}
        </section>
      )}
    </div>
  )
}
