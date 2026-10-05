// Extracts the pure compute layer (functions, constants, column definitions and everything they
// depend on) from dashboard/app.js into one module, so the new app runs the SAME code as the
// classic site rather than a retyped copy. Usage: node extract.mjs <app.js> <out.ts>
import fs from "node:fs"
import * as acorn from "acorn"
import * as walk from "acorn-walk"
import { analyzeTabPanels } from "./player-panels.mjs"

const [, , srcPath, outPath] = process.argv
const src = fs.readFileSync(srcPath, "utf8")
const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "script", locations: true })

const DOM = new Set(["document", "window", "alert", "confirm", "prompt", "navigator", "indexedDB", "requestAnimationFrame", "MutationObserver", "IntersectionObserver", "Blob", "URL", "FileReader", "Image", "MediaRecorder", "AudioContext"])

// top-level declarations: name -> { node, kind }
const decls = new Map() // name -> index into items
const items = []
ast.body.forEach((node, i) => {
  const item = { node, names: [], idx: i }
  if (node.type === "FunctionDeclaration") item.names = [node.id.name]
  else if (node.type === "VariableDeclaration") {
    node.declarations.forEach((d) => {
      if (d.id.type === "Identifier") item.names.push(d.id.name)
      else if (d.id.type === "ObjectPattern" || d.id.type === "ArrayPattern") {
        walk.simple(d.id, { Identifier(n) { item.names.push(n.name) } })
      }
    })
  }
  items.push(item)
  item.names.forEach((n) => decls.set(n, item))
})

// Identifiers referenced anywhere inside a node (over-approximation: ignores shadowing).
function refs(node) {
  const out = new Set()
  walk.full(node, (n) => {
    if (n.type === "Identifier") out.add(n.name)
  })
  return out
}

const refCache = new Map()
const refsOf = (item) => {
  if (!refCache.has(item)) refCache.set(item, refs(item.node))
  return refCache.get(item)
}

// Entry points: every compute*/predict*/estimated*/format*/etc. function, plus every column list.
const entryNames = new Set()
items.forEach((it) => {
  const n = it.node
  if (n.type === "FunctionDeclaration") {
    if (/^(compute|predict|build|isQualifying|qualifyingGames|normalizeGame|recomputeDerivedStats|invalidateComputedCaches|getLeaderboard)/.test(n.id.name)) entryNames.add(n.id.name)
  } else if (n.type === "VariableDeclaration") {
    n.declarations.forEach((d) => {
      if (d.id.type === "Identifier" && /(_COLUMNS|_LABELS|_TYPES|_LEVELS|_MIN_|_THRESHOLD|COMPARISON_)/.test(d.id.name)) entryNames.add(d.id.name)
    })
  }
})
// the leaderboard row builder and a few helpers the UI calls directly
;["setPooleanSeason", "pooleanSeasonList", "computeLeaderboard", "formatPct", "formatShootingSplit", "playerLink", "icon", "escapeHtml", "compareForSort"].forEach((n) => decls.has(n) && entryNames.add(n))


