// Opens the group a panel lives in, waits for the panel to be built, scrolls to it and rings it
// briefly so the eye finds it. Panels are found by the `data-panel` / `data-player-panel` title.
export function jumpToPanel(sectionId: string | null, title: string) {
  if (sectionId) {
    const section = document.getElementById(sectionId) as HTMLDetailsElement | null
    if (section) section.open = true
  }
  const selector = `[data-panel=${JSON.stringify(title)}], [data-player-panel=${JSON.stringify(title)}]`
  let tries = 0
  const go = () => {
    const el = document.querySelector<HTMLElement>(selector)
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
