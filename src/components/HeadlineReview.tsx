import { Check, ClipboardCopy, ThumbsDown, Undo2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { APPROVED, HIDDEN, useLabels } from "@/lib/labelsContext"
import { buildCatalog } from "@/lib/lineCatalog"
import { lineKey } from "@/lib/labels"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

type View = "new" | "ok" | "no"

// Go through every wording the headline writers can use: approve it, or remove it. Approved wordings come up more
// often and removed ones never do. New wordings are written from the removed ones, using the approved ones as the standard: copy them and send them over.
export function HeadlineReview({ state }: { state: PooleanState }) {
  const { labels, reviewLine } = useLabels()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>("new")
  const [source, setSource] = useState("")
  const [copied, setCopied] = useState(false)
  const catalog = useMemo(() => (open ? buildCatalog(state) : []), [open, state])
  const okKeys = new Set((labels[APPROVED] ?? []).map(lineKey))
  const noKeys = new Set((labels[HIDDEN] ?? []).map(lineKey))
  const verdict = (key: string): View => (okKeys.has(key) ? "ok" : noKeys.has(key) ? "no" : "new")
  const groups = [...new Set(catalog.map((c) => c.source.replace(/:.*$/, "")))]
  // A type of line is finished once enough of its wordings are approved; its other wordings are not asked about again.
  const approvedIn = new Map<string, number>()
  for (const c of catalog) if (verdict(c.key) === "ok") approvedIn.set(c.group, (approvedIn.get(c.group) ?? 0) + 1)
  const full = (c: { group: string; cap: number }) => (approvedIn.get(c.group) ?? 0) >= c.cap
  const pending = (c: { key: string; group: string; cap: number }) => verdict(c.key) === "new" && !full(c)
  const shownIn = (v: View, c: { key: string; group: string; cap: number }) => (v === "new" ? pending(c) : verdict(c.key) === v)
  const rows = catalog.filter((c) => shownIn(view, c) && (!source || c.source.startsWith(source)))
  const count = (v: View) => catalog.filter((c) => shownIn(v, c)).length
  // Removed lines only need a replacement while their type is not already finished.
  const rejected = catalog.filter((c) => verdict(c.key) === "no" && !full(c))
  const finished = new Set(catalog.filter(full).map((c) => c.group)).size

  // What goes to Claude to write more: the removed lines to replace, and the approved ones as the standard to match.
  const copyRejected = () => {
    const liked = catalog.filter((c) => verdict(c.key) === "ok")
    const intro = "These headlines for my pool league app were rejected. For each one, write 2 new versions with more personality and more fun at people's expense, in different shapes (not always a stat then a quip), keeping the same facts and blanks. No em dashes."
    const likedBlock = liked.length ? ["", "Here are lines I approved. Match what they do well: specific, everyday and relatable, deadpan, about how people behave.", ...liked.slice(0, 40).map((r) => `+ [${r.source}] ${r.text}`)] : []
    const text = [intro, ...likedBlock, "", "Rejected:", ...rejected.map((r) => `- [${r.source}] ${r.text}`)].join("\n")
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="font-display">Review headlines</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
          {open ? "Close" : "Open"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Approve the lines you like and remove the ones you do not. A removed line is gone for every player and every night. Approved lines come up twice as often. Once a type of line has 3 approved (8 for injury notes), only the approved ones are used and the rest stop appearing here, so there is an end. Recap lines show up here once that moment has happened in your games.
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
            {(["new", "ok", "no"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn("min-h-9 rounded-lg border px-3 text-sm font-medium", view === v ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
              >
                {v === "new" ? "To review" : v === "ok" ? "Approved" : "Removed"} ({count(v)})
              </button>
            ))}
            <select className="ml-auto h-9 rounded-md border bg-background px-2 text-sm" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Kind of line">
              <option value="">All kinds</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          {view === "no" && rejected.length > 0 && (
            <Button size="sm" variant="outline" className="self-start" onClick={copyRejected}>
              <ClipboardCopy aria-hidden /> {copied ? "Copied" : "Copy removed and approved lines to get new ones"}
            </Button>
          )}
          <ul className="flex flex-col gap-2">
            {rows.slice(0, 60).map((r) => (
              <li key={r.key} className="flex items-start gap-2 rounded-lg border bg-card p-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">
                    {r.source} · {Math.min(approvedIn.get(r.group) ?? 0, r.cap)} of {r.cap} approved
                  </span>
                  {r.text}
                </span>
                {view !== "ok" && (
                  <Button size="icon" variant="outline" className="size-9 shrink-0" aria-label="Approve this line" onClick={() => reviewLine(r.text, "ok")}>
                    <Check />
                  </Button>
                )}
                {view !== "no" && (
                  <Button size="icon" variant="outline" className="size-9 shrink-0" aria-label="Remove this line" onClick={() => reviewLine(r.text, "no")}>
                    <ThumbsDown />
                  </Button>
                )}
                {view !== "new" && (
                  <Button size="icon" variant="ghost" className="size-9 shrink-0" aria-label="Back to review" onClick={() => reviewLine(r.text, "clear")}>
                    <Undo2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {rows.length > 60 && <p className="text-center text-xs text-muted-foreground">Showing 60 of {rows.length}. Review these and the next ones appear.</p>}
          {rows.length === 0 && <p className="text-center text-sm text-muted-foreground">Nothing here.</p>}
          {view === "new" && finished > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              {finished} {finished === 1 ? "type is" : "types are"} finished and no longer asking for review.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
