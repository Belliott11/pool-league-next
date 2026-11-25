import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface PageTab {
  key: string
  title: string
}

// A page's sections as a row of tabs (Player page, Leaderboard). Arrow keys move between them; on a phone the row scrolls sideways
// and stays pinned under the header while the page scrolls. `id` keeps two pages' tab ids apart.
export function PageTabs({ id, label, tabs, value, onChange, children }: { id: string; label: string; tabs: PageTab[]; value: string; onChange: (key: string) => void; children: ReactNode }) {
  const tabId = (k: string) => `${id}-tab-${k}`
  const top = useHeaderHeight()
  return (
    <>
      <div role="tablist" aria-label={label} data-no-swipe style={{ top }} className="sticky z-20 -mx-4 flex gap-1 overflow-x-auto border-b bg-background/90 px-4 backdrop-blur [scrollbar-width:none] md:mx-0 md:px-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            id={tabId(t.key)}
            role="tab"
            type="button"
            aria-selected={value === t.key}
            aria-controls={`${id}-panel`}
            tabIndex={value === t.key ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.key === value)
              const next = e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length] : e.key === "ArrowLeft" ? tabs[(i - 1 + tabs.length) % tabs.length] : null
              if (next) {
                onChange(next.key)
                document.getElementById(tabId(next.key))?.focus()
              }
            }}
            className={cn(
              "-mb-px min-h-11 shrink-0 border-b-2 px-3 font-display text-sm font-semibold whitespace-nowrap transition-colors",
              value === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.title}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={tabId(value)} className="flex min-w-0 flex-col gap-4">
        {children}
      </div>
    </>
  )
}

// The site header is pinned too, and its height changes as the page scrolls, so the tab row pins just below it.
export function useHeaderHeight() {
  const [h, setH] = useState(0)
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-header-menus]")
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => setH(el.getBoundingClientRect().height))
    ro.observe(el, { box: "border-box" })
    return () => ro.disconnect()
  }, [])
  return h
}

// The tab to show, switched when "Jump to a panel" names a group (the `panel-section` event from src/lib/jump.ts). `tabOf` maps a
// group's element id to its tab.
export function useJumpTab(first: string, tabOf: (sectionId: string) => string | null) {
  const [tab, setTab] = useState(first)
  useEffect(() => {
    const on = (e: Event) => {
      const t = tabOf(String((e as CustomEvent).detail ?? ""))
      if (t) setTab(t)
    }
    document.addEventListener("panel-section", on)
    return () => document.removeEventListener("panel-section", on)
    // tabOf is a module-level mapping on both pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return [tab, setTab] as const
}

// One group inside a tab: its one-line summary, and a heading when the tab holds more than one group.
export function TabGroup({ id, title, teaser, icon: Icon, children }: { id: string; title: string | null; teaser: string; icon?: React.ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-4">
      {(title || teaser) && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {title && (
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              {Icon && <Icon aria-hidden className="size-4 text-accent" />}
              {title}
            </h2>
          )}
          {teaser && <span className="text-sm text-muted-foreground">{teaser}</span>}
        </div>
      )}
      {children}
    </section>
  )
}
