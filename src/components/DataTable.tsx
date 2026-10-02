import { useMemo, useState, type ReactNode } from "react"
import { EmptyState } from "@/components/EmptyState"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { compareForSort } from "@/lib/legacy-core"

// Column shape shared with the classic site's *_COLUMNS arrays (extracted into legacy-core.ts):
// accessor gives the sortable value, display (optional) the text shown.
export interface Column<R> {
  key: string
  label: string
  accessor: (r: R) => unknown
  display?: (r: R) => string
  tooltip?: string
  advanced?: boolean
}

export interface Sort {
  key: string
  dir: "asc" | "desc"
}

interface Props<R> {
  columns: Column<R>[]
  rows: R[]
  rowKey: (r: R, i: number) => string
  defaultSort?: Sort
  // The first column (usually the player) renders custom content, e.g. an avatar and link.
  renderFirst?: (r: R) => ReactNode
  // Column that gets the big number on the mobile card (defaults to the current sort column).
  heroKey?: string
  // Mark whoever leads / trails each numeric column, given which columns are neutral / lower-better.
  highlight?: { neutral: Set<string>; lowerBetter: Set<string>; skip?: Set<string> }
  empty?: string
  emptyHint?: string
}

// Where a value sits in its column: bars grow from zero, so a column with negatives draws aqua to the
// right of the zero line and crimson to the left, and an all-positive column is a plain neutral bar.
interface Range {
  lo: number
  hi: number
}
function geometry(v: number, r: Range) {
  const span = r.hi - r.lo
  const zero = ((0 - r.lo) / span) * 100
  const p = ((v - r.lo) / span) * 100
  return { left: Math.min(p, zero), width: Math.abs(p - zero) }
}
function barTone(v: number, r: Range, mode: "plain" | "sorted" | "strong") {
  if (r.lo < 0) {
    if (mode === "strong") return v < 0 ? "bg-neg/60" : "bg-pos/60"
    return v < 0 ? "bg-neg/25" : "bg-pos/25"
  }
  if (mode === "strong") return "bg-foreground/35"
  return mode === "sorted" ? "bg-primary/15" : "bg-foreground/[0.07]"
}

function cellText<R>(col: Column<R>, r: R): string {
  if (col.display) return col.display(r)
  const v = col.accessor(r)
  return v === null || v === undefined ? "-" : String(v)
}

// The classic site's cell formatters sometimes return small HTML snippets (a line break and a hint
// span). They are built from our own numbers and escaped names, so they are rendered as markup.
function Cell<R>({ col, r }: { col: Column<R>; r: R }) {
  const text = cellText(col, r)
  return text.includes("<") ? <span dangerouslySetInnerHTML={{ __html: text }} /> : <>{text}</>
}

