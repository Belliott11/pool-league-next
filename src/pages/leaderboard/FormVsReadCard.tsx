import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formVsRead, READY_AT } from "@/lib/formTeams"
import type { PooleanState } from "@/lib/types"

// Models tab: should the team balancer rank splits by the form rating instead of the pre-game read? Score so far (formTeams.ts).
export function FormVsReadCard({ state }: { state: PooleanState }) {
  const r = useMemo(() => formVsRead(state), [state])
  const ready = r.games >= READY_AT
  const verdict = !r.games
    ? "No games to judge yet: the form rating needs an earlier filmed night."
    : !ready
      ? `Too early to tell: ${r.games} of the ${READY_AT} games needed. Until then the balancer keeps ranking by the pre-game read.`
      : r.formRight > r.readRight
        ? "The form rating has called more winners. Time to look at switching the balancer to it (and check it on closer games, not just winners)."
        : "The pre-game read has called as many winners or more. The balancer stays as it is."
  return (
    <Card>
      <CardHeader>
        <CardTitle>Should the balancer use the form rating?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p className="text-muted-foreground">
          On every filmed game, each called only from earlier nights: did the side with the higher combined form rating win, and did the
          pre-game read&apos;s favourite win?
        </p>
        {r.games > 0 && (
          <p>
            Form rating: <span className="font-semibold tabular-nums">{r.formRight}</span> of {r.games}. Pre-game read:{" "}
            <span className="font-semibold tabular-nums">{r.readRight}</span> of {r.games}.
          </p>
        )}
        <p>{verdict}</p>
      </CardContent>
    </Card>
  )
}
