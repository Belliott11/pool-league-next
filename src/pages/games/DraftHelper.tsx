import { useMemo, useState } from "react"
import { computeBalanceQualityMap } from "@/lib/balance"
import { snakeDraft } from "@/lib/draft"
import { predictRealMatchup } from "@/lib/matchup"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"

const pick = "h-10 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"

// For nights when captains pick: choose the two captains from who is here and it lists the picks in snake order, best player left
// each time by the same rating Balance Teams uses, then says how even the teams come out.
export function DraftHelper({ state, attendees }: { state: PooleanState; attendees: string[] }) {
  const [capA, setCapA] = useState("")
  const [capB, setCapB] = useState("")
  const quality = useMemo(() => computeBalanceQualityMap(state), [state])
  const name = (id: string) => playerName(state, id)
  const ok = capA && capB && capA !== capB && attendees.includes(capA) && attendees.includes(capB)
  const d = ok ? snakeDraft(capA, capB, attendees, (id) => quality[id]?.quality ?? 0) : null
  const odds = d ? predictRealMatchup(d.a, d.b) : null
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Captains' draft">
      <h3 className="font-display text-lg font-bold">Captains' draft</h3>
      {attendees.length < 4 ? (
        <p className="text-sm text-muted-foreground">Pick at least 4 players in Balance Teams above, then choose two captains here.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Picks go in snake order (first, second, second, first), and the captain with the lower rating picks first. Each pick is the best player left by two-way per 25, or by reputation for players with no filmed games.</p>
          <div className="flex flex-wrap gap-2">
            {([["Captain A", capA, setCapA], ["Captain B", capB, setCapB]] as const).map(([label, v, set]) => (
              <select key={label} aria-label={label} className={pick} value={v} onChange={(e) => set(e.target.value)}>
                <option value="">{label}</option>
                {attendees.map((id) => (
                  <option key={id} value={id}>
                    {name(id)}
                  </option>
                ))}
              </select>
            ))}
          </div>
          {d && (
            <>
              <ol className="flex flex-col gap-1 text-sm">
                {d.order.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="w-6 tabular-nums text-muted-foreground">{i + 1}.</span>
                    <span className="font-medium">{name(p.to === "A" ? capA : capB)}</span> takes <span className="font-medium">{name(p.id)}</span>
                  </li>
                ))}
              </ol>
              <p className="text-sm">
                <span className="font-semibold">{d.a.map(name).join(", ")}</span> against <span className="font-semibold">{d.b.map(name).join(", ")}</span>
                {odds ? `. ${name(capA)}'s team wins about ${Math.round(odds.pA * 100)}% of the time.` : ". Not enough past games to give odds yet."}
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}
