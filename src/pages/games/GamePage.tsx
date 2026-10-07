import { TEAM } from "@/lib/teamColors"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/EmptyState"
import { useEffect, useRef, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ClipboardPenLine, Play, Share2 } from "lucide-react"
import { shareGameCard } from "@/lib/shareCard"
import { GameVideoPanel } from "@/components/GameVideoPanel"
import { WatchContext, WatchTime } from "@/components/WatchTime"
import type { PlayerControl } from "@/components/YouTubePlayer"
import { JUMP_LEAD_SECONDS } from "@/lib/legacy-core"
import { gameVideoUrl } from "@/lib/video"
import { predictionNote } from "@/lib/scorecard"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { useReadOnly } from "@/lib/mode"
import type { Update } from "@/lib/store"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import {
  effectiveFgPct,
  formatVideoTime,
  gameDefenseStats,
  getGameStats,
  isBalancedGame,
  liveScoreOf,
  isLiveScoreOnly,
  pct,
  shootingStats,
  teamScore,
  trueShootingPct,
  twoWayScore,
  offensiveRating,
  defensiveRating,
} from "@/lib/stats"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

// Labels for the tags the classic site's Stat Entry shows (SHOT_TYPES / CONTEST_LEVELS /
// TURNOVER_TYPES in app.js).
const SHOT_TYPE_LABELS: Record<string, string> = {
  catchAndShoot: "Catch-and-shoot",
  deepHeave: "Deep heave",
  drive: "Drive",
  move: "Move",
  dunk: "Dunk",
}
const CONTEST_LABELS: Record<string, string> = { none: "No contest", light: "Light", medium: "Medium", heavy: "Heavy" }
const TURNOVER_TYPE_LABELS: Record<string, string> = {
  badPass: "Bad Pass",
  lostHandle: "Lost Handle",
  stripped: "Stripped",
  driveError: "Drive/Finish Error",
  decisionError: "Possession/Decision Error",
  other: "Other",
}

function names(state: PooleanState, ids: string[], fallback = "Team") {
  return ids.map((id) => playerName(state, id)).join(", ") || fallback
}

function fmtPct(v: number | null) {
  return v === null ? "-" : `${v}%`
}

function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">{title}</CardTitle>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function PlayerCell({ state, id }: { state: PooleanState; id: string }) {
  const name = playerName(state, id)
  return (
    <span className="flex items-center gap-2 font-medium">
      <PlayerAvatar id={id} name={name} size="sm" />
      {name}
    </span>
  )
}

