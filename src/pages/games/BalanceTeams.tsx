import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BUILD_LABELS,
  computeBalanceQualityMap,
  computeChemistryLiftMap,
  computeCrossTeamMatchups,
  computeCrossTeamRivalryWarnings,
  computeTeamWinRateMap,
  EFFORT_LABELS,
  formatHeightIn,
  generateBalancedTeamSets,
  getPlayerPhysicalData,
  PHYSICAL_ROLE_LABELS,
  teamChemistryAdjustment,
  teamWinRateAdjustment,
  type BalanceOption,
} from "@/lib/balance"
import { formatDateDisplay, uid } from "@/lib/format"
import { predictRealMatchup, predictTeamWinChances, getRealMatchupModel, realMatchupAccuracyText } from "@/lib/matchup"
import { playerName } from "@/lib/players"
import { poolNameOf } from "@/lib/real"
import { newGame, type Update } from "@/lib/store"
import { pct } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"
import { nativeSelect } from "./GameLog"

export function AttendeeChips({
  state,
  selected,
  onToggle,
  mark,
}: {
  state: PooleanState
  selected: string[]
  onToggle: (id: string) => void
  mark?: Record<string, { text: string; title: string }>
}) {
  const players = [...state.players].sort((a, b) => a.name.localeCompare(b.name))
  if (players.length === 0) return <p className="text-sm text-muted-foreground">No players yet.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => (
        <Button
          key={p.id}
          type="button"
          size="sm"
          variant={selected.includes(p.id) ? "default" : "outline"}
          title={mark?.[p.id]?.title}
          onClick={() => onToggle(p.id)}
        >
          {p.name}
          {mark?.[p.id]?.text ?? ""}
        </Button>
      ))}
    </div>
  )
}

