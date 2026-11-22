// Cuts every clip the site plays into its own short file and puts it next to the recordings, so a clip loads a few hundred KB
// instead of a 150 to 280 MB game recording. Run it again after reviewing clips or logging new games: cuts already made are kept.
//
//   npm run cut-clips                  cut, upload, and list them in src/data/clip-cuts.json
//   npm run cut-clips -- --dry         cut only, into the work folder, to look at them first
//
// Needs ffmpeg and curl. Uploading needs a Cloudflare API token with Workers R2 Storage Edit, in CLOUDFLARE_API_TOKEN (a Claude cloud
// session's network proxy adds it instead). CLIP_SOURCES can name a folder that already holds the recordings, to skip downloading them,
// and CLIP_WORK a folder to cut into, so a dry run's cuts are uploaded as they are.
// Then commit src/data/clip-cuts.json and the site plays the cuts.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const MANIFEST = path.join(root, "src/data/clip-cuts.json")
const BUCKET = process.env.CLIP_BUCKET || "pooleanintel"
const dry = process.argv.includes("--dry")
const work = process.env.CLIP_WORK || fs.mkdtempSync(path.join(os.tmpdir(), "clip-cuts-")) // CLIP_WORK keeps cuts between runs
fs.mkdirSync(work, { recursive: true })
const token = process.env.CLOUDFLARE_API_TOKEN
const auth = token ? ["-H", `Authorization: Bearer ${token}`] : []

const curl = (args, opts = {}) => execFileSync("curl", ["-sS", "--fail-with-body", "--retry", "3", ...args], { maxBuffer: 1 << 26, ...opts })
const api = (p, args = []) => JSON.parse(curl([...auth, ...args, `https://api.cloudflare.com/client/v4${p}`]).toString())

// 1. The league data, through the public read key, as the site reads it.
const cfg = JSON.parse(fs.readFileSync(path.join(root, "public/cloud-config.json"), "utf8"))
const stateFile = path.join(work, "state.json")
const rows = JSON.parse(curl(["-H", `apikey: ${cfg.anonKey}`, "-H", `Authorization: Bearer ${cfg.anonKey}`, `${cfg.url}/rest/v1/league_state?select=data`]).toString())
fs.writeFileSync(stateFile, JSON.stringify(rows[0].data))

// 2. Which stretch of which recording each clip plays (the site's own rules, src/lib/clipCuts.ts).
const planFile = path.join(work, "plan.json")
execFileSync("npx", ["vitest", "run", "src/lib/clipCuts.plan.test.ts"], { cwd: root, stdio: "ignore", env: { ...process.env, CLIP_STATE: stateFile, CLIP_PLAN: planFile } })
const plan = JSON.parse(fs.readFileSync(planFile, "utf8"))
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {}
const todo = plan.filter((c) => !manifest[c.key])
console.log(`${plan.length} clips, ${plan.length - todo.length} already cut, ${todo.length} to cut`)

let account = process.env.CLOUDFLARE_ACCOUNT_ID || "45bdfa8bb68273ea324a958d302f5fe2" // the pooleanintel bucket's account
const SHARES = path.join(root, "src/data/clip-shares.json")
const shares = fs.existsSync(SHARES) ? JSON.parse(fs.readFileSync(SHARES, "utf8")) : {}
// Every cut clip also gets a picture of the play, for the preview of its share link (src/lib/clipShare.ts).
// A clip that goes badly for someone is never offered for sharing.
for (const c of plan) if (!c.shareable && shares[c.id]) delete shares[c.id]
const needPoster = plan.filter((c) => c.shareable && !shares[c.id] && (manifest[c.key] || todo.includes(c)))
if (!dry && (todo.length || needPoster.length) && !account) {
  const list = api("/accounts").result
  if (list.length !== 1) throw new Error(`Set CLOUDFLARE_ACCOUNT_ID: the token sees ${list.length} accounts`)
  account = list[0].id
}

const upload = (file, key, type) => {
  const res = api(`/accounts/${account}/r2/buckets/${BUCKET}/objects/${key.split("/").map(encodeURIComponent).join("/")}`, ["-X", "PUT", "-H", `Content-Type: ${type}`, "--data-binary", `@${file}`])
  if (!res.success) throw new Error(`upload of ${key} failed: ${JSON.stringify(res.errors)}`)
}
// It counts once the public link serves it.
const served = (origin, key) => {
  const head = curl(["-I", "-o", "/dev/null", "-w", "%{http_code}", `${origin}/${key}`]).toString()
  if (head !== "200") throw new Error(`${key} uploaded but the public link answered ${head}`)
}
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(data).sort()), null, 1) + "\n")
const sourceOf = (url) => {
  const file = decodeURIComponent(new URL(url).pathname.split("/").pop())
  let local = process.env.CLIP_SOURCES ? path.join(process.env.CLIP_SOURCES, file) : ""
  if (!local || !fs.existsSync(local)) {
    local = path.join(work, file)
    if (!fs.existsSync(local)) {
      console.log(`downloading ${file}`)
      curl(["-o", local, url])
    }
  }
  return { file, local, dir: new URL(url).pathname.split("/").slice(-2, -1)[0], origin: new URL(url).origin }
}

// 3. One recording at a time: fetch it, cut its clips and pictures, upload them, let it go.
const byRec = Map.groupBy([...new Set([...todo, ...needPoster])], (c) => c.url)
let done = 0
for (const [url, clips] of byRec) {
  const { file, local, dir, origin } = sourceOf(url)
  for (const c of clips) {
    const name = `${file.replace(/\.[^.]+$/, "")}_${c.start}-${c.end}`
    if (todo.includes(c)) {
      const out = path.join(work, `${name}.mp4`)
      // About 1 MB for 10 seconds: capped near the recordings' own bitrate, a keyframe every second so a tap seeks at once.
      if (!fs.existsSync(out)) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(c.start), "-i", local, "-t", String(Math.max(0.5, c.end - c.start)),
        "-c:v", "libx264", "-preset", "medium", "-crf", "28", "-maxrate", "900k", "-bufsize", "1800k", "-pix_fmt", "yuv420p", "-g", "30",
        "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", out])
      const key = `clips/${dir}/${name}.mp4`
      if (!dry) {
        upload(out, key, "video/mp4")
        served(origin, key)
        manifest[c.key] = key
        save(MANIFEST, manifest)
        fs.rmSync(out)
      }
      done++
    }
    if (c.shareable && !shares[c.id]) {
      const pic = path.join(work, `${name}.jpg`)
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(c.time), "-i", local, "-frames:v", "1", "-vf", "scale=1200:-2", "-q:v", "4", pic])
      const key = `clips/${dir}/${name}.jpg`
      if (!dry) {
        upload(pic, key, "image/jpeg")
        served(origin, key)
        shares[c.id] = { key: c.key, title: c.title, poster: key }
        save(SHARES, shares)
        fs.rmSync(pic)
      }
    }
    process.stdout.write(`\r${done}/${todo.length} cut`)
  }
  if (local.startsWith(work)) fs.rmSync(local)
}
// A clip's title follows its review (a new label or player), so known ones are brought up to date.
let renamed = 0
for (const c of plan) {
  if (shares[c.id] && shares[c.id].title !== c.title) {
    shares[c.id].title = c.title
    renamed++
  }
}
if (!dry) save(SHARES, shares)
console.log(dry ? `\ncut ${done} into ${work}` : `\nuploaded ${done} cuts and ${needPoster.length} pictures; commit src/data/clip-cuts.json and src/data/clip-shares.json`)
