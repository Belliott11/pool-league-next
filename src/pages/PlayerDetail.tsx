import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { computeLeaderboard } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"

function fmtRate(v: number) {
  return v.toFixed(1)
}

export function PlayerDetailPage({
  state,
  playerId,
  onChangePlayer,
}: {
  state: PooleanState
  playerId: string | null
  onChangePlayer: (id: string) => void
}) {
  const rows = computeLeaderboard(state)
  const row = rows.find((r) => r.player.id === playerId) ?? rows[0] ?? null

  if (!row) {
    return <p className="text-muted-foreground">No players yet.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <Select value={row.player.id} onValueChange={(id) => id && onChangePlayer(id)}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Pick a player" />
        </SelectTrigger>
        <SelectContent>
          {state.players.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <PlayerAvatar id={row.player.id} name={row.player.name} size="lg" />
            <div>
              <h2 className="font-display text-xl font-bold">{row.player.name}</h2>
              <p className="text-sm text-muted-foreground">
                {row.gp} game{row.gp === 1 ? "" : "s"} played this season
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat label="Record" value={`${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}`} />
            <HeroStat label="PTS/20" value={fmtRate(row.ptsPer20)} />
            <HeroStat label="Off Rating/20" value={fmtRate(row.offRatingPer20)} />
            <HeroStat label="Two-Way/20" value={fmtRate(row.twoWayPer20)} highlight />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function HeroStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md px-3 py-2 ${highlight ? "bg-accent/10" : "bg-muted"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold tabular-nums ${highlight ? "text-accent" : ""}`}>
        {value}
      </div>
    </div>
  )
}
