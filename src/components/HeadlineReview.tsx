import { Check, ClipboardCopy, ThumbsDown, Undo2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { APPROVED, HIDDEN, SENT, useLabels } from "@/lib/labelsContext"
import { buildCatalog } from "@/lib/lineCatalog"
import { lineKey } from "@/lib/labels"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

type View = "new" | "ok" | "no"

// Go through every wording the headline writers can use: approve it, or remove it. Approved wordings come up more
// often and removed ones never do. One button copies the newly removed lines for Claude to rewrite.
export function HeadlineReview({ state }: { state: PooleanState }) {
  const { labels, reviewLine, setPlayerLabels } = useLabels()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>("new")
  const [source, setSource] = useState("")
  const [withTypes, setWithTypes] = useState(false)
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState("")
  const catalog = useMemo(() => (open ? buildCatalog(state) : []), [open, state])
  const okKeys = new Set((labels[APPROVED] ?? []).map(lineKey))
  const noKeys = new Set((labels[HIDDEN] ?? []).map(lineKey))
  const verdict = (key: string): View => (okKeys.has(key) ? "ok" : noKeys.has(key) ? "no" : "new")
  // The player type lines (Gunner, Brick Layer and the rest) are many, so they are kept out of the review list unless asked for.
  const kind = (c: { source: string }) => (c.source.startsWith("Label") ? "Player types" : c.source.replace(/:.*$/, ""))
  const groups = [...new Set(catalog.map(kind))]
  // A type of line is finished once enough of its wordings are approved; its other wordings are not asked about again.
  const approvedIn = new Map<string, number>()
  for (const c of catalog) if (verdict(c.key) === "ok") approvedIn.set(c.group, (approvedIn.get(c.group) ?? 0) + 1)
  const full = (c: { group: string; cap: number }) => (approvedIn.get(c.group) ?? 0) >= c.cap
  const pending = (c: { key: string; group: string; cap: number; source: string }) => verdict(c.key) === "new" && !full(c) && (withTypes || source === "Player types" || kind(c) !== "Player types")
  const shownIn = (v: View, c: { key: string; group: string; cap: number; source: string }) => (v === "new" ? pending(c) : verdict(c.key) === v)
  const rows = catalog.filter((c) => shownIn(view, c) && (!source || kind(c) === source))
  const count = (v: View) => catalog.filter((c) => shownIn(v, c)).length
  // Removed lines only need a replacement while their type is not already finished.
  const rejected = catalog.filter((c) => verdict(c.key) === "no" && !full(c))
  const finished = new Set(catalog.filter(full).map((c) => c.group)).size
  const typeLines = catalog.filter((c) => kind(c) === "Player types" && verdict(c.key) === "new" && !full(c)).length

  // One tap: the removed lines not sent before, plus the latest approved ones as the standard. They are marked as sent
  // so the next copy only has what you have removed since.
  const sentKeys = new Set((labels[SENT] ?? []).map(lineKey))
  const unsent = rejected.filter((r) => !sentKeys.has(r.key))
  const copyRejected = () => {
    const liked = (labels[APPROVED] ?? []).slice(-10)
    const byKind = new Map<string, string[]>()
    for (const r of unsent) byKind.set(r.source, [...(byKind.get(r.source) ?? []), r.text])
    // How many new lines each kind needs to be finished: its cap minus what is already approved.
    const needed = (kindName: string) => {
      const r = unsent.find((x) => x.source === kindName)
      return r ? Math.max(1, r.cap - (approvedIn.get(r.group) ?? 0)) : 1
    }
    const text = [
      "Rewrite these rejected headlines for my pool league app. For each kind below, write the number of new lines shown next to it (that is how many it still needs to be finished), not one per rejected line: more personality and more fun at people's expense, same facts and blanks, no em dashes. Match my approved style (see memory).",
      ...(liked.length ? ["", "Latest approved:", ...liked.map((t) => `+ ${t}`)] : []),
      "",
      "Rejected:",
      ...[...byKind].flatMap(([kindName, texts]) => [`[${kindName}] write ${needed(kindName)}`, ...texts.map((t) => `- ${t}`)]),
    ].join("\n")
    const sent = () => setPlayerLabels(SENT, (cur) => [...cur, ...unsent.map((r) => r.text)].slice(-300))
    // If the browser will not let the app use the clipboard, show the text to copy by hand instead.
    const manually = () => {
      setManual(text)
      sent()
    }
    if (!navigator.clipboard) return manually()
    navigator.clipboard.writeText(text).then(
      () => {
        sent()
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      },
      manually,
    )
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
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
            <Button size="sm" disabled={unsent.length === 0} onClick={copyRejected}>
              <ClipboardCopy aria-hidden /> {copied ? "Copied" : unsent.length ? `Copy ${unsent.length} removed for Claude` : "Nothing new to send"}
            </Button>
            <span className="min-w-0 flex-1 text-xs text-muted-foreground">{copied ? "Now paste it to Claude. Those lines will not be in the next copy." : "Review, tap this, paste it to Claude. That is the whole loop."}</span>
          </div>
          {manual && <textarea readOnly autoFocus value={manual} onFocus={(e) => e.currentTarget.select()} aria-label="Text to copy" className="h-40 w-full rounded-lg border bg-background p-2 text-xs" />}
          <p className="text-xs text-muted-foreground">
            Approve what you like, remove what you do not. Removed lines are gone everywhere. A type with 3 approved (8 for injury notes) is finished and stops asking. A player type only needs 1 approved line.
          </p>
          {typeLines > 0 && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={withTypes} onChange={(e) => setWithTypes(e.target.checked)} />
              Also review the {typeLines} player type lines (they work as written if you skip them)
            </label>
          )}
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
          <ul className="flex flex-col gap-2">
            {rows.slice(0, 60).map((r) => (
              <li key={r.key} className="flex items-start gap-2 rounded-lg border bg-card p-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">
                    {r.source} · {Math.min(approvedIn.get(r.group) ?? 0, r.cap)} of {r.cap} approved{view === "no" && sentKeys.has(r.key) ? " · sent" : ""}
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
