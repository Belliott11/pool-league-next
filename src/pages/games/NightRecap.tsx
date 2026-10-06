import { ChevronDown, ChevronUp, Copy, Share2, Trophy } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/EmptyState"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useReadOnly } from "@/lib/mode"
import { isLiveScoreOnly } from "@/lib/stats"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateDisplay } from "@/lib/format"
import { LEADER_LABEL, gameDays, recapText, summarizeNight, type LeaderKey, type NightPlayer } from "@/lib/nightRecap"
import { predictRealMatchup } from "@/lib/matchup"
import { RECORD_KEYS, RECORD_LABEL, nightCallouts, recordBook } from "@/lib/records"
import { StoryList } from "@/components/StoryList"
import { nightStories } from "@/lib/storylines"
import { useLabeledState } from "@/lib/labelsContext"
import { usePublishedNight } from "@/lib/published"
import type { Update } from "@/lib/store"
import { playerName } from "@/lib/players"
import { shareNightCard } from "@/lib/shareCard"
import { TEAM } from "@/lib/teamColors"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

type SortKey = "player" | "wl" | "pts" | "best" | "reb" | "ast" | "stl" | "blk" | "twoWay"

// What each column sorts by. Stats that need a box score sink to the bottom for players without one.
function sortValue(p: NightPlayer, key: SortKey, name: (id: string) => string): number | string {
  switch (key) {
    case "player":
      return name(p.id).toLowerCase()
    case "wl":
      return (p.wins - p.losses) * 1000 + p.wins
    case "pts":
      return p.pts
    case "best":
      return p.best
    default:
      return p.boxGames ? p[key] : Number.NEGATIVE_INFINITY
  }
}

