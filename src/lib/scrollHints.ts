// Makes a table that scrolls sideways look like it does. Any table wider than its box (the shared table component, the classic tables
// and the Leaderboard grids) gets `data-more-right` while there is more to its right, which fades its right edge (index.css), and a line
// under it saying to swipe or scroll for more columns, until that table has been scrolled once. Tables that fit are left alone. Only the
// right edge fades: the main stat tables keep the player column pinned on the left, and a fade there would wash out the names.
const CONTAINERS = '[data-slot="table-container"], .table-scroll, .overflow-x-auto'
const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches

function hintFor(box: HTMLElement): HTMLElement {
  const next = box.nextElementSibling
  if (next instanceof HTMLElement && next.dataset.scrollHint !== undefined) return next
  const hint = document.createElement("p")
  hint.dataset.scrollHint = ""
  hint.className = "scroll-hint"
  hint.setAttribute("aria-hidden", "true") // the table itself is still reachable; this only helps the eye
  hint.textContent = touch ? "Swipe for more columns →" : "Scroll sideways for more columns →"
  box.after(hint)
  return hint
}

function update(box: HTMLElement) {
  if (!box.isConnected || !box.querySelector("table, [role=table], [role=grid]")) return
  const overflow = box.scrollWidth > box.clientWidth + 2
  const more = overflow && box.scrollLeft + box.clientWidth < box.scrollWidth - 2
  if (more) box.dataset.moreRight = ""
  else delete box.dataset.moreRight
  const hint = box.nextElementSibling instanceof HTMLElement && box.nextElementSibling.dataset.scrollHint !== undefined ? box.nextElementSibling : null
  const show = overflow && box.dataset.scrolled === undefined
  if (show) hintFor(box).hidden = false
  else if (hint) hint.hidden = true
}

export function installScrollHints(): () => void {
  const watched = new WeakSet<HTMLElement>()
  const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver((entries) => entries.forEach((e) => { const box = (e.target as HTMLElement).closest<HTMLElement>(CONTAINERS); if (box) update(box) })) : null
  const watch = (box: HTMLElement) => {
    if (watched.has(box)) return update(box)
    watched.add(box)
    box.addEventListener(
      "scroll",
      () => {
        if (box.scrollLeft > 4) box.dataset.scrolled = ""
        update(box)
      },
      { passive: true },
    )
    resize?.observe(box)
    // Its table can change width without the box changing (a column shown, data loaded), so watch that too.
    const table = box.querySelector("table")
    if (table) resize?.observe(table)
    update(box)
  }
  const scan = (root: ParentNode) => root.querySelectorAll<HTMLElement>(CONTAINERS).forEach(watch)
  let queued = false
  const observer = new MutationObserver(() => {
    if (queued) return
    queued = true
    setTimeout(() => {
      queued = false
      scan(document)
    }, 150)
  })
  scan(document)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    resize?.disconnect()
  }
}
