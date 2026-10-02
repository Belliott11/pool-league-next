import { ArrowLeft, Undo2 } from "lucide-react"
import { useRef, useState } from "react"
import { EmptyState } from "@/components/EmptyState"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateDisplay } from "@/lib/format"
import { JUMP_LEAD_SECONDS, TIMESTAMP_LEAD_SECONDS } from "@/lib/legacy-core"
import { playerName } from "@/lib/players"
import { getGameStats, teamScore } from "@/lib/stats"
import { deleteEvent, isDirectVideoUrl, lastEvent, setStoppedEarly, undoLast, type EventRef } from "@/lib/statEntry"
import type { Update } from "@/lib/store"
import type { Game, PooleanState } from "@/lib/types"
import { EventForm, type Apply, type Draft } from "./EventForm"
import { EventLog } from "./EventLog"

const ADD: { kind: Draft["kind"]; label: string }[] = [
  { kind: "shot", label: "Add shot" },
  { kind: "tov", label: "Add turnover" },
  { kind: "stl", label: "Add steal" },
  { kind: "pf", label: "Add foul" },
]

export function StatEntryPage({ state, game, update, onBack }: { state: PooleanState; game: Game; update: Update; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const direct = isDirectVideoUrl(game.videoUrl)
  const scoreA = teamScore(game, game.teamA)
  const scoreB = teamScore(game, game.teamB)

  // Apply to the latest copy of this game so quick successive taps never use a stale prop.
  const apply: Apply = (fn) => {
    try {
      setError(null)
      update((s) => ({ ...s, games: s.games.map((g) => (g.id === game.id ? fn(g) : g)) }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that change.")
    }
  }

  const captureTime = () => (direct && videoRef.current ? Math.max(0, videoRef.current.currentTime - TIMESTAMP_LEAD_SECONDS) : null)
  const seek = (t: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, t - JUMP_LEAD_SECONDS)
    void v.play().catch(() => {})
  }
  const remove = (r: EventRef) => {
    apply((g) => deleteEvent(g, r))
    if (draft?.edit?.ev.id === r.id) setDraft(null)
  }

  if (game.teamA.length + game.teamB.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Button type="button" variant="ghost" className="h-11 self-start px-3" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
        <EmptyState title="No players on this game yet" hint="Assign both rosters before logging stats." />
      </div>
    )
  }

  return (
    <div data-no-swipe className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Button type="button" variant="ghost" className="h-11 self-start px-3" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{formatDateDisplay(game.date)}</h2>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <Switch checked={game.stoppedEarly === true} onCheckedChange={(v) => apply((g) => setStoppedEarly(g, v))} aria-label="Game was stopped early" />
            Stopped early
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3" aria-label="Score">
          {[
            { label: "Team A", score: scoreA, other: scoreB },
            { label: "Team B", score: scoreB, other: scoreA },
          ].map((t) => (
            <div key={t.label} className={`rounded-xl border p-3 text-center ${t.score > t.other ? "bg-primary text-primary-foreground" : "bg-card"}`}>
              <p className="text-xs opacity-80">{t.label}</p>
              <p className="font-display text-3xl font-semibold tabular-nums">{t.score}</p>
            </div>
          ))}
        </div>
      </div>

      {direct ? (
        <video ref={videoRef} src={game.videoUrl} controls playsInline preload="metadata" className="max-h-[40vh] w-full rounded-xl bg-muted" />
      ) : (
        <EmptyState
          title={game.videoUrl ? "This video link is not a direct file" : "No video for this game"}
          hint="Event times can't be captured automatically. Type the time (m:ss) into each event, or leave it blank."
          action={
            game.videoUrl ? (
              <a href={game.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                Open the video in a new tab
              </a>
            ) : undefined
          }
        />
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ADD.map((a) => (
          <Button key={a.kind} type="button" variant={draft?.kind === a.kind && !draft.edit ? "default" : "outline"} className="h-12 text-base" onClick={() => setDraft({ kind: a.kind })}>
            {a.label}
          </Button>
        ))}
      </div>
      <Button type="button" variant="outline" className="h-11" disabled={!lastEvent(game)} onClick={() => apply(undoLast)}>
        <Undo2 /> Undo last
      </Button>
      {error && (
        <p role="alert" className="text-sm text-neg">
          {error}
        </p>
      )}

      {draft && (
        <EventForm
          key={draft.edit ? draft.edit.kind + draft.edit.ev.id : `new-${draft.kind}`}
          state={state}
          game={game}
          draft={draft}
          captureTime={captureTime}
          hasVideo={direct}
          onSave={apply}
          onClose={() => setDraft(null)}
        />
      )}

      <EventLog
        state={state}
        game={game}
        canSeek={direct}
        onSeek={seek}
        onEdit={(e) => {
          setDraft({ kind: e.kind, edit: e })
          window.scrollTo({ top: 0, behavior: "smooth" })
        }}
        onDelete={remove}
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Box score</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="px-1">Player</TableHead>
                {["PTS", "OREB", "DREB", "AST", "STL", "BLK", "TOV", "PF"].map((h) => (
                  <TableHead key={h} className="px-1 text-center">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[game.teamA, game.teamB].flatMap((team, i) =>
                team.map((id) => {
                  const s = getGameStats(game, id)
                  return (
                    <TableRow key={id} className={i === 1 ? "bg-muted/30" : undefined}>
                      <TableCell className="max-w-20 truncate px-1 font-medium">{playerName(state, id)}</TableCell>
                      {[s.pts, s.oreb, s.dreb, s.ast, s.stl, s.blk, s.tov, s.pf].map((v, j) => (
                        <TableCell key={j} className={`px-1 text-center tabular-nums ${j === 0 ? "font-semibold" : ""}`}>
                          {v}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                }),
              )}
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">Team A on top, Team B shaded. Totals come from the logged events.</p>
        </CardContent>
      </Card>
    </div>
  )
}