// ---- table panel analysis: derive each leaderboard table panel from its classic render function ----
const htmlPath = process.argv[4]
const html = htmlPath ? fs.readFileSync(htmlPath, "utf8") : ""
const lbStart = html.indexOf('<section id="tab-leaderboard"')
const lbEnd = html.indexOf('<section id="tab-player"')
const lbHtml = lbStart >= 0 ? html.slice(lbStart, lbEnd > 0 ? lbEnd : undefined) : ""
const stripTags = (t) => t.replace(/<span[^>]*>[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
const panelBlocks = []
{
  const re = /<h2>([\s\S]*?)<\/h2>/g
  let m
  const starts = []
  while ((m = re.exec(lbHtml))) starts.push({ title: stripTags(m[1]), at: m.index })
  starts.forEach((st, i) => {
    const block = lbHtml.slice(st.at, i + 1 < starts.length ? starts[i + 1].at : undefined)
    const ids = [...block.matchAll(/<(\w+)([^>]*?)\sid="([^"]+)"([^>]*)>/g)].map((x) => ({ tag: x[1], id: x[3], attrs: x[2] + x[4] }))
    const secs = [...lbHtml.slice(0, st.at).matchAll(/id="lb-section-(\w+)"/g)]
    const section = secs.length ? secs[secs.length - 1][1] : "overview"
    panelBlocks.push({ title: st.title, ids, section, order: i })
  })
}
const sortLiterals = new Map()
items.forEach((it) => {
  if (it.node.type !== "VariableDeclaration") return
  it.node.declarations.forEach((d) => {
    if (d.id.type === "Identifier" && /Sort$/.test(d.id.name) && d.init && d.init.type === "ObjectExpression") sortLiterals.set(d.id.name, src.slice(d.init.start, d.init.end))
  })
})
const gebi = (n) => n && n.type === "CallExpression" && n.callee.type === "MemberExpression" && n.callee.property.name === "getElementById" && n.arguments[0]?.type === "Literal" ? n.arguments[0].value : null
const panelSpecs = []
const panelSkipped = []
items.forEach((it) => {
  if (it.node.type !== "FunctionDeclaration" || !/^render/.test(it.node.id.name)) return
  const fn = it.node
  const varIds = {}
  const allIds = new Set()
  let colsName = null, sortName = null, headerId = null, rowsInit = null, rowsLocalNames = new Set()
  const innerAssigns = []
  const localInits = {}
  walk.full(fn.body, (n) => {
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && n.init && !gebi(n.init) && n.id.name !== "rows") localInits[n.id.name] = n.init
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier") {
      const id = gebi(n.init)
      if (id) varIds[n.id.name] = id
      if (n.id.name === "rows" && !rowsInit && n.init) rowsInit = n.init
      else if (n.id.type === "Identifier") rowsLocalNames.add(n.id.name)
    }
    const id = gebi(n)
    if (id) allIds.add(id)
    if (n.type === "CallExpression" && n.callee.type === "Identifier" && n.callee.name === "renderSortableHeader") {
      const a0 = n.arguments[0]
      headerId = a0.type === "Identifier" ? varIds[a0.name] : gebi(a0)
      colsName = n.arguments[1]?.name
      sortName = n.arguments[2]?.name
    }
    if (n.type === "AssignmentExpression" && n.left.type === "MemberExpression" && n.left.property.name === "innerHTML") innerAssigns.push(n)
  })
  if (["renderShotZonePanel", "renderDefensiveShotZonePanel"].includes(fn.id.name)) return
  if (!colsName || !rowsInit) return
  // the assignment holding the row template: contains a .map(arrow => `<tr>...`)
  let tpl = null, param = null, bodyId = null, tplPre = "", tplArrow = null
  const empties = []
  innerAssigns.forEach((a) => {
    const target = a.left.object.type === "Identifier" ? varIds[a.left.object.name] : gebi(a.left.object)
    walk.full(a.right, (n) => {
      if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && n.callee.property.name === "map" && n.arguments[0]?.type === "ArrowFunctionExpression" && !tpl) {
        const arrow = n.arguments[0]
        let candidate = null
        let pre = ""
        if (arrow.body.type === "TemplateLiteral") candidate = arrow.body
        else if (arrow.body.type === "BlockStatement") {
          const last = arrow.body.body[arrow.body.body.length - 1]
          if (last?.type === "ReturnStatement" && last.argument?.type === "TemplateLiteral") {
            candidate = last.argument
            pre = arrow.body.body.slice(0, -1).map((st) => src.slice(st.start, st.end)).join("\n")
          }
        }
        if (candidate && /<td/.test(src.slice(candidate.start, candidate.end))) {
          tpl = candidate
          tplArrow = arrow
          tplPre = pre
          param = arrow.params[0]?.name
          bodyId = target
        }
      }
      if ((n.type === "TemplateLiteral" || n.type === "Literal") && /empty-state/.test(src.slice(n.start, n.end))) empties.push(n)
    })
  })
  if (!tpl || !param || !bodyId) return
  Object.keys(localInits).forEach((k) => { if (localInits[k].start >= tplArrow.start && localInits[k].end <= tplArrow.end) delete localInits[k] })
  const tplSrc = src.slice(tpl.start + 1, tpl.end - 1)
  const cells = [...tplSrc.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1])
  const rowsSrc = src.slice(rowsInit.start, rowsInit.end)
  // rows expression must not lean on locals declared inside the render function
  const rowRefs = new Set()
  walk.full(rowsInit, (n) => { if (n.type === "Identifier") rowRefs.add(n.name) })
  const usesLocals = [...rowRefs].filter((x) => rowsLocalNames.has(x) && !decls.has(x))
  let emptySrc = null
  if (empties.length) {
    const e = empties[0]
    const text = src.slice(e.start + 1, e.end - 1)
    const m = text.match(/empty-state[^>]*>([\s\S]*?)<\/td>/)
    if (m) emptySrc = m[1]
  }
  const block = panelBlocks.find((b) => b.ids.some((x) => x.id === bodyId))
  const extra = [...allIds].filter((x) => x !== headerId && x !== bodyId).map((x) => block?.ids.find((b) => b.id === x)).filter(Boolean)
  const sortSrc = sortLiterals.get(sortName)
  const identsOf = (code) => {
    const out = new Set()
    try { walk.full(acorn.parseExpressionAt(code, 0, { ecmaVersion: "latest" }), (n) => { if (n.type === "Identifier") out.add(n.name) }) } catch { /* ignore */ }
    return out
  }
  const snippetIdents = new Set()
  ;[`(${rowsSrc})`, ...cells.map((c) => "`" + c + "`"), emptySrc ? "`" + emptySrc + "`" : "``"].forEach((sn) => identsOf(sn).forEach((x) => snippetIdents.add(x)))
  const neededLocals = []
  {
    const queue2 = [...snippetIdents].filter((x) => localInits[x] && x !== param)
    const seen2 = new Set()
    while (queue2.length) {
      const nm = queue2.pop()
      if (seen2.has(nm)) continue
      seen2.add(nm)
      neededLocals.push(nm)
      const init = localInits[nm]
      identsOf("(" + src.slice(init.start, init.end) + ")").forEach((x) => { if (localInits[x] && !seen2.has(x) && x !== param) queue2.push(x) })
    }
  }
  const preludeSrc = neededLocals.reverse().map((nm) => `const ${nm} = ${src.slice(localInits[nm].start, localInits[nm].end)};`).join("\n    ")
  if (!block || !sortSrc || usesLocals.length) {
    panelSkipped.push({ fn: fn.id.name, why: !block ? "no html block" : !sortSrc ? "no sort literal" : "locals: " + usesLocals.join(",") })
    return
  }
  panelSpecs.push({ tplPre, prelude: preludeSrc, section: block.section, order: block.order, fn: fn.id.name, title: block.title, bodyId, headerId, colsName, sortSrc, rowsSrc, param, cells, emptySrc, extra })
})
// make sure every identifier the generated snippets mention gets extracted too
panelSpecs.forEach((p) => {
  const snippets = [`(${p.rowsSrc})`, ...p.cells.map((c) => "`" + c + "`"), p.emptySrc ? "`" + p.emptySrc + "`" : "``"]
  snippets.forEach((sn) => {
    try {
      walk.full(acorn.parseExpressionAt(sn, 0, { ecmaVersion: "latest" }), (n) => { if (n.type === "Identifier") entryNames.add(n.name) })
    } catch {
      /* unparsable fragment: left for the runtime check */
    }
  })
  entryNames.add(p.colsName)
  if (p.tplPre) {
    try { walk.full(acorn.parse(p.tplPre, { ecmaVersion: "latest", allowReturnOutsideFunction: true }), (n) => { if (n.type === "Identifier") entryNames.add(n.name) }) } catch { /* ignore */ }
  }
  if (p.prelude) {
    try { walk.full(acorn.parse(p.prelude, { ecmaVersion: "latest" }), (n) => { if (n.type === "Identifier") entryNames.add(n.name) }) } catch { /* ignore */ }
  }
})


