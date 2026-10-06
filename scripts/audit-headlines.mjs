// Usage: npm run audit-headlines -- backup.json
import { spawnSync } from "node:child_process"
import path from "node:path"
const file = process.argv[2]
if (!file) {
  console.error("Give a backup file: npm run audit-headlines -- backup.json")
  process.exit(1)
}
const r = spawnSync("npx", ["vitest", "run", "src/lib/headlineAudit.test.ts", "--reporter=verbose"], { stdio: "inherit", shell: true, env: { ...process.env, HEADLINE_BACKUP: path.resolve(file) } })
process.exit(r.status ?? 1)
