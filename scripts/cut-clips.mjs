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
const trailerFile = path.join(work, "trailer-keys.json")
execFileSync("npx", ["vitest", "run", "src/lib/clipCuts.plan.test.ts"], { cwd: root, stdio: "ignore", env: { ...process.env, CLIP_STATE: stateFile, CLIP_PLAN: planFile, CLIP_TRAILER: trailerFile } })
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
// 4. The season trailer: the season's best plays joined into one short video (no sound, a quick fade between plays), made again only
// when the plays in it change. Listed in src/data/trailer.json for the site.
const TRAILER = path.join(root, "src/data/trailer.json")
const wanted = (fs.existsSync(trailerFile) ? JSON.parse(fs.readFileSync(trailerFile, "utf8")) : []).filter((k) => manifest[k])
const had = fs.existsSync(TRAILER) ? JSON.parse(fs.readFileSync(TRAILER, "utf8")) : null
if (!dry && wanted.length >= 3 && JSON.stringify(had?.clips) !== JSON.stringify(wanted)) {
  const origin = new URL(plan[0].url).origin
  const parts = wanted.map((k, i) => {
    const local = path.join(work, `trailer-${i}.mp4`)
    curl(["-o", local, `${origin}/${manifest[k]}`])
    const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", local]).toString().trim())
    return { local, seconds }
  })
  const FADE = 0.3
  const filters = parts.map((p, i) => `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,fade=t=in:st=0:d=${FADE},fade=t=out:st=${Math.max(0, p.seconds - FADE).toFixed(2)}:d=${FADE}[v${i}]`)
  const joined = `${parts.map((_, i) => `[v${i}]`).join("")}concat=n=${parts.length}:v=1:a=0[out]`
  const out = path.join(work, "trailer.mp4")
  execFileSync("ffmpeg", ["-v", "error", "-y", ...parts.flatMap((p) => ["-i", p.local]), "-filter_complex", [...filters, joined].join(";"), "-map", "[out]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "27", "-maxrate", "1500k", "-bufsize", "3000k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out])
  let h = 0x811c9dc5
  for (const ch of wanted.join(",")) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0
  const key = `clips/trailer/season-${h.toString(36)}.mp4` // a new name each time, so nobody gets an old copy
  upload(out, key, "video/mp4")
  served(origin, key)
  const seconds = Math.round(parts.reduce((t, p) => t + p.seconds, 0))
  fs.writeFileSync(TRAILER, JSON.stringify({ file: key, seconds, clips: wanted }, null, 1) + "\n")
  console.log(`\nseason trailer: ${wanted.length} plays, ${seconds} s`)
  for (const p of parts) fs.rmSync(p.local)
  fs.rmSync(out)
}
console.log(dry ? `\ncut ${done} into ${work}` : `\nuploaded ${done} cuts and ${needPoster.length} pictures; commit src/data/clip-cuts.json, src/data/clip-shares.json and src/data/trailer.json`)
