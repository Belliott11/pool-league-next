import { ChevronDown, ChevronUp } from "lucide-react"
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
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

// How a cell sorts, read from what it shows: "8 of 16 (50%)" by its percentage, "+0.38" or "1.23x" or "58%" by the number, trust chips
// by how much is behind them, names by name. A blank or "-" always sorts last.
const TRUST_ORDER: Record<string, number> = { "too early": 0, "some data": 1, steady: 2 }
export function sortValue(text: string): number | string | null {
  const t = text.trim().replace(/−/g, "-")
  if (!t || t === "-") return null
  const lower = t.toLowerCase()
  if (lower in TRUST_ORDER) return TRUST_ORDER[lower]
  const paren = t.match(/\((-?\d+(?:\.\d+)?)%\)/)
  if (paren) return parseFloat(paren[1])
  const num = t.replace(/,/g, "").match(/^[+-]?\d+(?:\.\d+)?/)
  if (num) return parseFloat(num[0])
  return lower
}

type GridRow = { key: string; cells: ReactNode[]; pin?: boolean }

// A table that scrolls sideways inside its own box. Click a column header to sort by it (again to flip); pinned rows, like a league
// middle, stay on top.
export function Grid({ head, rows, mark, min = "22rem" }: { head: string[]; rows: GridRow[]; mark?: number; min?: string }) {
  const body = useRef<HTMLTableSectionElement>(null)
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null)
  const [order, setOrder] = useState<string[] | null>(null)
  const markKey = mark === undefined ? null : rows[mark]?.key
  // Read the shown text of each row in a column and work out the order from it.
  const orderBy = (col: number, dir: 1 | -1): string[] => {
    const vals = new Map<string, number | string | null>()
    body.current?.querySelectorAll<HTMLTableRowElement>("tr[data-key]").forEach((tr) => vals.set(tr.dataset.key!, sortValue(tr.children[col]?.textContent ?? "")))
    return rows
      .filter((r) => !r.pin)
      .map((r, i) => ({ k: r.key, v: vals.get(r.key) ?? null, i }))
      .sort((a, b) => {
        if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1
        if (typeof a.v === "number" && typeof b.v === "number") return (a.v - b.v) * dir || a.i - b.i
        return String(a.v).localeCompare(String(b.v)) * dir || a.i - b.i
      })
      .map((x) => x.k)
  }
  const click = (col: number) => {
    // Names start A to Z; numbers start highest first.
    const dir: 1 | -1 = sort?.col === col ? (sort.dir === 1 ? -1 : 1) : col === 0 ? 1 : -1
    setSort({ col, dir })
    setOrder(orderBy(col, dir))
  }
  // New data keeps the chosen sort.
  useLayoutEffect(() => {
    if (!sort) return
    const next = orderBy(sort.col, sort.dir)
    if (!order || next.join("|") !== order.join("|")) setOrder(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])
  const pinned = rows.filter((r) => r.pin)
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const rest = order ? [...order.map((k) => byKey.get(k)).filter((r): r is GridRow => !!r && !r.pin), ...rows.filter((r) => !r.pin && !order.includes(r.key))] : rows.filter((r) => !r.pin)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums" style={{ minWidth: min }}>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={h + i} className={i === 0 ? "py-1 pr-2 font-medium" : "px-2 py-1 text-right font-medium"} aria-sort={sort?.col === i ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                {h ? (
                  <button type="button" onClick={() => click(i)} className={`inline-flex items-center gap-0.5 hover:text-foreground ${sort?.col === i ? "text-accent" : ""}`}>
                    {h}
                    {sort?.col === i && (sort.dir === 1 ? <ChevronUp aria-hidden className="size-3" /> : <ChevronDown aria-hidden className="size-3" />)}
                  </button>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={body}>
          {[...pinned, ...rest].map((r) => (
            <tr key={r.key} data-key={r.pin ? undefined : r.key} className={r.key === markKey ? "border-t bg-muted/60" : "border-t"}>
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