function GameStats({ state, game }: { state: PooleanState; game: Game }) {
  const roster = [...game.teamA, ...game.teamB]
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Player</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>PTS</TableHead>
          <TableHead>OREB</TableHead>
          <TableHead>DREB</TableHead>
          <TableHead>AST</TableHead>
          <TableHead>STL</TableHead>
          <TableHead>BLK</TableHead>
          <TableHead>TOV</TableHead>
          <TableHead>PF</TableHead>
          <TableHead>FG</TableHead>
          <TableHead>3PT</TableHead>
          <TableHead>FT</TableHead>
          <TableHead>eFG%</TableHead>
          <TableHead>TS%</TableHead>
          <TableHead>Pts Allowed</TableHead>
          <TableHead>Opp FG%</TableHead>
          <TableHead>Beaten</TableHead>
          <TableHead>Stops</TableHead>
          <TableHead>Off</TableHead>
          <TableHead>Def</TableHead>
          <TableHead>Two-Way</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roster.map((id) => {
          const s = getGameStats(game, id)
          const sh = shootingStats(game, id)
          const def = gameDefenseStats(game, id)
          return (
            <TableRow key={id}>
              <TableCell>
                <PlayerCell state={state} id={id} />
              </TableCell>
              <TableCell className={game.teamA.includes(id) ? TEAM.A.text : TEAM.B.text}>{game.teamA.includes(id) ? "A" : "B"}</TableCell>
              <TableCell className="font-semibold tabular-nums">{s.pts}</TableCell>
              <TableCell>{s.oreb}</TableCell>
              <TableCell>{s.dreb}</TableCell>
              <TableCell>{s.ast}</TableCell>
              <TableCell>{s.stl}</TableCell>
              <TableCell>{s.blk}</TableCell>
              <TableCell>{s.tov}</TableCell>
              <TableCell>{s.pf}</TableCell>
              <TableCell>{sh.fgm}/{sh.fga}</TableCell>
              <TableCell>{sh.tpm}/{sh.tpa}</TableCell>
              <TableCell>{sh.ftm}/{sh.fta}</TableCell>
              <TableCell>{fmtPct(effectiveFgPct(sh.fgm, sh.tpm, sh.fga))}</TableCell>
              <TableCell>{fmtPct(trueShootingPct(s.pts, sh.fga, sh.fta))}</TableCell>
              <TableCell>{def.ptsAllowed}</TableCell>
              <TableCell>{fmtPct(pct(def.timesBeaten, def.timesBeaten + def.stops))}</TableCell>
              <TableCell>{def.timesBeaten}</TableCell>
              <TableCell>{def.stops}</TableCell>
              <TableCell className="tabular-nums">{signed(offensiveRating(s, sh))}</TableCell>
              <TableCell className="tabular-nums">{signed(defensiveRating(s, def))}</TableCell>
              <TableCell className="font-semibold tabular-nums">{signed(twoWayScore(s, sh, def))}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function ShotRow({ state, game, ev }: { state: PooleanState; game: Game; ev: ScoringEvent }) {
  const made = ev.made !== false
  const rebounder = ev.rebounderId
  const shotType = ev.dunk === true ? "dunk" : ev.shotType
  const sameTeam =
    rebounder &&
    ((game.teamA.includes(ev.scorerId) && game.teamA.includes(rebounder)) ||
      (game.teamB.includes(ev.scorerId) && game.teamB.includes(rebounder)))
  return (
    <TableRow>
      <TableCell>
        <PlayerCell state={state} id={ev.scorerId} />
      </TableCell>
      <TableCell className="whitespace-normal">
        <span className="flex flex-wrap gap-1">
          {made ? (
            <Badge className="bg-chart-2/15 text-chart-2">Make</Badge>
          ) : (
            <Badge variant="destructive">Miss</Badge>
          )}
          {ev.blockerId && <Badge variant="secondary">Blocked: {playerName(state, ev.blockerId)}</Badge>}
          {ev.turnoverEventId && <Badge variant="secondary">Out of bounds &rarr; TOV</Badge>}
          {rebounder && (
            <Badge variant="secondary">
              {sameTeam ? "OREB" : "DREB"}: {playerName(state, rebounder)}
            </Badge>
          )}
          {shotType && <Badge variant="secondary">{SHOT_TYPE_LABELS[shotType] ?? shotType}</Badge>}
          {ev.contestLevel && <Badge variant="secondary">{CONTEST_LABELS[ev.contestLevel]}</Badge>}
          {ev.shotLocation && <Badge variant="secondary">{ev.shotLocation.y >= 60 ? "3PT range" : "2PT range"}</Badge>}
        </span>
      </TableCell>
      <TableCell>{ev.points}</TableCell>
      <TableCell>{ev.assistId ? playerName(state, ev.assistId) : "-"}</TableCell>
      <TableCell>{ev.passerId && ev.passerId !== "none" ? playerName(state, ev.passerId) : "-"}</TableCell>
      <TableCell>{names(state, ev.defenderIds ?? [], "No defender")}</TableCell>
      <TableCell className="tabular-nums"><WatchTime t={ev.videoTime} /></TableCell>
    </TableRow>
  )
}

function ShotLog({ state, game }: { state: PooleanState; game: Game }) {
  if (game.scoringEvents.length === 0) return <EmptyState title="No shots recorded yet" hint="Log this game from film on the classic site and every shot shows up here." />
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Shooter</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Assist</TableHead>
          <TableHead>Passer</TableHead>
          <TableHead>Defender</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {game.scoringEvents.map((ev) => (
          <ShotRow key={ev.id} state={state} game={game} ev={ev} />
        ))}
      </TableBody>
    </Table>
  )
}

function OtherEvents({ state, game }: { state: PooleanState; game: Game }) {
  const rows = [
    ...game.turnoverEvents.map((ev) => ({
      verb: "Turnover",
      playerId: ev.playerId,
      opponentId: ev.opponentId,
      videoTime: ev.videoTime ?? null,
      note: [
        ev.stealEventId ? "via steal" : "",
        ev.missEventId ? "shot out of bounds" : "",
        ev.turnoverType ? TURNOVER_TYPE_LABELS[ev.turnoverType] ?? ev.turnoverType : "",
      ]
        .filter(Boolean)
        .join(", "),
      key: ev.id,
    })),
    ...game.stealEvents.map((ev) => ({ verb: "Steal", playerId: ev.playerId, opponentId: ev.opponentId, videoTime: ev.videoTime ?? null, note: "", key: ev.id })),
    ...game.foulEvents.map((ev) => ({ verb: "Foul", playerId: ev.playerId, opponentId: ev.opponentId, videoTime: ev.videoTime ?? null, note: "", key: ev.id })),
  ].sort((a, b) => {
    if (a.videoTime === null) return b.videoTime === null ? 0 : 1
    if (b.videoTime === null) return -1
    return a.videoTime - b.videoTime
  })
  if (rows.length === 0) return <EmptyState title="No turnovers, steals, or fouls yet" hint="Mark them while logging this game and they list here." />
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Player</TableHead>
          <TableHead>Opponent</TableHead>
          <TableHead>Detail</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key}>
            <TableCell>{r.verb}</TableCell>
            <TableCell>{playerName(state, r.playerId)}</TableCell>
            <TableCell>{r.opponentId ? playerName(state, r.opponentId) : "-"}</TableCell>
            <TableCell>{r.note || "-"}</TableCell>
            <TableCell className="tabular-nums"><WatchTime t={r.videoTime} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Reel({ state, game }: { state: PooleanState; game: Game }) {
  const rows = game.plays ?? []
  if (rows.length === 0) return <EmptyState title="No clips marked yet" hint="Mark a highlight or lowlight while logging this game and it lands here." />
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>End</TableHead>
          <TableHead>Player</TableHead>
          <TableHead>Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.id}>
            <TableCell>
              <Badge variant={p.type === "highlight" ? "default" : "destructive"}>
                {p.type === "highlight" ? "Highlight" : "Lowlight"}
              </Badge>
            </TableCell>
            <TableCell className="tabular-nums"><WatchTime t={p.start} end={p.end} /></TableCell>
            <TableCell className="tabular-nums">{formatVideoTime(p.end)}</TableCell>
            <TableCell>{p.playerId ? playerName(state, p.playerId) : "-"}</TableCell>
            <TableCell>{p.note || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TeamScore({ state, game, ids, label, score }: { state: PooleanState; game: Game; ids: string[]; label: string; score: number }) {
  void game
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <span className={cn("text-sm font-semibold", label === "Team A" ? TEAM.A.text : TEAM.B.text)}>{label}</span>
      <span className="font-display text-5xl font-bold tabular-nums">{score}</span>
      <div className="flex flex-wrap justify-center gap-2">
        {ids.map((id) => (
          <span key={id} className="flex items-center gap-1 text-sm">
            <PlayerAvatar id={id} name={playerName(state, id)} size="sm" />
            {playerName(state, id)}
          </span>
        ))}
      </div>
    </div>
  )
}

// Read-only version of the classic site's Stat Entry page for one game: scoreboard, everyone's
// line, the full shot log, turnovers/steals/fouls, defensive matchups, and the highlight reel.
// Editing (logging shots, assigning rosters) and the video player are not part of this app yet.
export function GamePage({ state, update, game, onBack, onStatEntry, autoSeek }: { state: PooleanState; update: Update; game: Game; onBack: () => void; onStatEntry?: () => void; autoSeek?: { time: number | null; n: number } | null }) {
  const readOnly = useReadOnly()
  const liveOnly = isLiveScoreOnly(game)
  const scoreA = liveOnly ? liveScoreOf(game, game.teamA) : teamScore(game, game.teamA)
  const scoreB = liveOnly ? liveScoreOf(game, game.teamB) : teamScore(game, game.teamB)
  const reviewed = game.scoringEvents.length > 0
  const control = useRef<PlayerControl | null>(null)
  const videoBox = useRef<HTMLDivElement>(null)
  const hasVideo = !!gameVideoUrl(state, game)
  // Event times are positions in the recording, so this plays from just before the moment.
  const clipTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  useEffect(() => () => clearInterval(clipTimer.current), [])
  // Plays one moment; with an end time it pauses there, and `then` runs when it does (to chain clips).
  const play = (t: number, end?: number, then?: () => void, exact = false) => {
    clearInterval(clipTimer.current)
    videoBox.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    // A tagged clip has its own start, so it begins exactly there; a single event starts a few seconds early.
    const lead = end === undefined && !exact ? JUMP_LEAD_SECONDS : 0
    control.current?.seek(Math.max(0, t - lead))
    if (end === undefined) return
    // Give the seek a moment to land, then watch the clock until the clip's end.
    const started = Date.now()
    clipTimer.current = setInterval(() => {
      const now = control.current?.time()
      if (now === undefined) return
      if ((now >= end && Date.now() - started > 800) || Date.now() - started > (end - t + 20) * 1000) {
        clearInterval(clipTimer.current)
        if (then) then()
        else control.current?.pause()
      }
    }, 250)
  }
  const watch = hasVideo ? (t: number, end?: number) => play(t, end) : null
  // Every tagged clip of this game, one after another.
  const playReel = () => {
    const clips = [...(game.plays ?? [])].sort((a, b) => a.start - b.start)
    const step = (i: number) => {
      if (i >= clips.length) return control.current?.pause()
      play(clips[i].start, clips[i].end, () => step(i + 1))
    }
    step(0)
  }
  // Opened from a "Jump" button elsewhere (a player's clips, play search): go to that moment once the video is ready.
  useEffect(() => {
    if (!autoSeek || autoSeek.time === null || !hasVideo) return
    let tries = 0
    const id = setInterval(() => {
      if (control.current || ++tries > 40) {
        clearInterval(id)
        // A Jump button names the exact moment, so start right there.
        if (control.current) play(autoSeek.time as number, undefined, undefined, true)
      }
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSeek?.n, hasVideo])

  return (
    <WatchContext.Provider value={watch}>
    <div className="anim-page flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          &larr; Back to Games
        </Button>
        <h2 className="font-display text-xl font-bold">{formatDateDisplay(game.date)}</h2>
        {game.notes && <span className="text-sm text-muted-foreground">{game.notes}</span>}
        {!readOnly && onStatEntry && (
          <Button size="sm" className="ml-auto" onClick={onStatEntry}>
            <ClipboardPenLine />
            Stat entry
          </Button>
        )}
        <Button size="sm" variant="outline" className={readOnly || !onStatEntry ? "ml-auto" : ""} onClick={() => void shareGameCard(state, game).catch(() => {})}>
          <Share2 aria-hidden />
          Share picture
        </Button>
        {game.stoppedEarly && <Badge variant="secondary">Stopped Early</Badge>}
        {!isBalancedGame(game) && (
          <Badge variant="secondary">
            {game.teamA.length}v{game.teamB.length}
          </Badge>
        )}
      </div>

      <Card>
        <CardContent className="flex items-center justify-around gap-4">
          <TeamScore state={state} game={game} ids={game.teamA} label="Team A" score={scoreA} />
          <span className="text-muted-foreground">vs.</span>
          <TeamScore state={state} game={game} ids={game.teamB} label="Team B" score={scoreB} />
        </CardContent>
      </Card>

      {predictionNote(game) && <p className="-mt-2 text-center text-sm text-muted-foreground">{predictionNote(game)}</p>}

      <div ref={videoBox}>
        <GameVideoPanel state={state} game={game} update={update} readOnly={readOnly} control={control} />
      </div>

      {!reviewed ? (
        <Card>
          <CardContent>
            <EmptyState title="No stats for this game yet" hint={readOnly ? "The box score fills in once the editor logs this game's shots." : "Open Stat entry to log its shots while you watch the video, and the box score fills in."} />
          </CardContent>
        </Card>
      ) : (
        <>
          <Panel
            title="Game Stats"
            hint="Everyone's line for this game, built from the shot log. eFG% and TS% measure scoring efficiency, Pts Allowed and Opp FG% show defense, and Two-Way adds offense and defense into one number."
          >
            <GameStats state={state} game={game} />
          </Panel>
          <Panel title="Shot Log" hint="Every shot, make or miss, with the defender and any assist.">
            <ShotLog state={state} game={game} />
          </Panel>
          <Panel title="Other Events" hint="Every turnover, steal, and foul, tagged with the opponent involved where noted.">
            <OtherEvents state={state} game={game} />
          </Panel>
          <Panel title="Highlight / Lowlight Reel">
            {hasVideo && (game.plays ?? []).length > 0 && (
              <Button size="sm" variant="outline" className="self-start" onClick={playReel}>
                <Play aria-hidden /> Play all clips
              </Button>
            )}
            <Reel state={state} game={game} />
          </Panel>
        </>
      )}
    </div>
    </WatchContext.Provider>
  )
}
