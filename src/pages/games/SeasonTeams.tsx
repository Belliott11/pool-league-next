import { useMemo, useState } from "react"
import { Shield, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/EmptyState"
import { TeamChip } from "@/components/TeamChip"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { allTimeRecord } from "@/lib/debate"
import { formatDateDisplay } from "@/lib/format"
import { useReadOnly } from "@/lib/mode"
import { playerName } from "@/lib/players"
import { captainOrder, currentSet, draftPick, MIN_COUNTED, movePlayer, newSet, nextNewcomerTeam, undoMove, onTheClock, putSet, RIVALRY_WEIGHT, standings, teamStrength, THIN_NIGHTS, undoPick, type TeamLine } from "@/lib/seasonTeams"
import { powerOf } from "@/lib/matchup"
import type { Update } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { Game, PooleanState, SeasonTeamSet } from "@/lib/types"

// Season teams (#/games/teams): standings, each team's members and what they added, team of the night and rivalry games. The editor
// sets the teams up here and runs the captains' draft (src/lib/seasonTeams.ts has the scoring).

const one = (v: number) => `${v < -0.005 ? "−" : ""}${Math.abs(v).toFixed(2)}`
const signed = (v: number) => `${v > 0.005 ? "+" : v < -0.005 ? "−" : ""}${Math.abs(v).toFixed(1)}`

// ---------- setup ----------

function Setup({ state, update }: { state: PooleanState; update: Update }) {
  const [from, setFrom] = useState(state.openingNight?.date ?? state.currentSeasonStartedAt ?? new Date().toLocaleDateString("en-CA"))
  const [count, setCount] = useState(4)
  const [teams, setTeams] = useState<{ name: string; captain: string | null }[]>(Array.from({ length: 6 }, () => ({ name: "", captain: null })))
  const players = [...state.players].sort((a, b) => a.name.localeCompare(b.name))
  const shown = teams.slice(0, count)
  const captains = shown.map((t) => t.captain).filter(Boolean)
  const ok = captains.length === count && new Set(captains).size === count
  const set = (i: number, patch: Partial<{ name: string; captain: string | null }>) => setTeams(teams.map((t, k) => (k === i ? { ...t, ...patch } : t)))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Set up season teams</CardTitle>
        <p className="text-sm text-muted-foreground">Name the teams and pick a captain for each. The captains then draft everyone else in snake order, with the weakest captain picking first.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <label className="flex items-center justify-between gap-3">
          <span className="font-medium">Teams</span>
          <select className="h-10 rounded-md border bg-background px-2" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium">Counts games from</span>
            <span className="block text-xs text-muted-foreground">Usually opening night.</span>
          </span>
          <Input type="date" className="h-10 w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        {shown.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <Input className="h-10 min-w-0 flex-1" placeholder={`Team ${i + 1} name`} aria-label={`Team ${i + 1} name`} value={t.name} onChange={(e) => set(i, { name: e.target.value })} />
            <select className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2" aria-label={`Team ${i + 1} captain`} value={t.captain ?? ""} onChange={(e) => set(i, { captain: e.target.value || null })}>
              <option value="">Captain</option>
              {players.map((p) => (
                <option key={p.id} value={p.id} disabled={captains.includes(p.id) && t.captain !== p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ))}
        {ok && (
          <p className="text-xs text-muted-foreground">
            Draft order, weakest captain first by power ranking: {captainOrder(shown, (id) => playerName(state, id)).map((t, i) => `${i + 1}. ${playerName(state, t.captain!)}`).join(", ")}. The
            snake then reverses, so the strongest captain also picks first in round two.
          </p>
        )}
        <Button disabled={!ok || !from} onClick={() => update((s) => putSet(s, newSet(from, captainOrder(shown, (id) => playerName(state, id)))))}>
          Start the draft
        </Button>
        {!ok && <p className="text-xs text-muted-foreground">Each team needs its own captain.</p>}
      </CardContent>
    </Card>
  )
}

// ---------- the draft ----------

function Draft({ state, set, update, readOnly }: { state: PooleanState; set: SeasonTeamSet; update: Update; readOnly: boolean }) {
  const clock = onTheClock(set)
  const taken = new Set(set.teams.flatMap((t) => t.members))
  // Most games first, so the regulars are at the top of the board.
  const pool = useMemo(
    () =>
      state.players
        .filter((p) => !taken.has(p.id))
        .map((p) => ({ p, games: allTimeRecord(p.id)[0] + allTimeRecord(p.id)[1], power: powerOf(p.id) }))
        .sort((a, b) => (b.power ?? -1) - (a.power ?? -1) || b.games - a.games || a.p.name.localeCompare(b.p.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.players, set],
  )
  const picks = set.teams.reduce((k, t) => k + t.members.length - (t.captain ? 1 : 0), 0)
  const save = (next: SeasonTeamSet) => update((s) => putSet(s, next))
  const strength = teamStrength(set)
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">The draft</CardTitle>
          <p className="text-sm text-muted-foreground">
            {clock ? (
              <>
                On the clock: <TeamChip team={clock} />
                {clock.captain ? ` (${playerName(state, clock.captain)} picks)` : ""}. Pick {picks + 1}.
              </>
            ) : (
              "Everyone has been picked."
            )}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {!readOnly && pool.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Players still to pick">
              {pool.map(({ p, games, power }) => (
                <li key={p.id}>
                  <Button size="sm" variant="outline" onClick={() => save(draftPick(set, p.id))}>
                    {p.name}
                    <span className="text-xs text-muted-foreground">{power !== null ? `${Math.round(power)} rank, ` : ""}{games} games</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {readOnly && <p className="text-muted-foreground">The editor is running the draft. Picks show up here as they happen.</p>}
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!picks} onClick={() => save(undoPick(set))}>
                <Undo2 aria-hidden /> Undo last pick
              </Button>
              <Button size="sm" onClick={() => save({ ...set, drafting: false })}>
                Finish the draft
              </Button>
              <Button size="sm" variant="ghost" className="text-neg" onClick={() => confirm("Throw away these teams and start over?") && update((s) => ({ ...s, seasonTeamSets: (s.seasonTeamSets ?? []).filter((x) => x.id !== set.id) }))}>
                Start over
              </Button>
            </div>
          )}
          {strength && (
            <p className="text-xs text-muted-foreground">
              The percentage on each team is its chance of beating the other teams if they played each other, from the same model as the pre-game odds. Even teams sit near 50%. Mid-round, the teams that have
              just picked have an extra player, so judge it at the end of each round, and use the last picks to close any gap.
            </p>
          )}
          {!readOnly && <p className="text-xs text-muted-foreground">Players who are not picked simply have no season team. Finish whenever the picks you want are in.</p>}
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {set.teams.map((t) => (
          <Card key={t.id} className={cn(clock?.id === t.id && "border-foreground")}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 font-display">
                <TeamChip team={t} />
                {strength?.has(t.id) && <span className="text-sm font-normal tabular-nums text-muted-foreground">{Math.round(strength.get(t.id)! * 100)}%</span>}
              </CardTitle>
              {strength?.has(t.id) && (
                <div role="img" aria-label={`${t.name}: ${Math.round(strength.get(t.id)! * 100)}% chance against the other teams`} className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full" style={{ width: `${Math.round(strength.get(t.id)! * 100)}%`, background: t.color }} />
                </div>
              )}
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-1 text-sm">
                {t.members.map((m, i) => (
                  <li key={m} className="flex items-center gap-2">
                    <span className="w-5 text-right tabular-nums text-muted-foreground">{i + 1}.</span>
                    <PlayerAvatar id={m} name={playerName(state, m)} size="sm" />
                    {playerName(state, m)}
                    {m === t.captain && <span className="text-xs text-muted-foreground">captain</span>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ---------- standings ----------

const today = () => new Date().toLocaleDateString("en-CA")

// Newcomers join the team lowest in the standings (ties to the team with fewer players), counting from the day they join.
function Newcomers({ state, set, editor, update, when }: { state: PooleanState; set: SeasonTeamSet; editor: boolean; update: Update; when: string }) {
  const next = useMemo(() => nextNewcomerTeam(state, set), [state, set])
  const [pid, setPid] = useState("")
  const onTeam = new Set(set.teams.flatMap((t) => t.members))
  const free = state.players.filter((p) => !onTeam.has(p.id)).sort((a, b) => a.name.localeCompare(b.name))
  if (!next) return null
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <p>
        Next newcomer joins <TeamChip team={next} />
        <span className="text-muted-foreground">, the team lowest in the standings (ties go to the team with fewer players).</span>
      </p>
      {editor && free.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2" aria-label="Newcomer" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">Pick a player not on a team</option>
            {free.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!pid}
            onClick={() => {
              update((s) => putSet(s, movePlayer(set, pid, next.id, when)))
              setPid("")
            }}
          >
            Add to {next.name}
          </Button>
        </div>
      )}
    </div>
  )
}

function TeamCard({ state, line, rank, onOpenPlayer, editor, set, update, when }: { state: PooleanState; line: TeamLine; rank: number; onOpenPlayer: (id: string) => void; editor: boolean; set: SeasonTeamSet; update: Update; when: string }) {
  // A trade: the editor moves a player to another team from the chosen date. Their earlier nights stay with this team.
  const move = (pid: string, to: string) => update((s) => putSet(s, movePlayer(set, pid, to || null, when)))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 font-display">
          <span>
            <span className="mr-2 text-muted-foreground tabular-nums">{rank}.</span>
            <TeamChip team={line.team} />
          </span>
          <span className="font-display text-lg tabular-nums">{one(line.score)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Nights</TableHead>
              <TableHead className="text-right">Wins</TableHead>
              <TableHead className="text-right">Wins added</TableHead>
              <TableHead className="text-right">A game</TableHead>
              <TableHead className="text-right">Counted</TableHead>
              {editor && <TableHead>Move</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {line.members.map((m) => (
              <TableRow key={m.id} className={cn(!m.current && "text-muted-foreground")}>
                <TableCell>
                  <button className="underline-offset-2 hover:underline" onClick={() => onOpenPlayer(m.id)}>
                    {playerName(state, m.id)}
                  </button>
                  {m.id === line.team.captain && <span className="ml-1 text-xs text-muted-foreground">captain</span>}
                  {!m.current && <span className="ml-1 text-xs">moved on</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.nights}
                  <span className="block text-xs text-muted-foreground">{m.games} {m.games === 1 ? "game" : "games"}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{m.wins}</TableCell>
                <TableCell className="text-right tabular-nums">{signed(m.winsAdded)}</TableCell>
                <TableCell className="text-right tabular-nums">{m.nights ? one(m.score) : "-"}</TableCell>
                <TableCell className="text-right tabular-nums">{m.nights ? `${m.counted} of ${m.nights}` : "-"}</TableCell>
                {editor && (
                  <TableCell>
                    {m.current && <select className="h-8 rounded-md border bg-background px-1 text-xs" aria-label={`Move ${playerName(state, m.id)}`} value={line.team.id} onChange={(e) => move(m.id, e.target.value)}>
                      {set.teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                      <option value="">Off the teams</option>
                    </select>}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function Standings({ state, set, onOpenPlayer, onOpenGame, editor, update }: { state: PooleanState; set: SeasonTeamSet; onOpenPlayer: (id: string) => void; onOpenGame: (id: string) => void; editor: boolean; update: Update }) {
  const s = useMemo(() => standings(state, set), [state, set])
  const tonight = s.nights.at(-1)
  const [when, setWhen] = useState(today())
  const teamName = (id: string | null) => (id ? (set.teams.find((t) => t.id === id)?.name ?? "a team") : null)
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Standings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Counting games from {formatDateDisplay(set.from)}
            {set.to ? ` to ${formatDateDisplay(set.to)}` : ""}. {s.games} {s.games === 1 ? "game" : "games"} so far.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">A game</TableHead>
                <TableHead className="text-right">Wins</TableHead>
                <TableHead className="text-right">Wins added</TableHead>
                <TableHead className="text-right">Rivalry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.rows.map((r, i) => (
                <TableRow key={r.team.id} className={cn(r.nights < THIN_NIGHTS && "italic")}>
                  <TableCell>
                    <span className="mr-1.5 tabular-nums text-muted-foreground">{i + 1}.</span>
                    <TeamChip team={r.team} />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {r.nights ? one(r.score) : "-"}
                    <span className="block text-xs font-normal text-muted-foreground">
                      there {r.nights} of {r.allNights}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.wins}</TableCell>
                  <TableCell className="text-right tabular-nums">{signed(r.winsAdded)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.rivalry[0] + r.rivalry[1] ? `${r.rivalry[0]}-${r.rivalry[1]}` : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Each night a player plays, they score their game wins plus their Wins added (filmed games), per game they played, so a long night counts the
            same as a short one. Each team counts the average of its best few players that night, the same
            number for every team: the fewest any team had there, but at least {MIN_COUNTED}. A team with fewer there than that gets a bench night ({one(s.bench)}, the bottom
            quarter of all player-nights) for each empty spot, so sending one star alone never helps. So a big roster does not decide it, an off night never hurts, and
            extra players are depth. Every night counts for every team: a team with nobody there gets a bench night for each spot, so coming is never
            worse than staying home. A team's score is the average of its nights. Rivalry games, where the two pickup teams are two whole season teams, count{" "}
            {RIVALRY_WEIGHT === 2 ? "double" : `${RIVALRY_WEIGHT} times`}. Nights stay with the team a player was on that night. Italic rows have fewer than {THIN_NIGHTS} nights.
          </p>
          {tonight?.scores[0] && (
            <p>
              Team of the night, {formatDateDisplay(tonight.date)}: <TeamChip team={tonight.scores[0].team} /> ({one(tonight.scores[0].score)} a game, best {tonight.counted} counted).
            </p>
          )}
          <Newcomers state={state} set={set} editor={editor} update={update} when={when} />
        </CardContent>
      </Card>
      {(editor || (set.moves ?? []).length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Trades and newcomers</CardTitle>
            <p className="text-sm text-muted-foreground">Every move since the draft. Nights before a move stay with the team the player was on.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {editor && (
              <label className="flex flex-wrap items-center gap-2">
                <span>Moves take effect from</span>
                <Input type="date" className="h-9 w-auto" value={when} onChange={(e) => setWhen(e.target.value || today())} />
              </label>
            )}
            {(set.moves ?? []).length ? (
              <ul className="flex flex-col gap-1">
                {[...(set.moves ?? [])].reverse().map((m, i) => (
                  <li key={`${m.pid}|${m.date}|${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1 odd:bg-muted/50">
                    <span>
                      <span className="tabular-nums text-muted-foreground">{formatDateDisplay(m.date)}:</span> <span className="font-semibold">{playerName(state, m.pid)}</span>
                      {m.from ? `, ${teamName(m.from)} to ${teamName(m.to) ?? "off the teams"}` : ` joins ${teamName(m.to)}`}
                    </span>
                    {editor && i === 0 && (
                      <Button size="sm" variant="ghost" onClick={() => update((st) => putSet(st, undoMove(set)))}>
                        <Undo2 aria-hidden /> Undo
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No moves yet. Pick a date above, then use Move on a team card or add a newcomer.</p>
            )}
          </CardContent>
        </Card>
      )}
      {s.rivalries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Rivalry games</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {[...s.rivalries].reverse().map((r) => (
                <li key={r.game.id}>
                  <button type="button" onClick={() => onOpenGame(r.game.id)} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted">
                    <span>{formatDateDisplay(r.game.date)}</span>
                    <span>
                      <TeamChip team={r.winner} /> beat <TeamChip team={r.winner.id === r.a.id ? r.b : r.a} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col gap-3">
        {s.rows.map((r, i) => (
          <TeamCard key={r.team.id} state={state} line={r} rank={i + 1} onOpenPlayer={onOpenPlayer} editor={editor} set={set} update={update} when={when} />
        ))}
      </div>
    </div>
  )
}

export function SeasonTeamsPage({ state, update, onBack, onOpenPlayer, onOpenGame }: { state: PooleanState; update: Update; onBack: () => void; onOpenPlayer: (id: string) => void; onOpenGame: (g: Game) => void }) {
  const readOnly = useReadOnly()
  const set = currentSet(state)
  const openGame = (id: string) => {
    const g = state.games.find((x) => x.id === id)
    if (g) onOpenGame(g)
  }
  return (
    <div className="anim-page flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          &larr; Back to Games
        </Button>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Shield aria-hidden className="size-5" /> Season teams
        </h2>
      </div>
      {!set ? (
        readOnly ? (
          <EmptyState title="No season teams yet" hint="Once the captains draft them, the season teams and their standings show up here." />
        ) : (
          <Setup state={state} update={update} />
        )
      ) : set.drafting ? (
        <Draft state={state} set={set} update={update} readOnly={readOnly} />
      ) : (
        <Standings state={state} set={set} onOpenPlayer={onOpenPlayer} onOpenGame={openGame} editor={!readOnly} update={update} />
      )}
    </div>
  )
}
