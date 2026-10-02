// Turns numbers that are only words in the classic panels into small visuals, after they are drawn:
// percent columns in tables get a data bar behind the figure, percent tiles get a progress bar, and
// "x of an even share" figures get a gauge. Everything is added to the page, never to the data, and
// the classic code redraws rows when it sorts, so the pass runs again whenever a table changes.
const PCT = /^(-?\d+(?:\.\d+)?)%$/
const PCT_IN_PARENS = /\((-?\d+(?:\.\d+)?)%\)\s*$/
const MULT = /^(\d+(?:\.\d+)?)x\b/

function pctOf(text: string): number | null {
  const t = text.trim()
  const m = PCT.exec(t) ?? PCT_IN_PARENS.exec(t)
  return m ? parseFloat(m[1]) : null
}

function barTable(table: HTMLTableElement) {
  if (table.matches(".matchup-grid-table, .compare-table")) return
  const rows = [...table.querySelectorAll<HTMLTableRowElement>("tbody tr")]
  const cols = Math.max(0, ...rows.map((r) => r.children.length))
  for (let c = 1; c < cols; c++) {
    const cells = rows.map((r) => r.children[c] as HTMLElement | undefined).filter((td): td is HTMLElement => !!td && !td.hasAttribute("colspan"))
    const filled = cells.filter((td) => td.textContent && td.textContent.trim() !== "" && !/^[-—–]$/.test(td.textContent.trim()))
    const parsed = filled.map((td) => pctOf(td.textContent ?? ""))
    const good = parsed.filter((v): v is number => v !== null)
    const isPctColumn = good.length >= 3 && good.length / Math.max(1, filled.length) >= 0.7
    // Cells that already carry their own color (heat maps) are left alone.
    const hasOwnFill = cells.some((td) => td.getAttribute("style")?.includes("background"))
    const scale = Math.max(100, ...good)
    cells.forEach((td) => {
      const v = isPctColumn && !hasOwnFill ? pctOf(td.textContent ?? "") : null
      if (v === null || v <= 0) {
        if (td.classList.contains("viz-cell")) {
          td.classList.remove("viz-cell")
          td.style.removeProperty("--w")
        }
        return
      }
      td.classList.add("viz-cell")
      td.style.setProperty("--w", `${Math.min(100, (v / scale) * 100).toFixed(1)}%`)
    })
  }
}

function barTile(tile: HTMLElement) {
  if (tile.querySelector(".viz-bar")) return
  const value = tile.querySelector(".profile-stat-value")
  const v = value ? pctOf(value.textContent ?? "") : null
  if (v === null) return
  const bar = document.createElement("div")
  bar.className = "viz-bar"
  bar.setAttribute("aria-hidden", "true")
  bar.innerHTML = `<span style="width:${Math.max(0, Math.min(100, v))}%"></span>`
  tile.appendChild(bar)
}

// Defensive Load: 1.0x is an even share of the team's defending, so the gauge has a center mark and
// fills outward from it. Neutral colors: more or less than an even share is not good or bad.
function gaugeScore(el: HTMLElement) {
  if (el.querySelector(".viz-gauge")) return
  const first = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)?.textContent ?? ""
  const m = MULT.exec(first.trim())
  if (!m) return
  const x = parseFloat(m[1])
  const pos = Math.max(0, Math.min(2, x)) / 2
  const g = document.createElement("div")
  g.className = "viz-gauge"
  g.setAttribute("aria-hidden", "true")
  const lo = Math.min(pos, 0.5) * 100
  const w = Math.abs(pos - 0.5) * 100
  g.innerHTML = `<span style="left:${lo}%;width:${w}%"></span><i></i>`
  el.appendChild(g)
  const scale = document.createElement("div")
  scale.className = "viz-gauge-scale"
  scale.setAttribute("aria-hidden", "true")
  scale.innerHTML = "<span>0x</span><span>1.0x, an even share</span><span>2x+</span>"
  el.appendChild(scale)
}

export function installDataViz() {
  const pending = new Set<HTMLElement>()
  let queued = false
  const apply = (el: HTMLElement) => {
    if (el instanceof HTMLTableElement) barTable(el)
    else if (el.matches(".profile-stat-tile")) barTile(el)
    else if (el.matches(".score-display")) gaugeScore(el)
  }
  const flush = () => {
    queued = false
    pending.forEach(apply)
    pending.clear()
  }
  const schedule = (el: Element | null) => {
    if (!(el instanceof HTMLElement) || !el.closest(".legacy")) return
    pending.add(el)
    if (!queued) {
      queued = true
      setTimeout(flush, 0)
    }
  }
  const scan = (root: ParentNode) => root.querySelectorAll(".legacy table, .legacy .profile-stat-tile, .legacy .score-display").forEach(schedule)
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      const target = r.target as HTMLElement
      schedule(target.closest?.("table") ?? null)
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          schedule(n.closest("table"))
          scan(n)
          if (n.matches(".profile-stat-tile, .score-display")) schedule(n)
        }
      })
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  scan(document)
  return () => observer.disconnect()
}
