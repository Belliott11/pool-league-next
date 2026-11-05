import { History } from "lucide-react"
import { Section } from "@/components/Section"
import { oldPairs, oldSite, oldRecord } from "@/lib/oldSite"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"

// What the old site recorded for this player: every result (including games never filmed), the season power percentile
// and how the nightly power ranking moved. A collapsed section like the others.
export function PlayerOldSite({ state, pid }: { state: PooleanState; pid: string }) {
  const old = oldSite()
  const rec = oldRecord(pid)
  const nights = old.ranks.get(pid) ?? []
  if (!rec && nights.length === 0) return null
  const power = old.power.get(pid)
  const { mate, rival } = oldPairs(pid)
  const name = (id: string) => playerName(state, id)
  const pct = rec ? Math.round((rec.w / (rec.w + rec.l)) * 100) : null
  return (
    <Section id="player-old" title="Old site record" icon={History} teaser={rec ? `${rec.w}-${rec.l} in every game the old site logged.` : `On the old site's power ranking ${nights.length} nights.`}>
      <ul className="flex flex-col gap-1.5 text-sm">
        {rec && (
          <li>
            Record <span className="font-semibold tabular-nums">{rec.w}-{rec.l}</span> ({pct}% wins), including games that were never filmed.
          </li>
        )}
        {power !== undefined && (
          <li>
            Season power <span className="font-semibold tabular-nums">{Math.round(power)}</span> out of 100, pulled toward 50 when a player has few games.
          </li>
        )}
        {nights.length > 0 && (
          <li>
            Nightly power ranking over {nights.length} {nights.length === 1 ? "night" : "nights"}: latest <span className="font-semibold tabular-nums">{Math.round(nights[nights.length - 1])}</span>, best{" "}
            <span className="font-semibold tabular-nums">{Math.round(Math.max(...nights))}</span>, lowest <span className="font-semibold tabular-nums">{Math.round(Math.min(...nights))}</span>.
          </li>
        )}
        {mate && (
          <li>
            Best partner <span className="font-semibold">{name(mate.id)}</span>, {mate.w}-{mate.l} together.
          </li>
        )}
        {rival && (
          <li>
            Most played opponent <span className="font-semibold">{name(rival.id)}</span>, {rival.w}-{rival.l} against.
          </li>
        )}
      </ul>
    </Section>
  )
}
