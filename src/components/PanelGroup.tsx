import { ChevronRight } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { IconChip } from "@/components/IconChip"
import { Panel } from "@/components/Panel"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { panelIcon } from "@/lib/panelIcons"

export interface GroupTab {
  title: string // the panel's own title, used by search and jump
  label: string // the short tab name
  hint?: string
  tag?: string | null
  node: (opened: number) => ReactNode // `opened` counts how often the group was opened, so charts can draw to their width
}

// Related panels as one panel with a tab each. Only the open tab is built, so each panel's own drawing code runs when its
// tab is shown. A "panel-select" event (from search) switches to the tab for that panel's title.
export function PanelGroup({ title, section, tabs, frame }: { title: string; section: string; tabs: GroupTab[]; frame: "card" | "details" }) {
  const [active, setActive] = useState(tabs[0].title)
  const [opened, setOpened] = useState(0)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const on = (e: Event) => {
      const t = (e as CustomEvent<string>).detail
      if (tabs.some((x) => x.title === t)) setActive(t)
    }
    el.addEventListener("panel-select", on)
    return () => el.removeEventListener("panel-select", on)
  }, [tabs])
  const current = tabs.find((t) => t.title === active) ?? tabs[0]
  const body = (
    <Tabs value={current.title} onValueChange={(v) => setActive(String(v))}>
      <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1" aria-label={`${title} views`}>
        {tabs.map((t) => (
          <TabsTrigger key={t.title} value={t.title} className="h-auto flex-none px-3 py-1.5">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent key={current.title} value={current.title} className="flex min-w-0 flex-col gap-3">
        {current.hint && <p className="text-sm text-muted-foreground">{current.hint}</p>}
        {current.tag && <Badge variant="secondary" className="self-start">{current.tag}</Badge>}
        {current.node(opened)}
      </TabsContent>
    </Tabs>
  )
  const members = JSON.stringify(tabs.map((t) => t.title))
  if (frame === "card") {
    return (
      <div ref={ref as React.RefObject<HTMLDivElement>} data-group-members={members} data-group={title}>
        <Panel title={title}>{body}</Panel>
      </div>
    )
  }
  return (
    <details
      ref={ref as React.RefObject<HTMLDetailsElement>}
      className="group scroll-mt-20 rounded-xl border bg-card"
      data-player-panel={title}
      data-group-members={members}
      onToggle={(e) => e.currentTarget.open && setOpened((n) => n + 1)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        <IconChip icon={panelIcon(tabs[0].title, section)} />
        <h3 className="font-display text-base font-bold">{title}</h3>
      </summary>
      <div className="flex min-w-0 flex-col gap-3 p-4 pt-0">{body}</div>
    </details>
  )
}