// ---- mount panels: every other Leaderboard panel is drawn by a classic render function into a
// container with fixed ids. We keep that function and the panel's own markup, and run it in place.
const MANUAL_PANELS = new Set(["Season Rates (Individual)"])

// Top-level `document.getElementById("id").addEventListener("evt", handler)` statements: the classic
// site wires its selects and buttons once at load. We carry the handler over and attach it after the
// panel's markup is mounted.
const wireStmts = []
items.forEach((it) => {
  const n = it.node
  if (n.type !== "ExpressionStatement") return
  let call = n.expression
  if (call.type === "ChainExpression") call = call.expression
  if (call.type !== "CallExpression" || call.callee.type !== "MemberExpression" || call.callee.property.name !== "addEventListener") return
  let obj = call.callee.object
  if (obj.type === "ChainExpression") obj = obj.expression
  const id = gebi(obj)
  if (!id || call.arguments[0]?.type !== "Literal" || !call.arguments[1]) return
  wireStmts.push({ id, evt: call.arguments[0].value, handler: src.slice(call.arguments[1].start, call.arguments[1].end) })
})
const mountSpecs = []
{
  const coveredTitles = new Set(panelSpecs.map((p) => p.title))
  const renderFns = items.filter((it) => it.node.type === "FunctionDeclaration" && /^render/.test(it.node.id.name))
  const fnIds = renderFns.map((it) => {
    const ids = new Set()
    walk.full(it.node.body, (n) => { if (gebi(n)) ids.add(gebi(n)) })
    return { name: it.node.id.name, ids }
  })
  const re2 = /<h2>([\s\S]*?)<\/h2>/g
  let m2
  while ((m2 = re2.exec(lbHtml))) {
    const title = stripTags(m2[1])
    if (coveredTitles.has(title) || MANUAL_PANELS.has(title)) continue
    // enclosing panel div: walk back to its opening tag, forward by depth to its end
    const open = lbHtml.lastIndexOf('<div class="panel', m2.index)
    if (open < 0) continue
    let depth = 0, end = -1
    const tagRe = /<(\/?)div\b[^>]*>/g
    tagRe.lastIndex = open
    let t
    while ((t = tagRe.exec(lbHtml))) {
      depth += t[1] ? -1 : 1
      if (depth === 0) { end = t.index; break }
    }
    if (end < 0) continue
    let inner = lbHtml.slice(m2.index + m2[0].length, end)
    inner = inner.replace(/^\s*<p class="hint"[^>]*>[\s\S]*?<\/p>/, "")
    const ids = [...inner.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1])
    const OVERRIDE = { "League Shot Heatmap": ["renderLeagueHeatmap"] }
    const fns = OVERRIDE[title] ?? fnIds.filter((f) => ids.some((id) => f.ids.has(id))).map((f) => f.name)
    const block = panelBlocks.find((b) => b.title === title)
    if (!fns.length) { mountSpecs.push({ title, fns: [], inner, section: block?.section, order: block?.order, noRender: true }); continue }
    const wires = wireStmts.filter((w) => ids.includes(w.id))
    mountSpecs.push({ title, fns, inner, wires, section: block?.section ?? "overview", order: block?.order ?? 0 })
  }
}
const callsIn = (fnName) => {
  const it = items.find((x) => x.node.type === "FunctionDeclaration" && x.node.id.name === fnName)
  const out = []
  if (it) walk.full(it.node.body, (n) => { if (n.type === "CallExpression" && n.callee.type === "Identifier" && /^render/.test(n.callee.name)) out.push(n.callee.name) })
  return out
}
const playerSpecs = analyzeTabPanels({ items, html, gebi, wireStmts, tabId: "tab-player", sectionPrefix: "section-", calledFns: callsIn("renderPlayerDetail") })
// Export tab: the classic site renders these when the tab opens (the `export` branch of showTab).
const exportCalls = []
{
  const st = items.find((x) => x.node.type === "FunctionDeclaration" && x.node.id.name === "showTab")
  if (st) walk.full(st.node.body, (n) => {
    if (n.type === "IfStatement" && /"export"/.test(src.slice(n.test.start, n.test.end))) walk.full(n.consequent, (c) => { if (c.type === "CallExpression" && c.callee.type === "Identifier" && /^render/.test(c.callee.name)) exportCalls.push(c.callee.name) })
  })
}
const exportSpecs = analyzeTabPanels({ items, html, gebi, wireStmts, tabId: "tab-export", sectionPrefix: "export-section-", calledFns: exportCalls.filter((f) => f !== "renderExportSectionTeasers") })
exportSpecs.forEach((m) => {
  m.fns.forEach((f) => entryNames.add(f))
  ;(m.wires || []).forEach((w) => {
    try { walk.full(acorn.parseExpressionAt(w.handler, 0, { ecmaVersion: "latest" }), (n) => { if (n.type === "Identifier") entryNames.add(n.name) }) } catch { /* ignore */ }
  })
})
playerSpecs.forEach((m) => {
  m.fns.forEach((f) => entryNames.add(f))
  ;(m.wires || []).forEach((w) => {
    try { walk.full(acorn.parseExpressionAt(w.handler, 0, { ecmaVersion: "latest" }), (n) => { if (n.type === "Identifier") entryNames.add(n.name) }) } catch { /* ignore */ }
  })
})
;["currentPlayerId", "downloadTradingCard", "renderPlayerRankPill", "computePlayerSectionTeasers"].forEach((n) => entryNames.add(n))
mountSpecs.forEach((m) => m.fns.forEach((f) => entryNames.add(f)))
mountSpecs.forEach((m) => (m.wires || []).forEach((w) => {
  try { walk.full(acorn.parseExpressionAt(w.handler, 0, { ecmaVersion: "latest" }), (n) => { if (n.type === "Identifier") entryNames.add(n.name) }) } catch { /* ignore */ }
}))

