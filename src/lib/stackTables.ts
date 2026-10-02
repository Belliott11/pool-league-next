// Marks the classic panels' tables that are narrow enough to read as stacked cards on a phone
// (see the "Phone: tables become stacked cards" CSS): a table gets `stack-rows` and every body cell
// gets its column title as `data-label`. Wide grids (heat maps, comparisons) are left alone. The
// classic code redraws a table's rows when it is sorted, so rows are labeled again whenever they
// change.
const MAX_COLUMNS = 8

function label(table: HTMLTableElement) {
  if (table.matches(".matchup-grid-table, .compare-table")) return
  const heads = [...table.querySelectorAll("thead th")].map((th) => (th.textContent ?? "").replace(/[▲▼↑↓]/g, "").trim())
  if (heads.length < 2 || heads.length > MAX_COLUMNS) return
  table.classList.add("stack-rows")
  table.querySelectorAll("tbody tr").forEach((tr) => {
    ;[...tr.children].forEach((td, i) => {
      if (heads[i] !== undefined && td.getAttribute("data-label") !== heads[i]) td.setAttribute("data-label", heads[i])
    })
  })
}

export function installStackTables() {
  const pending = new Set<HTMLTableElement>()
  let queued = false
  const flush = () => {
    queued = false
    pending.forEach(label)
    pending.clear()
  }
  const schedule = (table: HTMLTableElement | null) => {
    if (!table || !table.closest(".legacy")) return
    pending.add(table)
    if (!queued) {
      queued = true
      setTimeout(flush, 0)
    }
  }
  const scan = (root: ParentNode) => root.querySelectorAll<HTMLTableElement>(".legacy table").forEach(schedule)
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      const target = r.target as HTMLElement
      schedule(target.closest?.("table") ?? null)
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          schedule(n.closest("table"))
          scan(n)
        }
      })
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  scan(document)
  return () => observer.disconnect()
}
