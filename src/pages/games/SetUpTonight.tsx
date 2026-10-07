import { EmptyState } from "@/components/EmptyState"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PlayerChips, toggleId } from "@/components/PlayerChips"
import { formatDateDisplay, uid } from "@/lib/format"
import { playerName } from "@/lib/players"
import { pregamePrediction } from "@/lib/scorecard"
import { newGame, type Update } from "@/lib/store"
import type { Game, PooleanState } from "@/lib/types"

function playerAttendedDate(state: PooleanState, playerId: string, date: string) {
  return state.games.some(
    (g) => g.date === date && (g.teamA.includes(playerId) || g.teamB.includes(playerId)),
  )
}

function WhosComing({ state, update }: { state: PooleanState; update: Update }) {
  const [date, setDate] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const rsvps = [...(state.rsvps ?? [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""))

  function pickDate(next: string) {
    setDate(next)
    setSelected(state.rsvps?.find((r) => r.date === next)?.playerIds ?? [])
  }

  function save() {
    if (!date) {
      alert("Pick a date first.")
      return
    }
    update((s) => {
      const list = [...(s.rsvps ?? [])]
      const i = list.findIndex((r) => r.date === date)
      // Saving with nobody checked deletes the entry for that date instead of storing an empty one.
      if (selected.length === 0) {
        if (i !== -1) list.splice(i, 1)
      } else if (i !== -1) {
        list[i] = { ...list[i], playerIds: selected }
      } else {
        list.push({ id: uid("rsvp"), date, playerIds: selected })
      }
      return { ...s, rsvps: list }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Who&apos;s Coming?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input type="date" className="w-44" value={date} onChange={(e) => pickDate(e.target.value)} />
        <PlayerChips state={state} selected={selected} onToggle={(id) => setSelected(toggleId(selected, id))} />
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>
            Save RSVPs
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear This Date
          </Button>
        </div>
        {rsvps.length === 0 ? (
          <EmptyState title="No RSVPs saved yet" hint="Pick who is playing above and save, and the night shows up here." />
        ) : (
          <div className="flex flex-col gap-2">
            {rsvps.map((r) => {
              const hasGame = state.games.some((g) => g.date === r.date)
              const missed = r.playerIds.filter((id) => !playerAttendedDate(state, id, r.date))
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {formatDateDisplay(r.date)}: {r.playerIds.map((id) => playerName(state, id)).join(", ") || "nobody"}
                    {!hasGame ? (
                      <Badge variant="secondary">Pending: no game logged yet</Badge>
                    ) : missed.length === 0 ? (
                      <Badge className="bg-chart-2/15 text-chart-2">Everyone showed</Badge>
                    ) : (
                      <Badge variant="destructive">
                        {missed.length} missed: {missed.map((id) => playerName(state, id)).join(", ")}
                      </Badge>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update((s) => ({ ...s, rsvps: (s.rsvps ?? []).filter((x) => x.id !== r.id) }))}
                  >
                    Delete
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TeamPicker({
  state,
  label,
  selected,
  disabled,
  onToggle,
}: {
  state: PooleanState
  label: string
  selected: string[]
  disabled: string[]
  onToggle: (id: string) => void
}) {
  const available = { ...state, players: state.players.filter((p) => !disabled.includes(p.id)) }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <PlayerChips state={available} selected={selected} onToggle={onToggle} />
    </div>
  )
}

// The classic site's Create Game only takes date/video/notes and assigns teams later in Stat
// Entry. Stat Entry isn't part of this app, so teams are picked here instead; leave both empty to
// get the classic behavior.
function CreateGame({ state, update, onCreated }: { state: PooleanState; update: Update; onCreated: (g: Game) => void }) {
  const [date, setDate] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [teamA, setTeamA] = useState<string[]>([])
  const [teamB, setTeamB] = useState<string[]>([])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const game = newGame({ id: uid("game"), date, videoUrl: videoUrl.trim(), notes: notes.trim(), teamA, teamB, prediction: pregamePrediction(teamA, teamB) })
    update((s) => ({ ...s, games: [...s.games, game] }))
    setDate("")
    setVideoUrl("")
    setNotes("")
    setTeamA([])
    setTeamB([])
    onCreated(game)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Create Game</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="flex flex-wrap gap-2">
            <Input type="date" required className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input
              className="min-w-56 flex-1"
              placeholder="Video URL (YouTube or direct link, optional)"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <Input className="min-w-40 flex-1" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <TeamPicker state={state} label="Team A" selected={teamA} disabled={teamB} onToggle={(id) => setTeamA(toggleId(teamA, id))} />
          <TeamPicker state={state} label="Team B" selected={teamB} disabled={teamA} onToggle={(id) => setTeamB(toggleId(teamB, id))} />
          <div>
            <Button type="submit">Create Game</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function SetUpTonight({ state, update, onCreated }: { state: PooleanState; update: Update; onCreated: (g: Game) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <WhosComing state={state} update={update} />
      <CreateGame state={state} update={update} onCreated={onCreated} />
    </div>
  )
}