// A day's games in one place: results, who led the night, and a picture or text to send around. Games scored
// live count with their points; games with a box score add rebounds, assists, steals and blocks.
export function NightRecap({ state, update, onBack, onOpenGame, onStatEntry, onOpenPlayer, initialDate }: { state: PooleanState; update?: Update; onBack: () => void; onOpenGame: (id: string) => void; onStatEntry?: (id: string) => void; onOpenPlayer: (id: string) => void; initialDate?: string }) {
  const readOnly = useReadOnly()
  const labeled = useLabeledState(state)
  const days = useMemo(() => gameDays(state), [state])
  const [date, setDate] = useState(initialDate && days.includes(initialDate) ? initialDate : (days[0] ?? ""))
  const [copied, setCopied] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "pts", dir: "desc" })
  const full = useMemo(() => summarizeNight(state, date), [state, date])
  // Two versions. Right after live scoring there are only points, so the quick recap sticks to results, points and
  // wins. Once the shots are entered from film the full recap adds MVP, leaders, lineups and records.
  const liveOnly = state.games.filter((g) => g.date === date && !g.liveInProgress && isLiveScoreOnly(g))
  const hasBox = full.players.some((p) => p.boxGames > 0)
  const [pick, setPick] = useState<"quick" | "full" | null>(null)
  const quick = (pick ?? (hasBox ? "full" : "quick")) === "quick"
  const s = useMemo(() => (quick ? { ...full, mvp: null } : full), [full, quick])
  const allCallouts = useMemo(() => nightCallouts(state, date), [state, date])
  const callouts = useMemo(() => (quick ? allCallouts.filter((c) => c.key === "pts") : allCallouts), [allCallouts, quick])
  const book = useMemo(() => recordBook(state), [state])
  // Both versions are written here with the editor's private labels, and saved with the night so visitors read the
  // finished lines instead of writing their own (they have no labels).
  const written = useMemo(() => {
    const nm = (id: string) => playerName(state, id)
    const predict = (a: string[], b: string[]) => predictRealMatchup(a, b)
    return {
      quick: nightStories(labeled, { ...full, mvp: null }, allCallouts.filter((c) => c.key === "pts"), nm, predict),
      full: nightStories(labeled, full, allCallouts, nm, predict),
    }
  }, [labeled, state, full, allCallouts])
  const published = usePublishedNight(state, update, date, written)
  const stories = quick ? published.quick : published.full
  const label = formatDateDisplay(date)
  const name = (id: string) => playerName(state, id)
  const names = (ids: string[]) => ids.map(name).join(", ")
  const anyBox = !quick && hasBox
  const rows = useMemo(() => {
    const sign = sort.dir === "asc" ? 1 : -1
    return [...s.players].sort((a, b) => {
      const x = sortValue(a, sort.key, name)
      const y = sortValue(b, sort.key, name)
      const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)
      // Ties keep the usual order: points, then wins.
      return c * sign || b.pts - a.pts || b.wins - a.wins
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.players, sort, state])
  const head = (key: SortKey, label: string) => (
    <TableHead aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-0.5 font-medium hover:text-foreground"
        onClick={() => setSort((cur) => (cur.key === key ? { key, dir: cur.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "player" ? "asc" : "desc" }))}
      >
        {label}
        {sort.key === key && (sort.dir === "desc" ? <ChevronDown aria-hidden className="size-3.5" /> : <ChevronUp aria-hidden className="size-3.5" />)}
      </button>
    </TableHead>
  )

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
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={date} onChange={(e) => {
            setDate(e.target.value)
            setPick(null)
          }} aria-label="Which night">
          {days.map((d) => (
            <option key={d} value={d}>
              {formatDateDisplay(d)}
            </option>
          ))}
        </select>
        <div className="flex rounded-md border p-0.5 text-sm" role="group" aria-label="Which recap">
          {(["quick", "full"] as const).map((v) => (
            <button
              key={v}
              type="button"
              disabled={v === "full" && !hasBox}
              aria-pressed={(v === "quick") === quick}
              onClick={() => setPick(v)}
              className={cn("rounded px-3 py-1 font-medium disabled:opacity-40", (v === "quick") === quick ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              {v === "quick" ? "Quick" : "Full"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void shareNightCard(state, s, label).catch(() => {})}>
            <Share2 aria-hidden /> Share picture
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(recapText(s, label, name, stories)).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1800)
              })
            }}
          >
            <Copy aria-hidden /> {copied ? "Copied" : "Copy text"}
          </Button>
        </div>
      </div>

      {!hasBox && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Quick recap: points from live scoring. Enter the stats from the game videos and the full recap adds MVP, leaders, lineups and records.
        </p>
      )}
      {hasBox && quick && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Quick recap: results and points only. Switch to Full for MVP, leaders, lineups and records.</p>
      )}
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

      {!readOnly && onStatEntry && liveOnly.length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4" aria-label="Add stats">
          <p className="min-w-0 flex-1 text-sm">
            {liveOnly.length === 1 ? "One game from this night has only live scores." : `${liveOnly.length} games from this night have only live scores.`} Add the stats and video to unlock MVP, leaders and records.
          </p>
          <Button size="sm" onClick={() => onStatEntry(liveOnly[0].id)}>
            Add stats and video
          </Button>
        </section>
      )}

      {stories.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-label="Storylines">
          <h3 className="font-display text-lg font-bold">The story of the night</h3>
          <StoryList stories={stories} />
        </section>
      )}

      {!quick && s.mvp && (
        <section className="rounded-xl border-2 border-accent bg-accent/10 p-4" aria-label="Night MVP">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Night MVP</p>
          <button type="button" className="mt-1 flex items-center gap-3 text-left" onClick={() => onOpenPlayer(s.mvp!.id)}>
            <PlayerAvatar id={s.mvp.id} name={name(s.mvp.id)} />
            <span>
              <span className="font-display text-2xl font-bold">{name(s.mvp.id)}</span>
              <span className="block text-sm text-muted-foreground">
                Total two-way score {s.mvp.twoWay.toFixed(1)} over {s.mvp.boxGames} game{s.mvp.boxGames === 1 ? "" : "s"}: {s.mvp.pts} pts, {s.mvp.reb} reb, {s.mvp.ast} ast, {s.mvp.stl} stl, {s.mvp.blk} blk
              </span>
            </span>
          </button>
        </section>
      )}

      {!quick && Object.values(s.leaders).some((l) => l.length > 0) && (
        <section className="flex flex-col gap-2" aria-label="Leaders">
          <h3 className="font-display text-lg font-bold">Leaders</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(LEADER_LABEL) as LeaderKey[])
              .filter((k) => s.leaders[k].length > 0)
              .map((k) => (
                <div key={k} className="rounded-xl border bg-card p-3">
                  <p className="text-xs font-medium text-muted-foreground">{LEADER_LABEL[k]}</p>
                  <ol className="mt-1 flex flex-col gap-0.5 text-sm">
                    {s.leaders[k].map((p, i) => (
                      <li key={p.id} className="flex justify-between gap-2">
                        <span className={cn("truncate", i === 0 && "font-semibold")}>{name(p.id)}</span>
                        <span className="tabular-nums">{p[k]}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
          </div>
        </section>
      )}

      {!quick && (s.duos.length > 0 || s.trios.length > 0) && (
        <section className="flex flex-col gap-2" aria-label="Lineups">
          <h3 className="font-display text-lg font-bold">Best lineups</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {[["Duos", s.duos], ["Trios", s.trios]].map(([title, rows]) => (
              <div key={title as string} className="rounded-xl border bg-card p-3">
                <p className="text-xs font-medium text-muted-foreground">{title as string}</p>
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {(rows as typeof s.duos).map((l) => (
                    <li key={l.ids.join("|")} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate">{l.ids.map(name).join(" + ")}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {l.wins}-{l.games - l.wins}, {l.pf - l.pa >= 0 ? "+" : ""}
                        {((l.pf - l.pa) / l.games).toFixed(1)}/g
                      </span>
                    </li>
                  ))}
                  {(rows as typeof s.duos).length === 0 && <li className="text-muted-foreground">Not enough games.</li>}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {!quick && Object.keys(book).length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Record book">
          <h3 className="font-display text-lg font-bold">League records</h3>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <tbody>
                {RECORD_KEYS.filter((k) => book[k]).map((k) => {
                  const r = book[k]!
                  const tonight = callouts.some((c) => c.key === k && (c.kind === "record" || c.kind === "tied") && c.playerId === r.playerId) && r.date === date
                  return (
                    <tr key={k} className="border-b last:border-b-0">
                      <td className="px-3 py-2 text-muted-foreground">{RECORD_LABEL[k]}</td>
                      <td className="px-3 py-2 font-display font-bold tabular-nums">{Number.isInteger(r.value) ? r.value : r.value.toFixed(1)}</td>
                      <td className="px-3 py-2">{name(r.playerId)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDateDisplay(r.date)}</td>
                      <td className="px-3 py-2">{tonight && <Badge>New</Badge>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {s.players.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Player lines">
          <h3 className="font-display text-lg font-bold">The night by player</h3>
          <Table>
            <TableHeader>
              <TableRow>
                {head("player", "Player")}
                {head("wl", "W-L")}
                {head("pts", "PTS")}
                {head("best", "Best")}
                {anyBox && (
                  <>
                    {head("reb", "REB")}
                    {head("ast", "AST")}
                    {head("stl", "STL")}
                    {head("blk", "BLK")}
                    {head("twoWay", "2-WAY")}
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
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
                      <TableCell className="tabular-nums">{p.boxGames ? p.twoWay.toFixed(1) : "-"}</TableCell>
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
