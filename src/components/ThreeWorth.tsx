import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { breakEvenThree, leagueShooter, playerShooter, possessionOdds, PRIOR_SHOTS, shotKinds, situations, tripRates, type Shooter } from "@/lib/shotChoice"
import { liveTargetOf } from "@/lib/live"
import { playerName } from "@/lib/players"
import { cn } from "@/lib/utils"
import type { PooleanState } from "@/lib/types"

// "Is a 3 worth it?": how often a 3 has to go in to beat a 2, at the scores that come up, for the league and for each player. Counts
// where misses end up (out of bounds is the other team's ball). The math is in src/lib/shotChoice.ts.

const pct = (p: number) => `${Math.round(p * 100)}%`

function verdict(p3: number, need: number | null): { text: string; tone: "three" | "two" | "even" } {
  if (need === null) return { text: "Take the 2", tone: "two" }
  if (Math.abs(p3 - need) < 0.02) return { text: "About even", tone: "even" }
  return p3 > need ? { text: "The 3", tone: "three" } : { text: "The 2", tone: "two" }
}

function Verdict({ p3, need }: { p3: number; need: number | null }) {
  const v = verdict(p3, need)
  return <span className={cn("font-semibold", v.tone === "three" && "text-pos", v.tone === "even" && "italic")}>{v.text}</span>
}

// The target most of the filmed games were played to, for the default.
function usualTarget(state: PooleanState): number {
  const counts = new Map<number, number>()
  for (const g of state.games) if (g.scoringEvents.length && !g.liveInProgress) counts.set(liveTargetOf(g), (counts.get(liveTargetOf(g)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 21
}

export function ThreeWorth({ state, pid, onOpenPlayer }: { state: PooleanState; pid?: string; onOpenPlayer?: (id: string) => void }) {
  const [target, setTarget] = useState(() => usualTarget(state))
  const data = useMemo(() => {
    const league = leagueShooter(state)
    const kinds = shotKinds(state)
    const rates = tripRates(state)
    const W = possessionOdds(target, rates.t2, rates.t3)
    const spots = situations(target)
    const heaves = state.games.flatMap((g) => g.scoringEvents.filter((e) => e.points === 3 && e.shotType === "deepHeave"))
    const players = state.players
      .map((p) => ({ id: p.id, s: playerShooter(state, p.id, league) }))
      .filter((r) => r.s.three.att >= 5)
      .sort((a, b) => b.s.three.att - a.s.three.att)
    return { league, kinds, W, spots, heaves, players }
  }, [state, target])
  const { league, kinds, W, spots } = data
  if (kinds.three.att < 10 || kinds.two.att < 10) return null
  const mid = spots[1]
  const late = spots[2]
  // How much the out-of-bounds difference moves the bar: the same with a missed 3 coming back as often as a missed 2.
  const flat = breakEvenThree(W, mid.a, mid.b, { ...league, keep3: league.keep2 })
  const real = breakEvenThree(W, mid.a, mid.b, league)
  const name = pid ? playerName(state, pid) : ""
  const mine = pid ? playerShooter(state, pid, league) : null
  const shooter: Shooter = mine ?? league

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Is a 3 worth it?</CardTitle>
        <p className="text-sm text-muted-foreground">
          How often a 3 has to go in to beat {pid ? `${name}'s` : "a"} 2, counting where the misses go. A missed 3 goes out of bounds {pct(league.oob3)} of the time (a missed 2,{" "}
          {pct(league.oob2)}), and the shooting team gets it back {pct(league.keep3)} of the time (a missed 2, {pct(league.keep2)}).
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Games to</span>
          {[16, 21].map((t) => (
            <Button key={t} size="sm" variant={t === target ? "default" : "outline"} aria-pressed={t === target} onClick={() => setTarget(t)}>
              {t}
            </Button>
          ))}
        </div>
        {mine && (
          <p>
            {name} makes {mine.two.made} of {mine.two.att} twos and {mine.three.made} of {mine.three.att} threes. Leaning on the league's rates until there are more shots, that is{" "}
            <span className="font-semibold">{pct(mine.p2)}</span> on 2s and <span className="font-semibold">{pct(mine.p3)}</span> on 3s
            {mine.three.misses >= 5 ? `, and ${pct(mine.three.oob / mine.three.misses)} of their missed 3s went out of bounds` : ""}.
          </p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Your ball at</TableHead>
              <TableHead className="text-right">3 must hit</TableHead>
              <TableHead className="text-right">{pid ? "Hits" : "League"}</TableHead>
              <TableHead>Better</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spots.map((x) => {
              const need = breakEvenThree(W, x.a, x.b, shooter)
              return (
                <TableRow key={x.label}>
                  <TableCell>
                    {x.label}
                    <span className="block text-xs text-muted-foreground">
                      {x.a}-{x.b}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{need === null ? "never" : pct(need)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(shooter.p3)}</TableCell>
                  <TableCell>
                    <Verdict p3={shooter.p3} need={need} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {!pid && data.players.length > 0 && (
          <div>
            <div className="mb-1 font-semibold">Player by player</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">2s</TableHead>
                  <TableHead className="text-right">3s</TableHead>
                  <TableHead className="text-right">{mid.label}</TableHead>
                  <TableHead className="text-right">Down 3, late</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.players.map(({ id, s }) => {
                  const nMid = breakEvenThree(W, mid.a, mid.b, s)
                  const nLate = breakEvenThree(W, late.a, late.b, s)
                  const cell = (need: number | null) => (
                    <span className={cn(need !== null && s.p3 > need && "font-semibold text-pos")}>{need === null ? "never" : pct(need)}</span>
                  )
                  return (
                    <TableRow key={id}>
                      <TableCell>
                        {onOpenPlayer ? (
                          <button className="underline-offset-2 hover:underline" onClick={() => onOpenPlayer(id)}>
                            {playerName(state, id)}
                          </button>
                        ) : (
                          playerName(state, id)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(s.p2)}
                        <span className="block text-xs text-muted-foreground">
                          {s.two.made}/{s.two.att}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(s.p3)}
                        <span className="block text-xs text-muted-foreground">
                          {s.three.made}/{s.three.att}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{cell(nMid)}</TableCell>
                      <TableCell className="text-right tabular-nums">{cell(nLate)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <p className="mt-1 text-xs text-muted-foreground">The last two columns are how often each player's 3 has to go in. A green number is one that player's 3s clear. A better 2 shooter needs a better 3 to make the 3 worth it.</p>
          </div>
        )}
        <ul className="flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
          <li>
            Where misses go matters: for the league, if a missed 3 came back as often as a missed 2, the bar {mid.label.toLowerCase()} would be {flat === null ? "lower" : pct(flat)} instead of{" "}
            {real === null ? "out of reach" : pct(real)}. Most missed 2s are lost too, so the gap is smaller than the out-of-bounds numbers suggest.
          </li>
          <li>
            Each player's rates lean on the league's as if they had {PRIOR_SHOTS} more shots at the league's rates, so a hot week on a few threes does not swing it. Teams are taken as
            even, so this is about the shot, not the matchup.
          </li>
          {data.heaves.length > 0 && (
            <li>
              {data.heaves.length} of the {kinds.three.att} threes were deep heaves, and {data.heaves.filter((e) => e.made !== false).length} of those went in.
            </li>
          )}
          <li>Up 2 late, either basket wins it, so the better shot is simply the one more likely to go in.</li>
        </ul>
      </CardContent>
    </Card>
  )
}