function TeamCard({
  state,
  team,
  index,
  option,
  winProb,
  liftMap,
  winRateMap,
  qualityMap,
}: {
  state: PooleanState
  team: string[]
  index: number
  option: BalanceOption
  winProb: number | undefined
  liftMap: ReturnType<typeof computeChemistryLiftMap>
  winRateMap: ReturnType<typeof computeTeamWinRateMap>
  qualityMap: ReturnType<typeof computeBalanceQualityMap>
}) {
  const phys = team.map((id) => getPlayerPhysicalData(state, id))
  const avg = (vals: (number | undefined)[]) => {
    const known = vals.filter((v): v is number => v !== undefined)
    return known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : null
  }
  const h = avg(phys.map((p) => p?.heightIn))
  const b = avg(phys.map((p) => p?.build))
  const e = avg(phys.map((p) => p?.effort))
  const roleCounts: Record<string, number> = {}
  phys.forEach((p) => (p?.roles || []).forEach((r) => (roleCounts[r] = (roleCounts[r] || 0) + 1)))
  const avgText = [
    h !== null ? `Avg height: ${formatHeightIn(h)}` : "",
    b !== null ? `Avg build: ${BUILD_LABELS[Math.round(b)]}` : "",
    e !== null ? `Avg effort: ${EFFORT_LABELS[Math.round(e)]}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
  const chem = teamChemistryAdjustment(team, liftMap)
  const win = teamWinRateAdjustment(team, winRateMap)
  const model = getRealMatchupModel()
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg border p-3 min-w-44">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-bold">Team {String.fromCharCode(65 + index)}</span>
        <span className="flex items-center gap-2 text-sm">
          <span className="tabular-nums">{option.avgs[index].toFixed(1)} avg</span>
          {winProb !== undefined && (
            <Badge
              variant="secondary"
              title={model ? `Matchup Predictor, trained on ${model.n} real games. ${realMatchupAccuracyText(model)}` : ""}
            >
              {Math.round(winProb * 100)}% win
            </Badge>
          )}
        </span>
      </div>
      <ul className="text-sm">
        {team.map((id) => {
          const p = getPlayerPhysicalData(state, id)
          const title = p
            ? `${formatHeightIn(p.heightIn)}, ${BUILD_LABELS[p.build]}, ${p.effort !== undefined ? EFFORT_LABELS[p.effort] + " effort, " : ""}${p.roles.map((r) => PHYSICAL_ROLE_LABELS[r]).join("/")}`
            : undefined
          return (
            <li key={id} title={title}>
              {playerName(state, id)}
              {qualityMap[id]?.source === "reputation" ? " *" : ""}
            </li>
          )
        })}
      </ul>
      {(avgText || Object.keys(roleCounts).length > 0) && (
        <div className="text-xs text-muted-foreground">
          {avgText && <div>{avgText}</div>}
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(roleCounts).map(([role, count]) => (
              <Badge key={role} variant="secondary">
                {count} {PHYSICAL_ROLE_LABELS[role]}
                {count > 1 ? "s" : ""}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {Math.abs(chem.value) >= 0.1 && (
        <div className="text-xs text-muted-foreground" title="Average Two-Way/20 lift from real past games with these specific teammates, already included in the avg above.">
          Chemistry: {chem.value >= 0 ? "+" : ""}
          {chem.value.toFixed(1)}
          {chem.minGp !== null ? ` (min ${chem.minGp} game${chem.minGp === 1 ? "" : "s"} together)` : ""}
        </div>
      )}
      {Math.abs(win.value) >= 0.1 && (
        <div className="text-xs text-muted-foreground" title="Two-Way/20-scale adjustment from this pairing's actual win rate in past games together, already included in the avg above.">
          Past record: {win.value >= 0 ? "+" : ""}
          {win.value.toFixed(1)}
          {win.minGp !== null ? ` (min ${win.minGp} game${win.minGp === 1 ? "" : "s"} together${win.anyReal ? ", real site record" : ""})` : ""}
        </div>
      )}
    </div>
  )
}

function MatchupPreview({ state, teamA, teamB }: { state: PooleanState; teamA: string[]; teamB: string[] }) {
  const rows = computeCrossTeamMatchups(state, teamA, teamB)
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No head-to-head history between these two teams yet.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Scorer</TableHead>
          <TableHead>Defender</TableHead>
          <TableHead>FG</TableHead>
          <TableHead>FG%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={`${r.scorerId}|${r.defenderId}`}>
            <TableCell>{playerName(state, r.scorerId)}</TableCell>
            <TableCell>{playerName(state, r.defenderId)}</TableCell>
            <TableCell>
              {r.fgm}/{r.fga}
            </TableCell>
            <TableCell>{pct(r.fgm, r.fga)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function OptionCard({
  state,
  option,
  index,
  anyEstimated,
  liftMap,
  winRateMap,
  qualityMap,
  date,
  onUse,
}: {
  state: PooleanState
  option: BalanceOption
  index: number
  anyEstimated: boolean
  liftMap: ReturnType<typeof computeChemistryLiftMap>
  winRateMap: ReturnType<typeof computeTeamWinRateMap>
  qualityMap: ReturnType<typeof computeBalanceQualityMap>
  date: string
  onUse: (a: string[], b: string[]) => void
}) {
  const [preview, setPreview] = useState(false)
  const winProbs = predictTeamWinChances(option.teams)
  const realPred = option.teams.length === 2 && winProbs ? predictRealMatchup(option.teams[0], option.teams[1]) : null
  const warnings = computeCrossTeamRivalryWarnings(option.teams)
  void anyEstimated
  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 ${index === 0 ? "border-accent" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong className="font-display">{index === 0 ? "Most Balanced" : `Option ${index + 1}`}</strong>
        <span className="text-sm text-muted-foreground">
          {realPred ? `Predicted ${Math.round(realPred.pA * 100)}% / ${100 - Math.round(realPred.pA * 100)}% · ` : ""}
          &Delta;{option.spread.toFixed(1)} Two-Way/20 between strongest and weakest team
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {option.teams.map((team, ti) => (
          <TeamCard
            key={ti}
            state={state}
            team={team}
            index={ti}
            option={option}
            winProb={winProbs?.[ti]}
            liftMap={liftMap}
            winRateMap={winRateMap}
            qualityMap={qualityMap}
          />
        ))}
      </div>
      {warnings.map((w) => (
        <div key={`${w.dominant}|${w.dominated}`} className="text-sm" title="Real Poolean site record, not this app's own logged games.">
          {poolNameOf(state, w.dominant)} is {w.w}-{w.l} against {poolNameOf(state, w.dominated)} in real games, on opposite teams tonight
        </div>
      ))}
      {option.teams.length === 2 && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreview((v) => !v)}>
            {preview ? "Hide Matchups" : "Preview Matchups"}
          </Button>
          <Button size="sm" disabled={!date} title={date ? undefined : "Pick a game date first"} onClick={() => onUse(option.teams[0], option.teams[1])}>
            Use These Teams &rarr; Create Game
          </Button>
        </div>
      )}
      {preview && option.teams.length === 2 && <MatchupPreview state={state} teamA={option.teams[0]} teamB={option.teams[1]} />}
    </div>
  )
}

export function BalanceTeams({
  state,
  update,
  attendees,
  setAttendees,
  onCreated,
}: {
  state: PooleanState
  update: Update
  attendees: string[]
  setAttendees: (ids: string[]) => void
  onCreated: (g: Game) => void
}) {
  const [teamSize, setTeamSize] = useState(3)
  const [results, setResults] = useState<BalanceOption[]>([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const rsvps = [...(state.rsvps ?? [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""))
  const [rsvpId, setRsvpId] = useState("")
  const qualityMap = computeBalanceQualityMap(state)
  const anyEstimated = Object.values(qualityMap).some((v) => v.source === "reputation")

  const mark: Record<string, { text: string; title: string }> = {}
  state.players.forEach((p) => {
    const q = qualityMap[p.id]
    mark[p.id] = {
      text: q.source === "reputation" ? " *" : "",
      title:
        q.source === "stats"
          ? `${q.quality.toFixed(1)} season Two-Way/20`
          : q.source === "reputation"
            ? `No stats yet: estimated from a ${q.avgPercentile}th percentile power ranking (${q.parties} part${q.parties === 1 ? "y" : "ies"}), not logged film`
            : "No stats or power ranking data: counted as a below-average unknown",
    }
  })

  const liftMap = computeChemistryLiftMap(state, attendees)
  const winRateMap = computeTeamWinRateMap(state, attendees)

  function generate() {
    setResults(generateBalancedTeamSets(state, attendees, Math.max(1, teamSize || 3)))
  }

  function useTeams(a: string[], b: string[]) {
    const game = newGame({ id: uid("game"), date, teamA: [...a], teamB: [...b] })
    update((s) => ({ ...s, games: [...s.games, game] }))
    onCreated(game)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Balance Teams</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick who&apos;s here and get the fairest splits. Teams are ranked by the Matchup Predictor&apos;s odds when it has enough real
          games, otherwise by each team&apos;s average Two-Way/20 (nudged by real chemistry and past record), with height, build, effort
          and role only as a tiebreak.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select className={nativeSelect} value={rsvpId} disabled={rsvps.length === 0} onChange={(e) => setRsvpId(e.target.value)}>
            {rsvps.length === 0 ? (
              <option value="">No RSVPs saved yet</option>
            ) : (
              <>
                <option value="">Pick an RSVP&hellip;</option>
                {rsvps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatDateDisplay(r.date)} ({r.playerIds.length})
                  </option>
                ))}
              </>
            )}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!rsvpId}
            onClick={() => {
              const entry = rsvps.find((r) => r.id === rsvpId)
              if (entry) setAttendees(entry.playerIds.filter((id) => state.players.some((p) => p.id === id)))
            }}
          >
            Use These RSVPs
          </Button>
        </div>
        <AttendeeChips
          state={state}
          selected={attendees}
          mark={mark}
          onToggle={(id) => setAttendees(attendees.includes(id) ? attendees.filter((x) => x !== id) : [...attendees, id])}
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1">
            Team size
            <Input type="number" min={1} className="w-20" value={teamSize} onChange={(e) => setTeamSize(parseInt(e.target.value, 10) || 0)} />
          </label>
          <label className="flex items-center gap-1">
            Game date
            <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <Button size="sm" disabled={attendees.length < 2} onClick={generate}>
            Generate Balanced Teams
          </Button>
        </div>
        {results.map((r, i) => (
          <OptionCard
            key={i}
            state={state}
            option={r}
            index={i}
            anyEstimated={anyEstimated}
            liftMap={liftMap}
            winRateMap={winRateMap}
            qualityMap={qualityMap}
            date={date}
            onUse={useTeams}
          />
        ))}
        {results.length > 0 && anyEstimated && (
          <p className="text-xs text-muted-foreground">
            * No stats yet: quality estimated from real power-ranking reputation (hover a name above for the percentile), not logged film.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
