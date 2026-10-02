/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type ReactNode } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import {
  COMPARISON_LOWER_IS_BETTER_KEYS,
  COMPARISON_NEUTRAL_KEYS,
  LEADERBOARD_COLUMNS,
  LEAGUE_RANK_MIN_GP,
  PASSING_CHEMISTRY_ROWS,
  computeAwardsVsStats,
  computeLeaderboard,
  computeLeagueRanks,
  computePassingChemistryPair,
  computePowerRankingVsPerformance,
  computeLeagueZonePointsPerAttempt,
  computeXptsCombos,
  formatDateDisplay,
  ordinal,
} from "@/lib/legacy-core"
import { nativeSelect } from "@/pages/games/GameLog"
import type { PooleanState } from "@/lib/types"

type Open = (id: string) => void

function PlayerPick({ state, value, onChange }: { state: PooleanState; value: string; onChange: (v: string) => void }) {
  return (
    <select className={nativeSelect} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a player</option>
      {[...state.players].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

function NameLink({ p, onOpen }: { p: { id: string; name: string }; onOpen: Open }) {
  return (
    <button type="button" className="inline-flex items-center gap-2 font-semibold hover:underline" onClick={() => onOpen(p.id)}>
      <PlayerAvatar id={p.id} name={p.name} size="sm" />
      {p.name}
    </button>
  )
}

/* ---------- Player Comparison: mirrored rows, the better side lit in aqua ---------- */
export function PlayerComparison({ state, onOpen }: { state: PooleanState; onOpen: Open }) {
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const board = computeLeaderboard() as any[]
  const r1 = board.find((r) => r.player.id === a)
  const r2 = board.find((r) => r.player.id === b)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <PlayerPick state={state} value={a} onChange={setA} />
        <span className="text-muted-foreground">vs.</span>
        <PlayerPick state={state} value={b} onChange={setB} />
      </div>
      {!a || !b ? (
        <p className="text-sm text-muted-foreground">Pick two players above.</p>
      ) : a === b ? (
        <p className="text-sm text-muted-foreground">Pick two different players.</p>
      ) : r1 && r2 ? (
        <div className="tile min-w-0 overflow-x-auto rounded-xl border p-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 border-b pb-2">
            <div className="flex justify-end">
              <NameLink p={r1.player} onOpen={onOpen} />
            </div>
            <span className="text-xs text-muted-foreground">vs.</span>
            <div>
              <NameLink p={r2.player} onOpen={onOpen} />
            </div>
          </div>
          {(LEADERBOARD_COLUMNS as any[])
            .filter((c) => c.key !== "player" && c.key !== "last5")
            .map((col) => {
              const v1 = col.accessor(r1)
              const v2 = col.accessor(r2)
              let w = 0
              if (!COMPARISON_NEUTRAL_KEYS.has(col.key) && typeof v1 === "number" && typeof v2 === "number" && v1 !== v2) {
                w = (COMPARISON_LOWER_IS_BETTER_KEYS.has(col.key) ? v1 < v2 : v1 > v2) ? 1 : 2
              }
              const cell = (v: any, r: any, win: boolean) => (
                <span
                  className={`font-display tabular-nums ${win ? "font-extrabold text-chart-2" : w ? "text-muted-foreground" : ""}`}
                  dangerouslySetInnerHTML={{ __html: String(col.display ? col.display(r) : v) }}
                />
              )
              return (
                <div key={col.key} title={col.tooltip} className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 border-b border-dashed py-1 text-sm last:border-b-0">
                  <div className="text-right">{cell(v1, r1, w === 1)}</div>
                  <span className="w-20 text-center text-xs text-muted-foreground sm:w-36">{col.label}</span>
                  <div>{cell(v2, r2, w === 2)}</div>
                </div>
              )
            })}
        </div>
      ) : null}
    </div>
  )
}

/* ---------- Awards vs. Stats ---------- */
export function AwardsVsStats({ onOpen }: { onOpen: Open }) {
  const awards = computeAwardsVsStats() as any[]
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {awards.map((award) => (
        <details key={award.key} className="group/aw rounded-xl border bg-card p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <h4 className="font-display font-bold">{award.label}</h4>
            <span className="text-xs text-muted-foreground group-open/aw:hidden">Standings</span>
            <span className="hidden text-xs text-muted-foreground group-open/aw:inline">Hide</span>
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {award.winners.map((w: any) => (
              <div key={w.slug} className="flex flex-wrap items-center justify-between gap-x-3">
                {w.player ? <NameLink p={w.player} onOpen={onOpen} /> : <span>{w.slug} (not in current roster)</span>}
                <span className="text-xs text-muted-foreground">{w.detail}</span>
              </div>
            ))}
            {award.duoDetail && <p className="text-xs text-muted-foreground">{award.duoDetail}</p>}
          </div>
          <div className="mt-3 grid gap-4 border-t border-dashed pt-3 text-sm sm:grid-cols-2">
            <div>
              <h5 className="mb-1 text-xs font-semibold text-muted-foreground">How the vote went</h5>
              {award.votedStandings?.length ? (
                <ol className="flex flex-col gap-0.5">
                  {award.votedStandings.map((v: any) => (
                    <li key={v.slug} className="flex justify-between gap-2">
                      <span>{v.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {v.points} pt{v.points === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground">No ballot data for this award.</p>
              )}
            </div>
            <div>
              <h5 className="mb-1 text-xs font-semibold text-muted-foreground">Stat standings</h5>
              {award.standings.length ? (
                <ol className="flex flex-col gap-0.5">
                  {award.standings.map((s: any) => (
                    <li key={s.player.id} className="flex justify-between gap-2">
                      <button type="button" className="hover:underline" onClick={() => onOpen(s.player.id)}>
                        {s.player.name}
                      </button>
                      <span className="tabular-nums text-muted-foreground" dangerouslySetInnerHTML={{ __html: String(s.display) }} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground">No standings yet for this stat.</p>
              )}
            </div>
          </div>
        </details>
      ))}
    </div>
  )
}

/* ---------- Power Ranking vs. Performance: vote strength beside that night's play ---------- */
export function PowerRankingVsPerformance({ onOpen }: { onOpen: Open }) {
  const parties = computePowerRankingVsPerformance() as any[]
  if (parties.length === 0) return <p className="text-sm text-muted-foreground">No games reviewed yet for any night with a power ranking.</p>
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {parties.map((party) => (
        <div key={party.date} className="rounded-xl border bg-card p-3">
          <h4 className="font-display mb-2 font-bold">{formatDateDisplay(party.date)}</h4>
          <div className="mb-1 grid grid-cols-[2.5rem_7rem_1fr_3.5rem] gap-2 text-xs text-muted-foreground">
            <span>Rank</span>
            <span>Player</span>
            <span>Power %</span>
            <span className="text-right">Two-Way</span>
          </div>
          {party.players.map((r: any) => (
            <div key={r.slug} className="grid grid-cols-[2.5rem_7rem_1fr_3.5rem] items-center gap-2 border-t border-dashed py-1 text-sm">
              <span className="font-display font-bold tabular-nums">
                {r.rank}
                <span className="text-xs font-normal text-muted-foreground">/{r.fieldSize}</span>
              </span>
              {r.player ? (
                <button type="button" className="truncate text-left font-semibold hover:underline" onClick={() => onOpen(r.player.id)}>
                  {r.player.name}
                </button>
              ) : (
                <span className="truncate text-muted-foreground">{r.slug}</span>
              )}
              <span className="flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-chart-2" style={{ width: `${Math.max(2, r.pct)}%` }} />
                </span>
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{r.pct}%</span>
              </span>
              <span
                className={`font-display text-right font-bold tabular-nums ${r.perf && r.perf.twoWayPer20 < 0 ? "text-destructive" : ""}`}
                title={r.perf ? `${r.perf.gp} game${r.perf.gp === 1 ? "" : "s"}` : undefined}
              >
                {r.perf ? r.perf.twoWayPer20.toFixed(1) : "-"}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ---------- Passing Chemistry pair: one card per direction ---------- */
export function PassingChemistryPair({ state }: { state: PooleanState }) {
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? id
  let body: ReactNode = <p className="text-sm text-muted-foreground">Pick two players above.</p>
  if (a && b && a === b) body = <p className="text-sm text-muted-foreground">Pick two different players.</p>
  else if (a && b) {
    const zonePpa = computeLeagueZonePointsPerAttempt()
    const combos = computeXptsCombos()
    const dirs = [
      { from: a, to: b, d: computePassingChemistryPair(a, b, combos, zonePpa) },
      { from: b, to: a, d: computePassingChemistryPair(b, a, combos, zonePpa) },
    ]
    body = (
      <div className="grid gap-3 sm:grid-cols-2">
        {dirs.map((x) => (
          <div key={x.from} className="rounded-xl border bg-card p-3">
            <h4 className="font-display mb-2 font-bold">
              {name(x.from)} <span className="text-muted-foreground">passes to</span> {name(x.to)}
            </h4>
            {x.d ? (
              (PASSING_CHEMISTRY_ROWS as any[]).map((r) => (
                <div key={r.label} className="flex justify-between gap-3 border-t border-dashed py-1 text-sm first:border-t-0">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-display font-bold tabular-nums">{String(r.accessor(x.d)).replace("—", "-")}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No shots yet.</p>
            )}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <PlayerPick state={state} value={a} onChange={setA} />
        <span className="text-muted-foreground">&amp;</span>
        <PlayerPick state={state} value={b} onChange={setB} />
      </div>
      {body}
    </div>
  )
}

/* ---------- League Rank (player page): a podium tile per stat ---------- */
export function LeagueRank({ pid }: { pid: string }) {
  const ranks = computeLeagueRanks(pid) as any[]
  if (ranks.length === 0) return <p className="text-sm text-muted-foreground">Needs at least {LEAGUE_RANK_MIN_GP} games played to show a league rank.</p>
  const tone = (r: number) => (r === 1 ? "text-chart-3" : r <= 3 ? "text-chart-2" : "text-foreground")
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {ranks.map((r) => (
        <div key={r.key} className={`tile rounded-xl border p-2 text-center ${r.rank === 1 ? "border-chart-3" : ""}`} title={`${r.label}: ${r.decimals === undefined ? r.value : r.value.toFixed(r.decimals)}`}>
          <div className={`font-display text-2xl font-extrabold tabular-nums ${tone(r.rank)}`}>{ordinal(r.rank)}</div>
          <div className="text-xs font-medium">{r.label}</div>
          <div className="text-[11px] text-muted-foreground">of {r.of}</div>
        </div>
      ))}
    </div>
  )
}
