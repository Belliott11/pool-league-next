// Finds every panel on the classic Player tab and the render function(s) that draw it, using the
// call list inside renderPlayerDetail() (each is called with the player's id).
import * as walk from "acorn-walk"

const stripTags = (t) =>
  t
    .replace(/<span[^>]*>[\s\S]*?<\/span>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()

export function analyzePlayerPanels({ src, items, html, gebi, wireStmts }) {
  const start = html.indexOf('<section id="tab-player"')
  if (start < 0) return []
  const rest = html.slice(start + 10)
  const nextSection = rest.search(/<section id="tab-/)
  const tab = html.slice(start, nextSection > 0 ? start + 10 + nextSection : undefined)

  // calls inside renderPlayerDetail: renderX(player.id)
  const detail = items.find((it) => it.node.type === "FunctionDeclaration" && it.node.id.name === "renderPlayerDetail")
  if (!detail) return []
  const calledFns = []
  walk.full(detail.node.body, (n) => {
    if (n.type === "CallExpression" && n.callee.type === "Identifier" && /^render/.test(n.callee.name)) calledFns.push(n.callee.name)
  })
  const fnIds = {}
  items.forEach((it) => {
    if (it.node.type !== "FunctionDeclaration" || !calledFns.includes(it.node.id.name)) return
    const ids = new Set()
    walk.full(it.node.body, (n) => {
      if (gebi(n)) ids.add(gebi(n))
    })
    fnIds[it.node.id.name] = ids
  })

  const specs = []
  const re = /<(div|details) class="panel[^"]*"([^>]*)>\s*(<summary>)?\s*<h2>([\s\S]*?)<\/h2>/g
  let m
  let order = 0
  while ((m = re.exec(tab))) {
    const tag = m[1]
    const open = tag === "div" || /\bopen\b/.test(m[2])
    // end of this panel: matching close tag of the same element name
    const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g")
    tagRe.lastIndex = m.index
    let depth = 0
    let end = -1
    let t
    while ((t = tagRe.exec(tab))) {
      depth += t[1] ? -1 : 1
      if (depth === 0) {
        end = t.index
        break
      }
    }
    if (end < 0) continue
    const title = stripTags(m[4])
    const tagMatch = m[4].match(/<span class="real-data-tag">([\s\S]*?)<\/span>/)
    let inner = tab.slice(m.index + m[0].length, end)
    inner = inner.replace(/^\s*<\/summary>/, "")
    const hintMatch = inner.match(/^\s*<p class="hint"[^>]*>([\s\S]*?)<\/p>/)
    const hint = hintMatch ? stripTags(hintMatch[1]) : ""
    if (hintMatch) inner = inner.slice(hintMatch[0].length)
    const secs = [...tab.slice(0, m.index).matchAll(/id="section-(\w+)"/g)]
    const section = secs.length ? secs[secs.length - 1][1] : "overview"
    const ids = [...inner.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1])
    const OVERRIDE = {
      "Shot Heatmap": ["renderPlayerHeatmap"],
      "Defensive Heatmap": ["renderPlayerDefensiveHeatmap"],
      "Offensive Matchup Difficulty": ["renderOffensiveMatchupDifficultyChart"],
      "Defensive Matchup Difficulty": ["renderDefensiveMatchupDifficultyChart"],
      "Teammate Quality": ["renderTeammateQualityChart"],
      "Two-Way Trend": ["renderTwoWayTrendChart"],
    }
    const fns = OVERRIDE[title] ?? Object.keys(fnIds).filter((f) => ids.some((id) => fnIds[f].has(id)))
    const wires = wireStmts.filter((w) => ids.includes(w.id))
    specs.push({ title, hint, tag: tagMatch ? tagMatch[1].trim() : undefined, open, section, order: order++, html: inner, fns, wires })
  }
  return specs
}
