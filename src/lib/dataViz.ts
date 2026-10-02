// Turns numbers that are only words in the classic panels into small visuals, after they are drawn:
// percent columns in tables get a data bar behind the figure, percent tiles get a progress bar, and
// "x of an even share" figures get a gauge. Everything is added to the page, never to the data, and
// the classic code redraws rows when it sorts, so the pass runs again whenever a table changes.
const PCT = /^(-?\d+(?:\.\d+)?)%$/
const PCT_IN_PARENS = /\((-?\d+(?:\.\d+)?)%\)\s*$/
const MULT = /^(\d+(?:\.\d+)?)x\b/
const RECORD = /^(\d+)-(\d+)(?:-(\d+))?$/
const SVG = "http://www.w3.org/2000/svg"

// Wins in aqua, ties in grey, losses in crimson, as one split bar.
function splitBar(w: number, l: number, t = 0): HTMLElement | null {
  const total = w + l + t
  if (total === 0) return null
  const el = document.createElement("div")
  el.className = "viz-split"
  el.setAttribute("role", "img")
  el.setAttribute("aria-label", `${w} wins, ${l} losses${t ? `, ${t} ties` : ""}`)
  el.innerHTML = `<span class="pos" style="width:${(w / total) * 100}%"></span><span class="tie" style="width:${(t / total) * 100}%"></span><span class="neg" style="width:${(l / total) * 100}%"></span>`
  return el
}

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
    const head = table.querySelectorAll("thead th")[c]?.textContent ?? ""
    if (/record|w-l/i.test(head)) {
      cells.forEach((td) => {
        const m = RECORD.exec((td.textContent ?? "").trim())
        if (!m || td.querySelector(".viz-split")) return
        const bar = splitBar(+m[1], +m[2], m[3] ? +m[3] : 0)
        if (bar) td.appendChild(bar)
      })
    }
    const filled = cells.filter((td) => td.textContent && td.textContent.trim() !== "" && !/^[-—–]$/.test(td.textContent.trim()))
    const parsed = filled.map((td) => pctOf(td.textContent ?? ""))
    const good = parsed.filter((v): v is number => v !== null)
    const isPctColumn = (good.length >= 3 || (cells.length <= 2 && good.length >= 1)) && good.length / Math.max(1, filled.length) >= 0.7
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

// Streak, record and percent tiles: pips for a streak, a split bar for a record, a progress bar for a rate.
function barBadge(el: HTMLElement) {
  if (el.querySelector(".viz-bar, .viz-split, .viz-pips")) return
  const place = (el.querySelector(".league-rank-place")?.textContent ?? "").trim()
  const label = el.querySelector(".league-rank-label")?.textContent ?? ""
  const pct = PCT.exec(place)
  const rec = RECORD.exec(place)
  const streak = /^\D*(\d+)$/.exec(place)
  if (pct) {
    const bar = document.createElement("div")
    bar.className = "viz-bar"
    bar.setAttribute("aria-hidden", "true")
    bar.innerHTML = `<span style="width:${Math.max(0, Math.min(100, parseFloat(pct[1])))}%"></span>`
    el.appendChild(bar)
  } else if (rec) {
    const bar = splitBar(+rec[1], +rec[2], rec[3] ? +rec[3] : 0)
    if (bar) el.appendChild(bar)
  } else if (streak && /streak/i.test(label) && !/total/i.test(label)) {
    const n = +streak[1]
    const shown = Math.min(n, 12)
    const kind = /losing/i.test(label) ? "neg" : "pos"
    const pips = document.createElement("div")
    pips.className = "viz-pips"
    pips.setAttribute("role", "img")
    pips.setAttribute("aria-label", `${n} in a row`)
    pips.innerHTML = `<i class="${kind}"></i>`.repeat(shown) + (n > shown ? `<b>+${n - shown}</b>` : "")
    el.appendChild(pips)
  }
}

// Real Site Seasons: once there are two or more seasons, trend lines for Win % and Power %.
function sparkSeasons(table: HTMLTableElement) {
  const box = table.closest("#playerRealSeasons")
  if (!box) return
  box.querySelector(".viz-spark")?.remove()
  const heads = [...table.querySelectorAll("thead th")].map((th) => (th.textContent ?? "").trim())
  const rows = [...table.querySelectorAll("tbody tr")]
    .map((tr) => ({ season: parseInt((tr.children[0]?.textContent ?? "").trim(), 10), tr }))
    .filter((r) => Number.isFinite(r.season))
    .sort((a, b) => a.season - b.season)
  if (rows.length < 2) return
  const wrap = document.createElement("div")
  wrap.className = "viz-spark"
  for (const name of ["Win %", "Power %"]) {
    const i = heads.indexOf(name)
    if (i < 0) continue
    const vals = rows.map((r) => pctOf(r.tr.children[i]?.textContent ?? ""))
    if (vals.some((v) => v === null)) continue
    const nums = vals as number[]
    const lo = Math.min(...nums)
    const hi = Math.max(...nums)
    const x = (k: number) => 6 + (k / (nums.length - 1)) * 148
    const y = (v: number) => 32 - (hi === lo ? 14 : ((v - lo) / (hi - lo)) * 26)
    const svg = document.createElementNS(SVG, "svg")
    svg.setAttribute("viewBox", "0 0 160 38")
    svg.setAttribute("role", "img")
    svg.setAttribute("aria-label", `${name} by season: ${nums.map((v) => v + "%").join(", ")}`)
    svg.innerHTML =
      `<polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" points="${nums.map((v, k) => `${x(k)},${y(v)}`).join(" ")}"/>` +
      nums.map((v, k) => `<circle cx="${x(k)}" cy="${y(v)}" r="${k === nums.length - 1 ? 4 : 2.5}" fill="currentColor"/>`).join("")
    const row = document.createElement("div")
    row.className = "viz-spark-row"
    row.innerHTML = `<span>${name}</span>`
    row.appendChild(svg)
    const last = document.createElement("b")
    last.textContent = `${nums[nums.length - 1]}%`
    row.appendChild(last)
    wrap.appendChild(row)
  }
  if (wrap.childElementCount) box.insertBefore(wrap, box.querySelector(".hint"))
}

export function installDataViz() {
  const pending = new Set<HTMLElement>()
  let queued = false
  const apply = (el: HTMLElement) => {
    if (el instanceof HTMLTableElement) {
      barTable(el)
      sparkSeasons(el)
    } else if (el.matches(".league-rank-badge")) barBadge(el)
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
  const scan = (root: ParentNode) => root.querySelectorAll(".legacy table, .legacy .profile-stat-tile, .legacy .score-display, .legacy .league-rank-badge").forEach(schedule)
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      const target = r.target as HTMLElement
      schedule(target.closest?.("table") ?? null)
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          schedule(n.closest("table"))
          scan(n)
          if (n.matches(".profile-stat-tile, .score-display, .league-rank-badge")) schedule(n)
        }
      })
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  scan(document)
  return () => observer.disconnect()
}
