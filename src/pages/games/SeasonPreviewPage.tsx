import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Share2 } from "lucide-react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/cloud"
import { formatDateLong, formatTime, signed } from "@/lib/format"
import { goalDef, goalSeason, loadGoals, type Goal } from "@/lib/goals"
import { playerName } from "@/lib/players"
import { jumpPicks } from "@/lib/predictions"
import { MIN_PARTIES, seasonPreview, storyline } from "@/lib/seasonPreview"
import { shareText } from "@/lib/shareText"
import { SITE } from "@/lib/site"
import type { PooleanState } from "@/lib/types"
import { Countdown } from "./Countdown"
import { usePredictions } from "./Predictions"

// The season preview at #/games/preview (src/lib/seasonPreview.ts): opening night, then every regular's story going in. Linked from the
// off-season home, the Explore grid and search.

export function SeasonPreviewPage({ state, onBack, onOpenPlayer }: { state: PooleanState; onBack: () => void; onOpenPlayer: (id: string) => void }) {
  const rows = useMemo(() => seasonPreview(state), [state])
  const p = usePredictions(state)
  const votes = useMemo(() => new Map(jumpPicks(p.entries).map((r) => [r.id, r.votes])), [p.entries])
  const [goals, setGoals] = useState<Goal[]>([])
  useEffect(() => {
    const c = getClient()
    if (c) void loadGoals(c, goalSeason(state)).then(setGoals)
  }, [state])
  const [sent, setSent] = useState("")
  const name = (id: string) => playerName(state, id)
  const goalOf = (id: string) => {
    const g = goals.filter((x) => x.player === id).sort((a, b) => a.slot - b.slot)[0]
    return g ? goalDef(g.goal)!.label(g.target).replace(/^./, (c) => c.toLowerCase()) : undefined
  }
  const o = state.openingNight
  const share = async () => {
    const lines = [
      o ? `Poolean Intel season preview: opening night ${formatDateLong(o.date)}${o.time ? `, ${formatTime(o.time)}` : ""}` : "Poolean Intel season preview",
      "",
      ...rows.slice(0, 6).map((r) => `${name(r.id)}: ${storyline(r, name, { jumpVotes: votes.get(r.id), goal: goalOf(r.id) })}`),
      "",
      `${SITE}#/games/preview`,
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
        <h2 className="font-display text-2xl font-bold">Season preview</h2>
      </div>
      {o && (
        <div className="flex flex-col gap-1 rounded-xl border-2 border-accent/60 bg-card p-4">
          <p className="text-sm text-muted-foreground">Opening night</p>
          <p className="font-display text-xl font-bold">
            {formatDateLong(o.date)}
            {o.time && <span className="text-muted-foreground">, {formatTime(o.time)}</span>}
          </p>
          <Countdown date={o.date} time={o.time} className="font-display text-lg font-bold tabular-nums text-accent" />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Everyone who came to {MIN_PARTIES} or more parties last summer, most parties first: last summer at a glance, and what they bring into this one.
      </p>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
            <button type="button" className="flex items-center gap-3 text-left" onClick={() => onOpenPlayer(r.id)}>
              <PlayerAvatar id={r.id} name={name(r.id)} />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-bold hover:underline">{name(r.id)}</span>
                <span className="block text-sm">{storyline(r, name, { jumpVotes: votes.get(r.id), goal: goalOf(r.id) })}</span>
              </span>
            </button>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
              {r.record && (
                <div>
                  <dt className="text-xs text-muted-foreground">Last summer</dt>
                  <dd className="tabular-nums">
                    {r.record[0]}-{r.record[1]}, {r.parties} parties
                  </dd>
                </div>
              )}
              {r.ppg !== null && (
                <div>
                  <dt className="text-xs text-muted-foreground">Points a game</dt>
                  <dd className="tabular-nums">
                    {r.ppg.toFixed(1)} <span className="text-xs text-muted-foreground">({r.filmed} filmed)</span>
                  </dd>
                </div>
              )}
              {r.form !== null && (
                <div>
                  <dt className="text-xs text-muted-foreground">Form going in</dt>
                  <dd className="tabular-nums">{signed(r.form)} a game</dd>
                </div>
              )}
              {r.partner && (
                <div>
                  <dt className="text-xs text-muted-foreground">Best with</dt>
                  <dd>
                    {name(r.partner.id)} <span className="text-xs text-muted-foreground">({r.partner.why})</span>
                  </dd>
                </div>
              )}
            </dl>
            {r.awards.length > 0 && <p className="text-xs text-muted-foreground">Voted last summer: {r.awards.join(", ")}</p>}
          </li>
        ))}
      </ul>
      <Button variant="outline" className="self-start" onClick={() => void share()}>
        <Share2 aria-hidden /> {sent === "copied" ? "Copied" : sent === "failed" ? "Could not share" : "Share the preview"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Last summer's record, parties and power-ranking nights come from Adam's Poolean results; points, form and partners from the filmed games.
        Form is Points added a game going in. Jump picks and goals are what people set on their own phones.
      </p>
    </div>
  )
}
