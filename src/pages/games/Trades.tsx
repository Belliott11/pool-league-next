import { useState, type ReactNode } from "react"
import { ArrowLeftRight, Check, X } from "lucide-react"
import { TeamChip } from "@/components/TeamChip"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/format"
import { sendOffer, sendResponse, sendWithdraw, type CaptainLink } from "@/lib/draftRoom"
import { playerName } from "@/lib/players"
import { movePlayer, putSet } from "@/lib/seasonTeams"
import { decideOffer, MAX_SIDE, tradeProblem, type TradeOffer, type TradeStatus } from "@/lib/seasonTrades"
import type { Update } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { PooleanState, SeasonTeamSet } from "@/lib/types"

const STATUS: Record<TradeStatus, string> = {
  open: "Waiting for an answer",
  accepted: "Accepted, waiting for the editor",
  declined: "Declined",
  withdrawn: "Taken back",
  approved: "Done",
  "turned down": "Turned down by the editor",
}
const today = () => new Date().toLocaleDateString("en-CA")

// Trade offers on the Season teams page (src/lib/seasonTrades.ts): a captain with their link offers players for another team's, that
// captain answers, and the editor approves an accepted trade, which then moves the players from today (dated moves, so earlier nights
// stay with the team they were played for). Everyone sees the offers.
export function Trades({ state, set, update, readOnly, captain, links }: { state: PooleanState; set: SeasonTeamSet; update: Update; readOnly: boolean; captain: CaptainLink | null; links: ReactNode }) {
  const mine = captain && captain.setId === set.id && set.captainKeys ? (set.teams.find((t) => t.id === captain.teamId) ?? null) : null
  const offers = [...(set.offers ?? [])].reverse()
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const name = (id: string) => playerName(state, id)
  const team = (id: string) => set.teams.find((t) => t.id === id)
  if (!mine && !offers.length && readOnly) return null

  const run = async (f: () => Promise<string | null>) => {
    setBusy(true)
    setErr((await f()) ?? "")
    setBusy(false)
  }
  const approve = (o: TradeOffer, yes: boolean) => {
    const decided = decideOffer(set, o.id, yes, new Date().toISOString())
    if (typeof decided === "string") return setErr(decided)
    let next = decided
    if (yes) {
      const date = today()
      for (const p of o.give) next = movePlayer(next, p, o.to, date)
      for (const p of o.get) next = movePlayer(next, p, o.from, date)
    }
    setErr("")
    update((s) => putSet(s, next))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <ArrowLeftRight aria-hidden className="size-5 text-accent" /> Trades
        </CardTitle>
        <p className="text-sm text-muted-foreground">Captains offer trades from their own phones; the other captain answers, and the editor approves before anyone moves. Moves count from the day they are approved.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {mine && <Offer state={state} set={set} mine={mine.id} busy={busy} onSend={(to, give, get) => void run(() => sendOffer(captain!, to, give, get))} />}
        {err && <p className="text-destructive">{err}</p>}
        {offers.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {offers.map((o) => {
              const a = team(o.from)
              const b = team(o.to)
              if (!a || !b) return null
              const stale = (o.status === "open" || o.status === "accepted") && tradeProblem(set, o.from, o.to, o.give, o.get)
              return (
                <li key={o.id} className={cn("flex flex-col gap-1.5 rounded-lg border px-3 py-2", (o.status === "open" || o.status === "accepted") && "border-primary/60")}>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <TeamChip team={a} /> <span className="text-muted-foreground">gives</span> {o.give.map(name).join(", ")}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <TeamChip team={b} /> <span className="text-muted-foreground">gives</span> {o.get.map(name).join(", ")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {STATUS[o.status]} · offered {formatDateDisplay(o.at.slice(0, 10))}
                    {stale ? ` · ${stale}` : ""}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {o.status === "open" && mine?.id === o.to && (
                      <>
                        <Button size="sm" disabled={busy || !!stale} onClick={() => void run(() => sendResponse(captain!, o.id, true))}>
                          <Check aria-hidden /> Accept
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => sendResponse(captain!, o.id, false))}>
                          <X aria-hidden /> Decline
                        </Button>
                      </>
                    )}
                    {o.status === "open" && mine?.id === o.from && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => sendWithdraw(captain!, o.id))}>
                        Take the offer back
                      </Button>
                    )}
                    {o.status === "accepted" && !readOnly && (
                      <>
                        <Button size="sm" disabled={!!stale} onClick={() => approve(o, true)}>
                          <Check aria-hidden /> Approve the trade
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => approve(o, false)}>
                          Turn it down
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground">No trade offers yet.</p>
        )}
        {links}
      </CardContent>
    </Card>
  )
}

// A captain's offer form: the other team, then who goes each way (up to MAX_SIDE each, captains stay).
function Offer({ state, set, mine, busy, onSend }: { state: PooleanState; set: SeasonTeamSet; mine: string; busy: boolean; onSend: (to: string, give: string[], get: string[]) => void }) {
  const others = set.teams.filter((t) => t.id !== mine)
  const [to, setTo] = useState(others[0]?.id ?? "")
  const [give, setGive] = useState<string[]>([])
  const [get, setGet] = useState<string[]>([])
  const me = set.teams.find((t) => t.id === mine)!
  const them = set.teams.find((t) => t.id === to)
  const toggle = (list: string[], set: (x: string[]) => void, p: string) => set(list.includes(p) ? list.filter((x) => x !== p) : list.length < MAX_SIDE ? [...list, p] : list)
  const chips = (members: string[], captain: string | null, list: string[], set: (x: string[]) => void, label: string) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {members
          .filter((p) => p !== captain)
          .map((p) => (
            <button key={p} type="button" aria-pressed={list.includes(p)} onClick={() => toggle(list, set, p)} className={cn("rounded-full border px-3 py-1", list.includes(p) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {playerName(state, p)}
            </button>
          ))}
      </div>
    </div>
  )
  const problem = them ? tradeProblem(set, mine, to, give, get) : "Pick a team."
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
      <p className="font-medium">
        Offer a trade as <TeamChip team={me} />
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">With</span>
        <select value={to} onChange={(e) => (setTo(e.target.value), setGet([]))} className="h-9 rounded-md border bg-background px-2">
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {chips(me.members, me.captain, give, setGive, `You give (up to ${MAX_SIDE})`)}
      {them && chips(them.members, them.captain, get, setGet, `You get (up to ${MAX_SIDE})`)}
      <Button size="sm" className="self-start" disabled={busy || !!problem} onClick={() => (onSend(to, give, get), setGive([]), setGet([]))}>
        <ArrowLeftRight aria-hidden /> Send the offer
      </Button>
      {problem && (give.length > 0 || get.length > 0) && <p className="text-xs text-muted-foreground">{problem}</p>}
    </div>
  )
}
