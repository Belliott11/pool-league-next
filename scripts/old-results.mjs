// Writes the old site's results (src/data/poolean-seasons.json) in the compact form the game-alerts function bundles for milestones.
// Run after the old results change: node scripts/old-results.mjs
import fs from "node:fs"
const d = JSON.parse(fs.readFileSync("src/data/poolean-seasons.json", "utf8"))
const out = d.list.flatMap((y) => (d.seasons[String(y)]?.games ?? []).map((g) => ({ date: g.date, a: g.a, b: g.b, w: g.w })))
fs.writeFileSync("supabase/functions/game-alerts/old-results.json", JSON.stringify(out) + "\n")
console.log(out.length, "results")
