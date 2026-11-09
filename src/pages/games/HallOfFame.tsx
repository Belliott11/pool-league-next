import { Crown } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/format"
import { bestGames, careerTable, longestStreaks, oldGames, pastMvps } from "@/lib/hallOfFame"
import { playerName } from "@/lib/players"
import { poolNameOf } from "@/lib/real"
import { RECORD_KEYS, RECORD_LABEL, recordBook } from "@/lib/records"
import { rivalries } from "@/lib/rivalries"
import { getClient } from "@/lib/cloud"
import { loadAllPredictions, pastSeasons, type PastSeason } from "@/lib/predictions"
import type { PooleanState } from "@/lib/types"

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

function Board({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-sm">
        {hint && <p className="mb-1 text-xs text-muted-foreground">{hint}</p>}
        {children}
      </CardContent>
    </Card>
  )
}

// One ranked row: place, avatar and name, and the value.
function Row({ i, state, id, value, sub, onOpenPlayer }: { i: number; state: PooleanState; id: string; value: string; sub?: string; onOpenPlayer: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 tabular-nums text-muted-foreground">{i + 1}</span>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline" onClick={() => onOpenPlayer(id)}>
        <PlayerAvatar id={id} name={playerName(state, id)} size="sm" />
        <span className="truncate font-medium">{playerName(state, id)}</span>
        {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
      </button>
      <span className="font-display font-bold tabular-nums">{value}</span>
    </div>
  )
}

// Everything all-time: career leaders, the best single games, records, streaks, rivalries and past MVPs.
export function HallOfFame({ state, onBack, onOpenPlayer, onOpenGame }: { state: PooleanState; onBack: () => void; onOpenPlayer: (id: string) => void; onOpenGame: (id: string) => void }) {
  const data = useMemo(
    () => ({
      career: careerTable(state, Infinity),
      bestPts: bestGames(state, "pts"),
      bestTw: bestGames(state, "twoWay"),
      book: recordBook(state),
      streaks: longestStreaks(state),
      rivals: rivalries(state, 5, oldGames()),
      mvps: pastMvps(),
    }),
    [state],
  )
  // Past seasons' preseason picks, scored on how each season went. Needs the shared data; quietly empty without it.
  const [called, setCalled] = useState<PastSeason[]>([])
  useEffect(() => {
    const client = getClient()
    if (client) void loadAllPredictions(client).then((all) => setCalled(pastSeasons(state, all)))
  }, [state])
  return (
    <div className="anim-page flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          &larr; Back to Games
        </Button>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Crown aria-hidden className="size-5 text-gold" /> Hall of fame
        </h2>
      </div>

      {data.mvps.length > 0 && (
        <Board title="MVP" hint="Each past season's voted MVP.">
          {data.mvps.map((m) => (
            <div key={m.season} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{m.season}</span>
              <span className="font-semibold">{m.ids.map((id) => poolNameOf(state, id)).join(" and ")}</span>
            </div>
          ))}
        </Board>
      )}

      {called.length > 0 && (
        <Board title="Called it" hint="Each season's best predictions.">
          {called.map((c) => (
            <div key={c.season} className="flex flex-col gap-0.5 border-t pt-1.5 first:border-t-0 first:pt-0">
              <span className="text-xs text-muted-foreground">Season starting {formatDateDisplay(c.season)}</span>
              {c.picks && (
                <span>
                  Best predictions: <span className="font-semibold">{playerName(state, c.picks.voter)}</span>, {c.picks.points} points
                </span>
              )}
            </div>
          ))}
        </Board>
      )}

      <Board title="Careers" hint="Most games first. Games and wins count every result, including games from the old site. Points and two-way only exist for games played in the app.">
        <div className="grid grid-cols-[1fr_repeat(4,2.75rem)] items-center gap-x-2 gap-y-1.5">
          <span />
          {["GP", "W", "PTS", "2W"].map((h) => (
            <span key={h} className="text-right text-xs text-muted-foreground">
              {h}
            </span>
          ))}
          {data.career.map((c) => (
            <div key={c.id} className="contents">
              <button type="button" className="flex min-w-0 items-center gap-2 text-left hover:underline" onClick={() => onOpenPlayer(c.id)}>
                <PlayerAvatar id={c.id} name={playerName(state, c.id)} size="sm" />
                <span className="truncate font-medium">{playerName(state, c.id)}</span>
              </button>
              <span className="text-right tabular-nums">{c.gp}</span>
              <span className="text-right tabular-nums">{c.w}</span>
              <span className="text-right tabular-nums">{c.hasPts ? c.pts : "-"}</span>
              <span className="text-right tabular-nums">{c.hasTwoWay ? c.twoWay.toFixed(1) : "-"}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">GP games, W wins, PTS points, 2W two-way total (box-scored games only).</p>
      </Board>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { title: "Best scoring games", rows: data.bestPts, unit: "pts" },
          { title: "Best two-way games", rows: data.bestTw, unit: "two-way" },
        ].map((b) => (
          <Board key={b.title} title={b.title}>
            {b.rows.map((g, i) => (
              <div key={`${g.gameId}-${g.id}`} className="flex items-center gap-2">
                <span className="w-5 tabular-nums text-muted-foreground">{i + 1}</span>
                <button type="button" className="min-w-0 flex-1 truncate text-left font-medium hover:underline" onClick={() => onOpenGame(g.gameId)}>
                  {playerName(state, g.id)} <span className="text-xs font-normal text-muted-foreground">{formatDateDisplay(g.date)}</span>
                </button>
                <span className="font-display font-bold tabular-nums">
                  {fmt(g.value)} <span className="text-xs font-normal text-muted-foreground">{b.unit}</span>
                </span>
              </div>
            ))}
          </Board>
        ))}
      </div>

      <Board title="All-time records" hint="The most anyone has done in a single game.">
        {RECORD_KEYS.filter((k) => data.book[k]).map((k) => {
          const r = data.book[k]!
          return (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{RECORD_LABEL[k]}</span>
              <button type="button" className="min-w-0 flex-1 truncate text-right font-medium hover:underline" onClick={() => onOpenGame(r.gameId)}>
                {playerName(state, r.playerId)} <span className="text-xs font-normal text-muted-foreground">{formatDateDisplay(r.date)}</span>
              </button>
              <span className="w-12 text-right font-display font-bold tabular-nums">{fmt(r.value)}</span>
            </div>
          )
        })}
      </Board>

      <div className="grid gap-4 sm:grid-cols-2">
        <Board title="Longest win streaks" hint="Every result, including the old site's games that were never filmed.">
          {data.streaks.map((s, i) => (
            <Row key={s.id} i={i} state={state} id={s.id} value={String(s.n)} sub={`ended ${formatDateDisplay(s.end)}`} onOpenPlayer={onOpenPlayer} />
          ))}
        </Board>
        <Board title="Biggest rivalries" hint="Every result, including games from the old site.">
          {data.rivals.length === 0 && <p className="text-muted-foreground">Pairs need 4 meetings to count.</p>}
          {data.rivals.map((r) => (
            <div key={r.a + r.b} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                {playerName(state, r.a)} <span className="text-muted-foreground">v</span> {playerName(state, r.b)}
              </span>
              <span className="font-display font-bold tabular-nums">
                {r.aWins}-{r.bWins}
              </span>
            </div>
          ))}
        </Board>
      </div>
    </div>
  )
}
