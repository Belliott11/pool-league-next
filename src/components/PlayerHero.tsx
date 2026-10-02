import { IdCard, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PlayerAvatar } from "@/components/PlayerAvatar"

type Stats = { twoWay: string; record: string; pts: string; off: string }

// Trading-card style header for the Player page. #playerRankPill is filled by the classic renderPlayerRankPill.
export function PlayerHero({ pid, name, stats, form = [], onShare, onCard }: { pid: string; name: string; stats: Stats | null; form?: ("W" | "L" | "T")[]; onShare: () => void; onCard: () => void }) {
  return (
    <Card className="tile overflow-hidden">
      <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <PlayerAvatar
          id={pid}
          name={name}
          size="lg"
          className="size-24! rounded-xl! ring-2 ring-primary ring-offset-2 ring-offset-card sm:size-32! [&_[data-slot=avatar-fallback]]:rounded-xl [&_[data-slot=avatar-fallback]]:text-5xl [&_[data-slot=avatar-image]]:rounded-xl"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="font-display text-3xl font-bold leading-tight break-words">{name}</h2>
            <div id="playerRankPill" className="legacy" />
          </div>
          {stats ? (
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="font-display text-7xl font-extrabold leading-none tabular-nums text-primary sm:text-8xl">{stats.twoWay}</div>
                <div className="mt-1 text-sm text-muted-foreground">Two-Way/20</div>
              </div>
              <dl className="flex gap-6 sm:border-l sm:border-dashed sm:pl-6">
                {[
                  ["Record", stats.record],
                  ["PTS/20", stats.pts],
                  ["Off/20", stats.off],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dd className="font-display text-xl font-bold tabular-nums">{v}</dd>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                  </div>
                ))}
              </dl>
              {form.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div role="img" aria-label={`Last ${form.length} games, oldest first: ${form.join(", ")}`} className="flex gap-1">
                    {form.map((r, i) => (
                      <span
                        key={i}
                        title={r === "W" ? "Win" : r === "L" ? "Loss" : "Tie"}
                        className={`size-3 rounded-full ${r === "W" ? "bg-pos" : r === "L" ? "bg-neg" : "bg-muted-foreground/50"}`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">Last {form.length} games</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No games yet</p>
          )}
        </div>
        <div className="flex gap-2 sm:flex-col">
          <Button variant="outline" onClick={onShare} aria-label={`Share ${name}`} className="flex-1">
            <Share2 /> Share
          </Button>
          <Button onClick={onCard} aria-label={`Download ${name} trading card`} className="flex-1">
            <IdCard /> Card
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
