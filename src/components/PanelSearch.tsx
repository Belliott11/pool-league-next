import { useEffect, useId, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { jumpToPanel } from "@/lib/jump"

export interface JumpItem {
  title: string
  group: string
  sectionId: string | null
  hint?: string
}

// "Jump to a panel": type part of a name (or a word from its description) and go straight to it,
// opening its group on the way. Press / anywhere to focus it.
export function PanelSearch({ items, placeholder = "Jump to a panel" }: { items: JumpItem[]; placeholder?: string }) {
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  const listId = useId()
  const needle = q.trim().toLowerCase()
  const results = needle
    ? items
        .filter((i) => `${i.title} ${i.group} ${i.hint ?? ""}`.toLowerCase().includes(needle))
        .sort((a, b) => Number(b.title.toLowerCase().includes(needle)) - Number(a.title.toLowerCase().includes(needle)))
        .slice(0, 8)
    : []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function go(item: JumpItem) {
    setQ("")
    setActive(0)
    ref.current?.blur()
    jumpToPanel(item.sectionId, item.title)
  }

  return (
    <div className="relative">
      <Input
        ref={ref}
        type="search"
        role="combobox"
        aria-expanded={!!needle}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        value={q}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault()
            go(results[active])
          } else if (e.key === "Escape") {
            setQ("")
          }
        }}
      />
      {needle && (
        <div id={listId} role="listbox" className="absolute inset-x-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No panel matches that.</p>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.group}-${r.title}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                type="button"
                className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left ${i === active ? "bg-muted" : "hover:bg-muted"}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
              >
                <span className="text-sm font-semibold">{r.title}</span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{r.group}{r.hint ? `: ${r.hint}` : ""}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
