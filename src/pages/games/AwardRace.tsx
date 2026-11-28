import { Medal } from "lucide-react"
import { useMemo } from "react"
import { ClipButton } from "@/components/ClipTile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { awardRace, shownAwards } from "@/lib/awardRace"
import { awardOdds, ODDS_KEYS, type OddsKey } from "@/lib/awardOdds"
import { isOffseason } from "@/lib/offseason"
import { useReadOnly } from "@/lib/mode"
import { projectSeason } from "@/lib/projections"
import { bestClips, clipKey, type Clip } from "@/lib/clips"
import { playerName } from "@/lib/players"
import { MIN_GAMES as MIN_RANKED } from "@/lib/ratings"
import type { PooleanState } from "@/lib/types"

const RUNS_TEXT = "4,000 times"
const AFTER = 6 // nights played out between seasons, for "had the season kept going"
const SHOWN = 4
const pct = (p: number) => (p >= 0.995 ? "99%+" : p < 0.005 ? "under 1%" : `${Math.round(p * 100)}%`)
const MIN_TEXT = `${MIN_RANKED} games`

// Who leads each award so far this season, from this season's own games.
export function AwardRaceCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const all = useMemo(() => shownAwards(awardRace(state)), [state]) // races with fewer than three in them are left out
  // Projected finish, editors only (odds on who wins are a lot to put in front of the people being ranked; kept that way 2026-11-28): each
  // player's chance of leading the measured awards once the season's nights are played (awardOdds.ts), or between seasons had it run
  // AFTER more nights, plus the projected vote and the next points milestones (projections.ts).
  const visitor = useReadOnly()
  const over = isOffseason(state)
  const odds = useMemo(() => {
    if (visitor) return null
    const now = awardOdds(state)
    if (!now) return null
    return now.nightsLeft > 0 && !over ? now : awardOdds(state, { planned: now.nightsPlayed + AFTER })
  }, [state, visitor, over])
  const live = odds && odds.nightsLeft > 0 ? odds : null
  const proj = useMemo(() => (visitor ? null : projectSeason(state, 20)), [state, visitor])
  const voteOf = (key: string) => {
    const rows = key === "mvp" ? proj?.mvp : key === "dpoy" ? proj?.defender : undefined
    if (!rows || rows.length < 2) return null
    return [...rows].sort((a, b) => b.vote - a.vote).filter((r) => r.vote >= 0.01).slice(0, 3).map((r) => `${playerName(state, r.id)} ${pct(r.vote)}`).join(", ") || "too close to call"
  }
  // The leader's best play, when a recording has one, so an award can be seen as well as read.
  const clipOf = useMemo(() => {
    // Defense awards show a stop, the rest a bucket, and no play is used twice on the page.
    const used = new Set<string>()
    const out = new Map<string, Clip>()
    for (const r of all) {
      const l = r.leaders[0]
      if (!l || l.ids.length !== 1) continue
      const stops = /def|steal|block|stop/i.test(`${r.key} ${r.label}`)
      const c = bestClips(state, { pid: l.ids[0], limit: 1, skip: used, kinds: stops ? ["block", "steal"] : ["dunk", "three", "beat", "shot"] })[0] ?? bestClips(state, { pid: l.ids[0], limit: 1, skip: used })[0]
      if (!c) continue
      used.add(clipKey(c))
      out.set(`${r.key}|${l.ids[0]}`, c)
    }
    return out
  }, [all, state])
  if (all.length === 0) return null
  const rows = all
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Medal aria-hidden className="size-4 text-gold" /> Season award race
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((r) => (
          <section key={r.key} aria-label={r.label} className="flex flex-col gap-0.5">
            <h4 className="text-sm font-semibold">{r.label}</h4>
            <p className="text-xs text-muted-foreground">{r.basis}</p>
            <ol className="flex flex-col gap-0.5 text-sm">
              {r.leaders.map((l, i) => (
                <li key={l.ids.join("|")} className="flex justify-between gap-2">
                  <span>
                    {i + 1}.{" "}
                    {l.ids.map((id, k) => (
                      <span key={id}>
                        {k > 0 && " and "}
                        <button type="button" className="inline-flex min-h-6 items-center hover:underline" onClick={() => onOpenPlayer(id)}>
                          {playerName(state, id)}
                        </button>
                      </span>
                    ))}
                    {i === 0 && clipOf.get(`${r.key}|${l.ids[0]}`) && <ClipButton compact state={state} clip={clipOf.get(`${r.key}|${l.ids[0]}`)!} label={`Watch ${playerName(state, l.ids[0])}'s best play`} />}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{l.value}</span>
                </li>
              ))}
            </ol>
            {live && (ODDS_KEYS as readonly string[]).includes(r.key) && live.odds[r.key as OddsKey].length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5 rounded-md border border-dashed p-2 text-xs">
                <p className="font-medium">{over ? `Had it run ${AFTER} more nights` : "Projected finish"}</p>
                <p>
                  <span className="text-muted-foreground">Chance to lead it at the end: </span>
                  {live.odds[r.key as OddsKey]
                    .filter((x) => x.chance >= 0.02)
                    .slice(0, SHOWN)
                    .map((x) => `${playerName(state, x.id)} ${pct(x.chance)}`)
                    .join(", ")}
                </p>
                {voteOf(r.key) && (
                  <p>
                    <span className="text-muted-foreground">Projected vote: </span>
                    {voteOf(r.key)}
                  </p>
                )}
              </div>
            )}
          </section>
        ))}
        {live && !over && proj && proj.milestones.length > 0 && (
          <section aria-label="Next points milestone" className="flex flex-col gap-0.5 rounded-md border border-dashed p-2 text-xs">
            <p className="font-medium">Next points milestone, if the season runs 20 more filmed games</p>
            {proj.milestones.slice(0, SHOWN).map((m) => (
              <p key={m.id} className="flex justify-between gap-2">
                <button type="button" className="hover:underline" onClick={() => onOpenPlayer(m.id)}>
                  {playerName(state, m.id)}
                </button>
                <span className="tabular-nums text-muted-foreground">
                  {m.next - m.pts} from {m.next}, {pct(m.chance)}
                </span>
              </p>
            ))}
          </section>
        )}
        {live && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">How the projected finish is worked out (editors only)</summary>
            <p className="mt-1">
              The chance to lead comes from playing out the {live.nightsLeft} nights {over ? "after the season" : `left (of ${live.nightsPlayed + live.nightsLeft} planned)`} {RUNS_TEXT}, from each
              player's attendance, games a night and level so far, with the usual swings from game to game. Someone not in the race yet can still
              lead it by getting to {MIN_TEXT}. Awards are voted, so the projected vote runs 2,000 sample ballots on the totals so far: every
              player with 3 or more games ranks three others for 3, 2 and 1 points, with some disagreement built in. It shows who is best placed,
              not who will win. Visitors see the race without any chances.
            </p>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