export function DataTable<R>({ columns, rows, rowKey, defaultSort, renderFirst, heroKey, highlight, empty, emptyHint }: Props<R>) {
  const [sort, setSort] = useState<Sort | null>(defaultSort ?? null)

  const sorted = useMemo(() => {
    const col = sort ? columns.find((c) => c.key === sort.key) : undefined
    if (!col || !sort) return rows
    return [...rows].sort((a, b) => compareForSort(col.accessor(a), col.accessor(b), sort.dir))
  }, [rows, columns, sort])

  const marks = useMemo(() => {
    const best: Record<string, number> = {}
    const worst: Record<string, number> = {}
    if (!highlight) return { best, worst }
    columns.forEach((col, i) => {
      if (i === 0 || highlight.neutral.has(col.key) || highlight.skip?.has(col.key)) return
      const values = rows.map((r) => col.accessor(r)).filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
      if (values.length === 0) return
      const lower = highlight.lowerBetter.has(col.key)
      const b = lower ? Math.min(...values) : Math.max(...values)
      const w = lower ? Math.max(...values) : Math.min(...values)
      best[col.key] = b
      if (w !== b) worst[col.key] = w
    })
    return { best, worst }
  }, [rows, columns, highlight])

  const ranges = useMemo(() => {
    const out: Record<string, Range> = {}
    columns.forEach((col, i) => {
      if (i === 0 || col.key === "last5" || highlight?.skip?.has(col.key)) return
      const vals = rows.map((r) => col.accessor(r)).filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      if (vals.length < 2) return
      const lo = Math.min(0, ...vals)
      const hi = Math.max(0, ...vals)
      if (hi - lo > 0) out[col.key] = { lo, hi }
    })
    return out
  }, [rows, columns, highlight])

  function toggle(key: string) {
    setSort((cur) => (cur?.key === key ? { key, dir: cur.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }))
  }

  if (rows.length === 0) return <EmptyState title={empty ?? "Nothing to show yet"} hint={emptyHint} />

  const first = columns[0]
  const hero = columns.find((c) => c.key === (heroKey ?? sort?.key)) ?? columns[1]

  return (
    <>
      <div className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, i) => (
                <TableHead
                  key={col.key}
                  title={col.tooltip}
                  className={`cursor-pointer select-none ${i === 0 ? "sticky left-0 z-10 bg-card" : ""} ${sort?.key === col.key ? "text-accent" : ""}`}
                  onClick={() => toggle(col.key)}
                >
                  {col.label}
                  {sort?.key === col.key ? (sort.dir === "desc" ? " ▼" : " ▲") : ""}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r, i) => (
              <TableRow key={rowKey(r, i)}>
                {columns.map((col, i) => {
                  if (i === 0) {
                    return (
                      <TableCell key={col.key} className="sticky left-0 z-10 bg-card font-medium">
                        {renderFirst ? renderFirst(r) : <Cell col={col} r={r} />}
                      </TableCell>
                    )
                  }
                  const v = col.accessor(r)
                  const isBest = marks.best[col.key] !== undefined && v === marks.best[col.key]
                  const isWorst = marks.worst[col.key] !== undefined && v === marks.worst[col.key]
                  return (
                    <TableCell
                      key={col.key}
                      title={isBest ? "Season leader in this column" : isWorst ? "Season worst in this column" : undefined}
                      className={`relative tabular-nums ${isBest ? "bg-pos/15 text-pos font-semibold" : ""} ${isWorst ? "bg-neg/15 text-neg" : ""}`}
                    >
                      {ranges[col.key] && typeof v === "number" && Number.isFinite(v) && (
                        <span
                          aria-hidden
                          className={`pointer-events-none absolute inset-y-1 rounded-sm ${barTone(v, ranges[col.key], sort?.key === col.key ? "sorted" : "plain")}`}
                          style={{ left: `${geometry(v, ranges[col.key]).left}%`, width: `${geometry(v, ranges[col.key]).width}%` }}
                        />
                      )}
                      <span className="relative">
                        <Cell col={col} r={r} />
                      </span>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {sorted.map((r, i) => (
          <Card key={rowKey(r, i)}>
            <CardContent className="flex flex-col gap-2">
              <div className="font-medium">{renderFirst ? renderFirst(r) : <Cell col={first} r={r} />}</div>
              {hero && hero.key !== first.key && (
                <div className="flex items-baseline justify-between rounded-md bg-accent/10 px-3 py-2">
                  <span className="text-xs text-muted-foreground">{hero.label}</span>
                  <span className="font-display text-2xl font-bold tabular-nums text-accent"><Cell col={hero} r={r} /></span>
                </div>
              )}
              {columns
                .filter((c) => c.key !== first.key && c.key !== hero?.key)
                .map((c) => {
                  const v = c.accessor(r)
                  const rg = ranges[c.key]
                  return (
                    <div key={c.key} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{c.label}</span>
                        <span className="text-right tabular-nums font-medium"><Cell col={c} r={r} /></span>
                      </div>
                      {rg && typeof v === "number" && Number.isFinite(v) && (
                        <div className="relative h-1 rounded-full bg-muted">
                          <span
                            aria-hidden
                            className={`absolute inset-y-0 rounded-full ${barTone(v, rg, "strong")}`}
                            style={{ left: `${geometry(v, rg).left}%`, width: `${geometry(v, rg).width}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
