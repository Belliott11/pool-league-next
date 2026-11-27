import { Card, CardContent } from "@/components/ui/card"
import { pastSeasonAwards } from "@/lib/pastAwards"
import { poolNameOf } from "@/lib/real"
import type { PooleanState } from "@/lib/types"

// Past seasons' voted awards from Adam's Poolean app (pastAwards.ts): each award's winner and every player's points, folded so the page
// stays short. Shown under this season's vote on the Season awards page.
export function PastAwards({ state }: { state: PooleanState }) {
  const seasons = pastSeasonAwards()
  if (!seasons.length) return null
  const name = (id: string) => poolNameOf(state, id)
  const both = (ids: string[]) => ids.map(name).join(" and ")
  return (
    <>
      {seasons.map((s) => (
        <section key={s.season} aria-label={`${s.season} awards`} className="flex flex-col gap-2">
          <h3 className="font-display text-lg font-bold">{s.season}, voted in Poolean</h3>
          <p className="text-xs text-muted-foreground">
            Counted in Adam's Poolean app: each ballot's top three scored 3, 2 and 1 points. A tie on points went to whoever came to more
            parties. The ballots stay private there; these are the final points.
          </p>
          <Card>
            <CardContent className="flex flex-col divide-y">
              {s.awards.map((a) => {
                const team = a.key === "first-team" || a.key === "second-team"
                const duo = a.key.endsWith("duo")
                const winner = team ? a.winners.map(name).join(", ") : duo ? both(a.winners) : a.winners.map(name).join(" and ")
                const top = Math.max(1, ...a.standings.map((x) => x.points))
                return (
                  <details key={a.key} className="group py-2 first:pt-0 last:pb-0">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm [&::-webkit-details-marker]:hidden">
                      <span className="text-muted-foreground">{a.label}</span>
                      <span className="text-right font-semibold">{winner}</span>
                    </summary>
                    <ul className="mt-2 flex flex-col gap-1 text-sm">
                      {a.standings.map((x) => (
                        <li key={x.ids.join("|")} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 truncate">{duo ? both(x.ids) : name(x.ids[0])}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${(x.points / top) * 100}%` }} />
                          </span>
                          <span className="w-14 shrink-0 text-right tabular-nums">
                            {x.points} {x.points === 1 ? "pt" : "pts"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {team && <p className="mt-1 text-xs text-muted-foreground">One vote for both teams: places 1 to 3 made the first team, 4 to 6 the second.</p>}
                    {a.tieWon && <p className="mt-1 text-xs text-muted-foreground">Level on points at the top; it went to {a.winners.map(name).join(" and ")} for coming to more parties.</p>}
                  </details>
                )
              })}
            </CardContent>
          </Card>
        </section>
      ))}
    </>
  )
}
