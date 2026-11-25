// Keeps a dated history of Poolean's rulebook (Adam's app, poolean.net) in src/data/rulebook.json, so every game can be matched to the
// rules it was played under. Reads the live rulebook from the public API when it has a rules route (/api/v1/rules), else the published
// copy (/data/rules.json). A new version is added only when the text changes, dated the day (in Cherry Hill) it was first seen.
// Run by .github/workflows/rulebook.yml every hour; `node scripts/rulebook.mjs` by hand does the same.
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const FILE = path.resolve(import.meta.dirname, "../src/data/rulebook.json")
const SOURCES = ["https://poolean.net/api/v1/rules", "https://poolean.net/data/rules.json"]

// The sections as plain data, in order, without anything that is not the rule text.
export function normalize(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.rules) ? raw.rules : Array.isArray(raw?.items) ? raw.items : null
  if (!list || !list.length) return null
  return [...list]
    .map((s) => ({
      n: Number(s.n) || 0,
      title: String(s.title ?? "").trim(),
      lines: (Array.isArray(s.lines) ? s.lines : []).map((l) => String(l).trim()).filter(Boolean),
      subs: (Array.isArray(s.subs) ? s.subs : []).map((x) => ({ title: String(x.title ?? "").trim(), lines: (Array.isArray(x.lines) ? x.lines : []).map((l) => String(l).trim()).filter(Boolean) })),
    }))
    .sort((a, b) => a.n - b.n)
}
export const hashOf = (sections) => createHash("sha256").update(JSON.stringify(sections)).digest("hex").slice(0, 12)
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())

async function fetchRules() {
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) })
      if (!res.ok) continue
      const sections = normalize(await res.json())
      if (sections) return { url, sections }
    } catch {
      // try the next source
    }
  }
  return null
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const got = await fetchRules()
  if (!got) {
    console.log("Could not read the rulebook from poolean.net; nothing changed.")
    process.exit(0)
  }
  const book = JSON.parse(readFileSync(FILE, "utf8"))
  const hash = hashOf(got.sections)
  const last = book.versions.at(-1)
  if (last?.hash === hash) {
    console.log(`Rulebook unchanged (${hash}, from ${got.url}).`)
    process.exit(0)
  }
  book.versions.push({ from: today(), hash, source: got.url, sections: got.sections })
  writeFileSync(FILE, JSON.stringify(book, null, 2) + "\n")
  console.log(`New rulebook version ${hash} from ${got.url}, in force from ${today()}.`)
}