// DOM taint: an item is tainted if it references a DOM global, or references a tainted item.
const tainted = new Set()
{
  let grew = true
  while (grew) {
    grew = false
    items.forEach((it) => {
      if (tainted.has(it)) return
      const r = refsOf(it)
      if ([...r].some((x) => DOM.has(x)) || [...r].some((x) => decls.has(x) && tainted.has(decls.get(x)) && decls.get(x) !== it)) {
        tainted.add(it)
        grew = true
      }
    })
  }
}

const STUB_NAMES = new Set(["openPlayerDetail", "openGame", "showTab", "startLiveGame", "openLiveGameOverlay", "scrollBelowStickyNav", "wireSectionNavExtras", "renderTrendLineChart", "renderHeatmapSvg"])
// closure
const included = new Set()
const queue = []
const addName = (name) => {
  if (STUB_NAMES.has(name)) return
  const it = decls.get(name)
  if (it && !included.has(it)) {
    included.add(it)
    queue.push(it)
  }
}
entryNames.forEach(addName)
// DOM-free top-level statements that touch included names (initializers like X.forEach(...))
const STMT_TYPES = new Set(["ExpressionStatement"])
let changed = true
while (changed) {
  changed = false
  while (queue.length) {
    const it = queue.pop()
    refsOf(it).forEach(addName)
  }
  items.forEach((it) => {
    if (included.has(it) || !STMT_TYPES.has(it.node.type)) return
    const r = refsOf(it)
    if ([...r].some((x) => DOM.has(x))) return
    if (tainted.has(it)) return
    // only initializer-style statements: they must mutate (not merely read) an included name
    const touches = [...r].some((x) => decls.has(x) && included.has(decls.get(x)))
    const allKnown = [...r].every((x) => !decls.has(x) || true)
    if (touches && allKnown && it.node.expression.type !== "AwaitExpression") {
      included.add(it)
      queue.push(it)
      changed = true
    }
  })
}

