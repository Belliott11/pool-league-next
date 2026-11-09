import type { ReactNode } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { VERDICT_LABEL, type Verdict } from "@/lib/gameFlow"
import { playerName } from "@/lib/players"
import { TRUST_LABEL, type Trust } from "@/lib/trust"
import type { PooleanState } from "@/lib/types"

// Small pieces the league cards share: a hint line, a player cell that opens the player, and a table that scrolls
// sideways inside its own box on a phone.
export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

const chip = "inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground"
// How much is behind a number.
export function TrustChip({ t }: { t: Trust }) {
  return <span className={`${chip} ${t === "steady" ? "border-primary bg-primary/15 text-primary" : t === "some" ? "border-gold text-gold" : ""}`}>{TRUST_LABEL[t]}</span>
}
// Whether a difference or link is real.
export function SureChip({ v }: { v: Verdict }) {
  return <span className={`${chip} self-start ${v === "clear" ? "border-primary bg-primary/15 text-primary" : v === "hint" ? "border-gold text-gold" : ""}`}>{VERDICT_LABEL[v]}</span>
}

export function Who({ state, id, onOpenPlayer }: { state: PooleanState; id: string; onOpenPlayer: (id: string) => void }) {
  return (
    <button type="button" className="flex min-w-0 items-center gap-2 text-left hover:underline" onClick={() => onOpenPlayer(id)}>
      <PlayerAvatar id={id} name={playerName(state, id)} size="sm" />
      <span className="truncate font-medium">{playerName(state, id)}</span>
    </button>
  )
}

export function Grid({ head, rows, mark, min = "22rem" }: { head: string[]; rows: { key: string; cells: ReactNode[] }[]; mark?: number; min?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums" style={{ minWidth: min }}>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={i === 0 ? "py-1 pr-2 font-medium" : "px-2 py-1 text-right font-medium"}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} className={i === mark ? "border-t bg-muted/60" : "border-t"}>
              {r.cells.map((c, j) => (
                <td key={j} className={j === 0 ? "py-1.5 pr-2" : "px-2 py-1.5 text-right"}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// A number whose cell is shaded by size and direction, so a column reads as a graph. `max` is the largest size in the column.
export function Heat({ v, max, text }: { v: number; max: number; text: string }) {
  const a = Math.round(Math.min(1, Math.abs(v) / (max || 1)) * 45)
  return (
    <span className="inline-block min-w-12 rounded px-1.5 py-0.5" style={{ background: `color-mix(in oklab, ${v >= 0 ? "var(--primary)" : "var(--muted-foreground)"} ${a}%, transparent)` }}>
      {text}
    </span>
  )
}
