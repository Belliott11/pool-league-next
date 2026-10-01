// Extracts the pure compute layer (functions, constants, column definitions and everything they
// depend on) from dashboard/app.js into one module, so the new app runs the SAME code as the
// classic site rather than a retyped copy. Usage: node extract.mjs <app.js> <out.ts>
import fs from "node:fs"
import * as acorn from "acorn"
import * as walk from "acorn-walk"

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
;["computeLeaderboard", "formatPct", "formatShootingSplit", "playerLink", "icon", "escapeHtml", "compareForSort"].forEach((n) => decls.has(n) && entryNames.add(n))


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

// closure
const included = new Set()
const queue = []
const addName = (name) => {
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
function saveState() {}
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
const footer = `\nexport { ${[...new Set(exportNames)].join(", ")} };\n`

fs.writeFileSync(outPath, [header, chunks.join("\n\n"), tableBlock, footer].join("\n"))
const detected = new Set(panelSpecs.map((p) => p.fn))
const undetected = items.filter((it) => it.node.type === "FunctionDeclaration" && /^render/.test(it.node.id.name) && src.slice(it.node.start, it.node.end).includes("renderSortableHeader(") && !detected.has(it.node.id.name)).map((it) => it.node.id.name)
console.log("undetected sortable renders:", undetected.join(", "))
console.log(`table panels: ${panelSpecs.length}, skipped: ${JSON.stringify(panelSkipped)}`)
console.log(`extracted ${chunks.length} top-level items, ${exportNames.length} names, ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`)
const missing = []
included.forEach((it) => refsOf(it).forEach((r) => { if (decls.has(r) && !included.has(decls.get(r))) missing.push(r) }))
console.log("included expression statements:", items.filter((it) => included.has(it) && it.node.type === "ExpressionStatement").map((it) => src.slice(it.node.start, it.node.start + 70).replace(/\s+/g, " ")))
console.log("excluded-but-referenced:", [...new Set(missing)].slice(0, 40).join(", "))