// state handling
const overrideState = decls.get("state")
const loadStateItem = decls.get("loadState")
included.delete(loadStateItem)
included.delete(decls.get("saveState"))
if (overrideState) included.delete(overrideState)

const chunks = []
for (const it of items) {
  if (!included.has(it)) continue
  let text = src.slice(it.node.start, it.node.end)
  // `let x = localStorage...` toggles keep working in the browser; no rewrite needed.
  chunks.push(text)
}


const tableSpecSrc = panelSpecs
  .map((p) => {
    const cellFns = p.cells.map((c) => p.tplPre ? `(${p.param}) => { ${p.tplPre.replace(/playerLink\(/g, "__playerText(")}
 return \`${c.replace(/playerLink\(/g, "__playerText(")}\`; }` : `(${p.param}) => \`${c.replace(/playerLink\(/g, "__playerText(")}\``)
    const extra = JSON.stringify(p.extra.map((e) => ({ id: e.id, tag: e.tag, cls: (e.attrs.match(/class="([^"]*)"/) || [])[1] || "" })))
    const wrap = (obj) => (p.prelude ? `(() => {
    ${p.prelude}
    return ${obj};
  })()` : obj)
    const obj = `{ section: ${JSON.stringify(p.section)}, order: ${p.order}, fn: ${JSON.stringify(p.fn)}, title: ${JSON.stringify(p.title)}, bodyId: ${JSON.stringify(p.bodyId)}, headerId: ${JSON.stringify(p.headerId)},
    columns: __withDisplay(${p.colsName}, [${cellFns.join(", ")}]),
    rows: () => (${p.rowsSrc}),
    sort: ${p.sortSrc},
    empty: () => \`${p.emptySrc ? p.emptySrc.replace(/playerLink\(/g, "__playerText(") : "Nothing to show yet."}\`,
    extra: ${extra} }`
    return "  " + wrap(obj)
  })
  .join(",\n")
const playerBlock = `
export const PLAYER_PANELS = [
${playerSpecs.map((m) => `  { title: ${JSON.stringify(m.title)}, hint: ${JSON.stringify(m.hint)}, tag: ${JSON.stringify(m.tag ?? null)}, open: ${m.open}, section: ${JSON.stringify(m.section)}, order: ${m.order}, html: ${JSON.stringify(m.html)}, render: (pid) => { currentPlayerId = pid; ${m.fns.map((f) => f + "(pid);").join(" ")} }, wires: [${(m.wires || []).map((w) => `{ id: ${JSON.stringify(w.id)}, evt: ${JSON.stringify(w.evt)}, handler: ${w.handler} }`).join(", ")}] }`).join(",\n")}
];
export function setLegacyPlayer(pid) { currentPlayerId = pid; }
`
const exportBlock = `
export const EXPORT_PANELS = [
${exportSpecs.map((m) => `  { title: ${JSON.stringify(m.title)}, hint: ${JSON.stringify(m.hint)}, tag: ${JSON.stringify(m.tag ?? null)}, open: ${m.open}, section: ${JSON.stringify(m.section)}, order: ${m.order}, html: ${JSON.stringify(m.html)}, render: () => { ${m.fns.map((f) => f + "();").join(" ")} }, wires: [${(m.wires || []).map((w) => `{ id: ${JSON.stringify(w.id)}, evt: ${JSON.stringify(w.evt)}, handler: ${w.handler} }`).join(", ")}] }`).join(",\n")}
];
export function getLegacyState() { return state; }
`
const mountBlock = `
export const MOUNT_PANELS = [
${mountSpecs.filter((m) => !m.noRender).map((m) => `  { title: ${JSON.stringify(m.title)}, section: ${JSON.stringify(m.section)}, order: ${m.order}, html: ${JSON.stringify(m.inner)}, render: () => { ${m.fns.map((f) => f + "();").join(" ")} }, wires: [${(m.wires || []).map((w) => `{ id: ${JSON.stringify(w.id)}, evt: ${JSON.stringify(w.evt)}, handler: ${w.handler} }`).join(", ")}] }`).join(",\n")}
];
export const MOUNT_NO_RENDER = ${JSON.stringify(mountSpecs.filter((m) => m.noRender).map((m) => m.title))};
`
const stubBlock = `
function openPlayerDetail(id) { window.dispatchEvent(new CustomEvent("legacy-open-player", { detail: id })); }
function openGame(id) { window.dispatchEvent(new CustomEvent("legacy-open-game", { detail: id })); }
function cloudVideoUrl(game) {
  const m = game.masterVideoId ? (state.masterVideos || []).find((x) => x.id === game.masterVideoId) : null;
  return game.videoUrl || (m && m.url) || null;
}
// Plays a clip inside the panel it was asked from (the page stays where it is). It starts at the clip's start
// and pauses at its end; onDone runs then, so a list of clips can chain.
const inlineClipRuns = new WeakMap();
async function playClipInline(wrap, gameId, start, end, label, onDone) {
  const game = state.games.find((g) => g.id === gameId);
  const player = ensureInlineVideoPlayer(wrap);
  const video = player.querySelector("video");
  const labelEl = player.querySelector(".inline-video-label");
  const prev = inlineClipRuns.get(video);
  if (prev) { video.removeEventListener("timeupdate", prev); inlineClipRuns.delete(video); }
  if (!game) { labelEl.textContent = "Game not found."; return false; }
  labelEl.textContent = "Loading " + formatDateDisplay(game.date) + "…";
  const ok = await loadInlineVideo(game, video, start);
  if (!ok) {
    labelEl.textContent = "No playable video for " + formatDateDisplay(game.date) + ". A YouTube link can only be watched from the game page.";
    return false;
  }
  labelEl.textContent = label || (formatDateDisplay(game.date) + " · " + formatVideoTime(start));
  if (end !== null && end !== undefined) {
    const onTime = () => {
      if (video.currentTime >= end) {
        video.pause();
        video.removeEventListener("timeupdate", onTime);
        inlineClipRuns.delete(video);
        if (onDone) onDone();
      }
    };
    inlineClipRuns.set(video, onTime);
    video.addEventListener("timeupdate", onTime);
  }
  player.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return true;
}
// Every clip in a list of {game, clips}, one after another, in the same panel.
function playClipSequence(wrap, grouped, title) {
  const items = [];
  grouped.forEach(({ game, clips }) => clips.forEach((clip) => items.push({ game, clip })));
  let i = 0;
  const step = async () => {
    if (i >= items.length) {
      ensureInlineVideoPlayer(wrap).querySelector(".inline-video-label").textContent = title + ": that was the last clip.";
      return;
    }
    const { game, clip } = items[i];
    const label = title + " · clip " + (i + 1) + " of " + items.length + " · " + formatDateDisplay(game.date);
    i++;
    const ok = await playClipInline(wrap, game.id, clip.start, clip.end, label, step);
    if (!ok) step();
  };
  step();
}
function showTab() {}
function startLiveGame() {}
function openLiveGameOverlay() {}
function scrollBelowStickyNav() {}
function wireSectionNavExtras() {}
let __trendRenderer = null;
export function setTrendRenderer(fn) { __trendRenderer = fn; }
function renderTrendLineChart(containerId, points, seasonAvg, unitLabel, leagueAvg, opts) {
  const wrap = document.getElementById(containerId);
  if (wrap) wrap.innerHTML = __trendRenderer ? __trendRenderer(points, seasonAvg, unitLabel, leagueAvg, opts, formatDateDisplay, wrap.clientWidth) : "";
}
let __heatmapRenderer = null;
export function setHeatmapRenderer(fn) { __heatmapRenderer = fn; }
function renderHeatmapSvg(shots, colorFn) {
  if (shots.length === 0 || !__heatmapRenderer) return null;
  return __heatmapRenderer(computeHeatmapCells(shots), shots.length, colorFn === defensiveHeatmapCellColor);
}
`
const tableBlock = `
const __playerText = (id, name) => escapeHtml(name);
function __withDisplay(cols, fns) { return cols.map((c, i) => (fns[i] ? { ...c, display: fns[i] } : c)); }
export const TABLE_PANELS = [
${tableSpecSrc}
];
`

const header = `// @ts-nocheck
// GENERATED by extract.mjs from dashboard/app.js -- do not edit by hand. The compute layer, column
// definitions and their dependencies, extracted verbatim so the numbers match the classic site
// exactly. Regenerate with: node extract.mjs ../dashboard/app.js src/lib/legacy-core.ts
let state = { players: [], games: [], masterVideos: [], rsvps: [], seasonHistory: [], currentSeasonStartedAt: null, playerPhysicalOverrides: {} };
function saveState() { window.dispatchEvent(new CustomEvent("legacy-state-changed")); }
export function setLegacyState(s) { state = s; invalidateComputedCaches(); }
export function setLegacyToggles(t) {
  if (t.imbalanced !== undefined) includeImbalancedGames = t.imbalanced;
  if (t.pastSeasons !== undefined) includePastSeasons = t.pastSeasons;
  if (t.outliers !== undefined) includeOutlierGames = t.outliers;
  invalidateComputedCaches();
}
export function normalizeLegacyState(s) {
  s.masterVideos = s.masterVideos || [];
  s.masterVideos.forEach(m => { if (m.fileName === undefined) m.fileName = null; });
  (s.games || []).forEach(normalizeGame);
  s.seasonHistory = s.seasonHistory || [];
  s.currentSeasonStartedAt = s.currentSeasonStartedAt || null;
  s.playerPhysicalOverrides = s.playerPhysicalOverrides || {};
  s.rsvps = s.rsvps || [];
  return s;
}
`

// export every top-level function and const that is an entry or referenced externally by name
const exportNames = [...included].flatMap((it) => it.names)
const footer = `\nif (typeof POOLEAN_SEASONS !== "undefined") setPooleanSeason(pooleanSeasonList().slice(-1)[0]);\nexport { ${[...new Set(exportNames)].join(", ")} };\n`

// The classic heat cells color by hue (0 red to 120 green). Redraw them with this app's own meaning
// colors, crimson for low and aqua for high, so heat maps match the rest of the app.
// Hint text that names the old colors is reworded to the new ones.
const colorWords = (code) =>
  code
    .replace("green make, red miss", "aqua make, crimson miss")
    .replace("Color is FG% in that zone (red low, green high)", "Each zone is tinted against this player's own FG%: aqua above it, crimson below")
    .replace("Color is opponents' FG% (green is good defense)", "Each zone is tinted against the opponents' overall FG%: aqua where they were held below it")
// One icon set. The classic code's hand-drawn icons are swapped for Lucide (scripts/classic-icons.json,
// built by build-classic-icons.mjs), and the emoji and text arrows it put in buttons and notes become
// icons from the same set. Share text and canvas drawings keep their emoji: those are not UI.
const classicIcons = JSON.parse(fs.readFileSync(new URL("./classic-icons.json", import.meta.url), "utf8"))
const EMOJI_TO_ICON = [
  ["`📝 ${count}", '`${icon("clipboard")} ${count}'],
  ["`📍 ${gamesWithGaps}", '`${icon("pin")} ${gamesWithGaps}'],
  ["`⚠️ ${problems}", '`${icon("warning")} ${problems}'],
  [">🚫 OUT</span>", '>${icon("ban")} OUT</span>'],
  ['${s.current.type === "W" ? "🔥" : "❄️"}', '${s.current.type === "W" ? icon("flame") : icon("snowflake")}'],
  ['goBtn.textContent = "▶ Jump";', 'goBtn.innerHTML = `${icon("play")} Jump`;'],
  [">▶ Jump</button>", '>${icon("play")} Jump</button>'],
  ["`💾 ${text}", '`${icon("save")} ${text}'],
  [">🏀 Dunk</button>", '>${icon("basketball")} Dunk</button>'],
  ['${game.stoppedEarly ? "🛑 Stopped early" : "Mark as stopped early"}', '${game.stoppedEarly ? `${icon("stop")} Stopped early` : "Mark as stopped early"}'],
  ['btn.textContent = game.stoppedEarly ? "🛑 Stopped early" : "Mark as stopped early";', 'btn.innerHTML = game.stoppedEarly ? `${icon("stop")} Stopped early` : "Mark as stopped early";'],
  [">▶ Watch</button>", '>${icon("play")} Watch</button>'],
  ["marked at 📍 ${zoneLabel}", 'marked at ${icon("pin")} ${zoneLabel}'],
]
const iconify = (code) => {
  const block = /const ICONS = \{[\s\S]*?\n\};/
  if (!block.test(code)) throw new Error("ICONS block not found")
  code = code.replace(block, () => `const ICONS = ${JSON.stringify(classicIcons, null, 2)};`)
  for (const [from, to] of EMOJI_TO_ICON) {
    if (!code.includes(from)) throw new Error("emoji pattern not found: " + from)
    code = code.split(from).join(to)
  }
  // Static panel markup lives inside JS string literals, so its quotes are escaped.
  const filmSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${classicIcons.film}</svg>`.replace(/"/g, '\\"')
  if (!code.includes("disabled>🎬 Combine")) throw new Error("combine-clips emoji not found")
  code = code.replace("disabled>🎬 Combine", () => `disabled>${filmSvg} Combine`)
  return code
}
// The classic film buttons (Watch film, clip Jump, play search) read videos from this browser's own
// storage. Here a game's video is a link (its own, or its master recording's), so point them at that, and
// make "open this game and jump to a time" hand off to the React app instead of the classic screen.
const videoHooks = (code) => {
  code = code.split(String.fromCharCode(13, 10)).join(String.fromCharCode(10))
  const swap = (from, to) => {
    if (!code.includes(from)) throw new Error("video hook pattern not found: " + from.slice(0, 60))
    code = code.replace(from, () => to)
  }
  swap("url = masterVideoBlobUrls[game.masterVideoId] || null;", "url = masterVideoBlobUrls[game.masterVideoId] || cloudVideoUrl(game);")
  swap(
    "url = localVideoBlobUrls[game.id] || game.videoUrl || null;\n  }\n  if (!url) return false;",
    "url = localVideoBlobUrls[game.id] || cloudVideoUrl(game);\n  }\n  // A YouTube or Vimeo link cannot play in a bare video tag; those open from the game page instead.\n  if (!url || /youtu\\.?be|vimeo/i.test(url)) return false;",
  )
  swap(
    "  } else if (game.videoUrl) {\n    const isYouTube = /(?:youtu\\.be\\/|youtube\\.com\\/(?:watch\\?v=|embed\\/|shorts\\/))/.test(game.videoUrl);\n    const isDirectVideo = /\\.(mp4|webm|ogg|mov)(\\?.*)?$/i.test(game.videoUrl);\n    if (!isYouTube && isDirectVideo) src = game.videoUrl;",
    "  } else if (cloudVideoUrl(game)) {\n    const link = cloudVideoUrl(game);\n    const isYouTube = /(?:youtu\\.be\\/|youtube\\.com\\/(?:watch\\?v=|embed\\/|shorts\\/))/.test(link);\n    const isDirectVideo = /\\.(mp4|webm|ogg|mov)(\\?.*)?$/i.test(link);\n    if (!isYouTube && isDirectVideo) src = link;",
  )
  // Combining clips records the preview video onto a canvas, which a cross-origin video only allows when it
  // was requested with CORS. Both Supabase Storage and the R2 bucket send the header.
  swap(
    '<video id=\\"leagueExportVideo\\" class=\\"league-export-preview\\" muted playsinline></video>',
    '<video id=\\"leagueExportVideo\\" class=\\"league-export-preview\\" crossorigin=\\"anonymous\\" muted playsinline></video>',
  )
  // A player's own reel and "Watch these clips" play right in the profile instead of leaving it.
  swap(
    'goBtn.addEventListener("click", () => openGameAndSeek(clip.gameId, clip.start));',
    'goBtn.addEventListener("click", () => playClipInline(body.closest("table").parentElement, clip.gameId, clip.start, clip.end, formatDateDisplay(clip.gameDate) + " · " + formatTime(clip.start) + "-" + formatTime(clip.end) + (clip.note ? " · " + clip.note : "")));',
  )
  const area = /function startAreaClipExport\(playerId, categoryKey, categoryLabel\) \{[\s\S]*?\n\}\n/
  if (!area.test(code)) throw new Error("startAreaClipExport not found")
  code = code.replace(area, () => 'function startAreaClipExport(playerId, categoryKey, categoryLabel) {\n  const grouped = computeCategoryClipGroups(playerId, categoryKey);\n  if (grouped.length === 0) return;\n  const btn = document.querySelector(`[data-player-id="${playerId}"][data-category-key="${categoryKey}"]`);\n  playClipSequence((btn && btn.parentElement) || document.body, grouped, categoryLabel);\n}\n')
  // The review tools (backfill locations, dunks, shot and turnover types, ...) show the clip from the game's video.
  swap(
    'if (!url && game.videoUrl && /\\.(mp4|webm|ogg|mov)(\\?.*)?$/i.test(game.videoUrl)) url = game.videoUrl;',
    'if (!url && cloudVideoUrl(game) && /\\.(mp4|webm|ogg|mov)(\\?.*)?$/i.test(cloudVideoUrl(game))) url = cloudVideoUrl(game);',
  )
  const open = /function openGameAndSeek\(gameId, videoTime\) \{[\s\S]*?\n\}\n/
  if (!open.test(code)) throw new Error("openGameAndSeek not found")
  code = code.replace(open, () => 'function openGameAndSeek(gameId, videoTime) {\n  window.dispatchEvent(new CustomEvent("legacy-open-game", { detail: { id: gameId, time: videoTime === undefined ? null : videoTime } }));\n}\n')
  return code
}
const heatTokens = (code) =>
  videoHooks(iconify(colorWords(code))).replace(
    /hsla\(\$\{hue\}, \d+%, \d+%, \$\{opacity\}\)/g,
    "color-mix(in oklab, color-mix(in oklab, var(--neg), var(--pos) ${hue / 120 * 100}%) ${opacity * 100}%, transparent)",
  )
fs.writeFileSync(outPath, heatTokens([header, stubBlock, chunks.join("\n\n"), tableBlock, mountBlock, playerBlock, exportBlock, footer].join("\n")))
const detected = new Set(panelSpecs.map((p) => p.fn))
const undetected = items.filter((it) => it.node.type === "FunctionDeclaration" && /^render/.test(it.node.id.name) && src.slice(it.node.start, it.node.end).includes("renderSortableHeader(") && !detected.has(it.node.id.name)).map((it) => it.node.id.name)
console.log("undetected sortable renders:", undetected.join(", "))
console.log(`table panels: ${panelSpecs.length}, skipped: ${JSON.stringify(panelSkipped)}`)
console.log(`export panels: ${exportSpecs.length} (no render fn: ${exportSpecs.filter((m) => !m.fns.length).map((m) => m.title).join(', ')})`)
console.log(`player panels: ${playerSpecs.length} (no render fn: ${playerSpecs.filter((m) => !m.fns.length).map((m) => m.title).join(', ')})`)
console.log(`mount panels: ${mountSpecs.length} (no render fn: ${mountSpecs.filter((m) => m.noRender).map((m) => m.title).join(', ')})`)
console.log(`extracted ${chunks.length} top-level items, ${exportNames.length} names, ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`)
const missing = []
included.forEach((it) => refsOf(it).forEach((r) => { if (decls.has(r) && !included.has(decls.get(r))) missing.push(r) }))
console.log("included expression statements:", items.filter((it) => included.has(it) && it.node.type === "ExpressionStatement").map((it) => src.slice(it.node.start, it.node.start + 70).replace(/\s+/g, " ")))
console.log("excluded-but-referenced:", [...new Set(missing)].slice(0, 40).join(", "))
