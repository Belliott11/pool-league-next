// Opens the group a panel lives in, waits for the panel to be built, scrolls to it and rings it
// briefly so the eye finds it. Panels are found by the `data-panel` / `data-player-panel` title.
export function jumpToPanel(sectionId: string | null, title: string) {
  if (sectionId) {
    // A page that shows its groups as tabs (the Player page) switches to the right one.
    document.dispatchEvent(new CustomEvent("panel-section", { detail: sectionId }))
    const section = document.getElementById(sectionId) as HTMLDetailsElement | null
    if (section) section.open = true
  }
  const selector = `[data-panel=${JSON.stringify(title)}], [data-player-panel=${JSON.stringify(title)}]`
  // A panel inside a tabbed group: find the group that lists it and ask it to show that tab.
  const inGroup = () => [...document.querySelectorAll<HTMLElement>("[data-group-members]")].find((g) => (JSON.parse(g.dataset.groupMembers ?? "[]") as string[]).includes(title))
  let tries = 0
  const go = () => {
    const grouped = inGroup()
    if (grouped) grouped.dispatchEvent(new CustomEvent("panel-select", { detail: title }))
    const el = grouped ?? document.querySelector<HTMLElement>(selector)
    if (!el) {
      // The group builds its panels just after opening; look again for about a second.
      if (tries++ < 20) setTimeout(go, 60)
      return
    }
    if (el instanceof HTMLDetailsElement) el.open = true
    el.scrollIntoView({ behavior: "smooth", block: "start" })
    el.classList.add("ring-2", "ring-primary")
    setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1800)
  }
  go()
}

// Open a tab of a tabbed page (the Player page's Film tab, say) from somewhere else. The page may not be built yet when it is
// opened from another tab, so the wish is also kept until the page's useJumpTab picks it up.
let pending: { page: string; tab: string } | null = null
export function openPageTab(page: string, tab: string) {
  pending = { page, tab }
  document.dispatchEvent(new CustomEvent("page-tab", { detail: { page, tab } }))
}
export function takePendingTab(page: string): string | null {
  if (pending?.page !== page) return null
  const t = pending.tab
  pending = null
  return t
}
