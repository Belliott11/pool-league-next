// Cuts every clip the site plays into its own short file and puts it next to the recordings, so a clip loads a few hundred KB
// instead of a 150 to 280 MB game recording. Run it again after reviewing clips or logging new games: cuts already made are kept.
//
//   npm run cut-clips                  cut, upload, and list them in src/data/clip-cuts.json
//   npm run cut-clips -- --dry         cut only, into the work folder, to look at them first
//   npm run cut-clips -- --trailer-preview   make the season trailer from the cuts already uploaded, into the work folder, and stop
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
// --trailer-preview: make the trailer from the cuts already uploaded, into the work folder, and stop (nothing cut or uploaded).
if (process.argv.includes("--trailer-preview")) {
  const list = JSON.parse(fs.readFileSync(trailerFile, "utf8")).filter((p) => manifest[p.key] || manifest[p.key.split("|f")[0]])
  const origin = new URL(plan[0].url).origin
  const out = path.join(work, "trailer-preview.mp4")
  const secs = makeTrailer(list, (k) => `${origin}/${manifest[k] ?? manifest[k.split("|f")[0]]}`, out)
  console.log(`trailer preview: ${list.length} plays, ${secs} s, ${out}`)
  process.exit(0)
}

let account = process.env.CLOUDFLARE_ACCOUNT_ID || "45bdfa8bb68273ea324a958d302f5fe2" // the pooleanintel bucket's account
const SHARES = path.join(root, "src/data/clip-shares.json")
const shares = fs.existsSync(SHARES) ? JSON.parse(fs.readFileSync(SHARES, "utf8")) : {}
// Every cut clip also gets a picture of the play, for the preview of its share link (src/lib/clipShare.ts).
// A clip that goes badly for someone is never offered for sharing. A picture is made again when the cut changes (a follow added or moved).
for (const c of plan) if (!c.shareable && shares[c.id]) delete shares[c.id]
const needPoster = plan.filter((c) => c.shareable && (!shares[c.id] || shares[c.id].key !== c.key) && (manifest[c.key] || todo.includes(c)))
// A shareable clip that knows where the play is (a follow path, or the editor's crop) also gets a vertical video for Instagram stories and
// reels: 9:16, following the play across, with sound and a caption. Made again when the cut changes or VERTICAL_STYLE is bumped.
const VERTICAL_STYLE = 2
const canVertical = (c) => c.shareable && !c.still && (c.follow || c.frameX !== null) // a still is a picture, never a video
const needVertical = plan.filter((c) => canVertical(c) && (manifest[c.key] || todo.includes(c)) && (!shares[c.id]?.vertical || shares[c.id].key !== c.key || shares[c.id].vstyle !== VERTICAL_STYLE))
if (!dry && (todo.length || needPoster.length || needVertical.length) && !account) {
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
// The follow camera as ffmpeg filters: crop to 1/zoom of the picture, centred on the path (straight lines between its points, a point every
// 0.2 s of cut time) and kept inside the picture, then scaled back up. `at` gives a still crop at one moment instead (the picture of the play).
const along = (path, k) => {
  let e = String(path[0][k])
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1], dt = b.t - a.t
    const slope = (b[k] - a[k]) / dt
    if (dt > 0 && Math.abs(slope) > 1e-5) e += `+(${slope.toFixed(5)})*clip(t-${a.t},0,${dt.toFixed(2)})`
  }
  return e
}
const pointAt = (path, t) => {
  if (t <= path[0].t) return path[0]
  const i = path.findIndex((p) => p.t >= t)
  if (i < 0) return path[path.length - 1]
  const a = path[i - 1], b = path[i], k = (t - a.t) / (b.t - a.t || 1)
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}
const followCrop = (f, at) => {
  const p = at === undefined ? null : pointAt(f.path, at)
  const x = p ? String(p.x) : along(f.path, "x")
  const y = p ? String(p.y) : along(f.path, "y")
  return `crop=w=trunc(iw/${f.zoom}/2)*2:h=trunc(ih/${f.zoom}/2)*2:x='clip(iw*(${x})-ow/2,0,iw-ow)':y='clip(ih*(${y})-oh/2,0,ih-oh)'`
}
// The vertical video: 80% of the recording's height, 9/16 of that wide, centred on the play (the follow path across, else the editor's
// crop), 720 by 1280, with the site's name at the top and what, who and when at the bottom. Keeps the sound.
function makeVertical(c, local, out) {
  const fonts = path.join(root, "scripts/og-fonts")
  const tmp = fs.mkdtempSync(path.join(work, "v-"))
  const text = (name, s) => (fs.writeFileSync(path.join(tmp, name), s), path.join(tmp, name))
  const x = c.follow ? along(c.follow.path, "x") : String(c.frameX)
  const y = c.follow ? along(c.follow.path, "y") : "0.5"
  const day = new Date(`${c.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
  const vf = [
    // 80% of the height, so the players are bigger than in the whole-height strip, following the play up and down as well as across.
    `crop=w=trunc(ih*0.8*9/16/2)*2:h=trunc(ih*0.8/2)*2:x='clip(iw*(${x})-ow/2,0,iw-ow)':y='clip(ih*(${y})-oh/2,0,ih-oh)'`,
    "scale=720:1280:flags=lanczos,setsar=1",
    "eq=contrast=1.05:saturation=1.15",
    `drawbox=x=0:y=0:w=iw:h=110:color=black@0.35:t=fill`,
    `drawtext=fontfile=${path.join(fonts, "Anybody-Display.ttf")}:textfile=${text("brand.txt", "POOLEAN INTEL")}:fontcolor=white:fontsize=38:x=(w-text_w)/2:y=40`,
    `drawbox=x=0:y=ih-230:w=iw:h=170:color=black@0.5:t=fill`,
    `drawbox=x=0:y=ih-230:w=10:h=170:color=0x2f7de1:t=fill`,
    `drawtext=fontfile=${path.join(fonts, "HankenGrotesk-Bold.ttf")}:textfile=${text("title.txt", c.title)}:fontcolor=white:fontsize=48:x=40:y=h-205`,
    `drawtext=fontfile=${path.join(fonts, "HankenGrotesk-Regular.ttf")}:textfile=${text("date.txt", `${day}   intel.poolean.net`)}:fontcolor=white@0.85:fontsize=30:x=42:y=h-135`,
  ].join(",")
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(c.start), "-i", local, "-t", String(Math.max(0.5, c.end - c.start)), "-vf", vf,
    "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-maxrate", "2500k", "-bufsize", "5000k", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out])
  fs.rmSync(tmp, { recursive: true })
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
const byRec = Map.groupBy([...new Set([...todo, ...needPoster, ...needVertical])], (c) => c.url)
let done = 0
for (const [url, clips] of byRec) {
  const { file, local, dir, origin } = sourceOf(url)
  for (const c of clips) {
    const name = `${file.replace(/\.[^.]+$/, "")}_${c.start}-${c.end}${c.follow ? `_f${c.key.split("|f")[1]}` : ""}` // a followed cut has its own name
    if (todo.includes(c)) {
      const out = path.join(work, `${name}.mp4`)
      // About 1 MB for 10 seconds: capped near the recordings' own bitrate, a keyframe every second so a tap seeks at once.
      // A followed clip has the follow camera cut into it (1280 by 720 after the zoom, from recordings of 1080 lines or more).
      const vf = c.follow ? ["-vf", `${followCrop(c.follow)},scale=1280:720:flags=lanczos,setsar=1`] : []
      if (!fs.existsSync(out)) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(c.start), "-i", local, "-t", String(Math.max(0.5, c.end - c.start)), ...vf,
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
    if (c.shareable && (!shares[c.id] || shares[c.id].key !== c.key)) {
      const pic = path.join(work, `${name}.jpg`)
      const crop = c.follow ? `${followCrop(c.follow, c.time - c.start)},` : ""
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(c.time), "-i", local, "-frames:v", "1", "-vf", `${crop}scale=1200:-2`, "-q:v", "4", pic])
      const key = `clips/${dir}/${name}.jpg`
      if (!dry) {
        upload(pic, key, "image/jpeg")
        served(origin, key)
        shares[c.id] = { key: c.key, title: c.title, poster: key }
        save(SHARES, shares)
        fs.rmSync(pic)
      }
    }
    if (needVertical.includes(c) && shares[c.id]) {
      const out = path.join(work, `${name}_v.mp4`)
      makeVertical(c, local, out)
      const key = `clips/${dir}/${name}_v.mp4`
      if (!dry) {
        upload(out, key, "video/mp4")
        served(origin, key)
        shares[c.id] = { ...shares[c.id], vertical: key, vstyle: VERTICAL_STYLE }
        save(SHARES, shares)
        fs.rmSync(out)
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
// 4. The season trailer: the season's best plays (followed where the clip has a follow) as a short edit, made again when the plays or the
// look change. A title card, then each play at normal speed from its run-up to the end of its cut, with a caption (what, who, when,
// and which play of how many), a different transition into each one, and an end card with the site's address. No sound. Listed in
// src/data/trailer.json for the site. TRAILER_LOOK=1 makes it again with the same plays (to try a new look).
const TRAILER = path.join(root, "src/data/trailer.json")
const TRAILER_STYLE = 4 // bump when the look changes, so the next run makes it again
const plays = (fs.existsSync(trailerFile) ? JSON.parse(fs.readFileSync(trailerFile, "utf8")) : []).filter((p) => manifest[p.key])
const wanted = plays.map((p) => p.key)
const had = fs.existsSync(TRAILER) ? JSON.parse(fs.readFileSync(TRAILER, "utf8")) : null
const stale = JSON.stringify(had?.clips) !== JSON.stringify(wanted) || had?.style !== TRAILER_STYLE || process.env.TRAILER_LOOK === "1"
if (!dry && plays.length >= 3 && stale) {
  const origin = new URL(plan[0].url).origin
  const out = path.join(work, "trailer.mp4")
  const seconds = makeTrailer(plays, (k) => `${origin}/${manifest[k]}`, out)
  let h = 0x811c9dc5
  for (const ch of `${TRAILER_STYLE}|${wanted.join(",")}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0
  const key = `clips/trailer/season-${h.toString(36)}.mp4` // a new name each time, so nobody gets an old copy
  upload(out, key, "video/mp4")
  served(origin, key)
  fs.writeFileSync(TRAILER, JSON.stringify({ file: key, seconds, style: TRAILER_STYLE, clips: wanted }, null, 1) + "\n")
  console.log(`\nseason trailer: ${plays.length} plays, ${seconds} s`)
  fs.rmSync(out)
}

// Builds the trailer from the plays' cuts (fetched from `urlOf`) into `out`, and returns its length in whole seconds. Also run by
// itself to look at first: node scripts/cut-clips.mjs --trailer-preview (uses the cuts already uploaded).
function makeTrailer(list, urlOf, out) {
  const W = 1280, H = 720, FPS = 30, X = 0.5 // size, frame rate, transition length
  const fonts = path.join(root, "scripts/og-fonts")
  const bold = path.join(fonts, "HankenGrotesk-Bold.ttf"), regular = path.join(fonts, "HankenGrotesk-Regular.ttf"), display = path.join(fonts, "Anybody-Display.ttf")
  const tmp = fs.mkdtempSync(path.join(work, "trailer-"))
  // Text goes through files, so names and labels need no escaping.
  let n = 0
  const text = (s) => {
    const f = path.join(tmp, `t${n++}.txt`)
    fs.writeFileSync(f, s)
    return f
  }
  const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args])
  const enc = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS)]
  const month = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
  const year = list.map((p) => p.date).sort().at(-1).slice(0, 4)
  const look = "eq=contrast=1.06:saturation=1.18:brightness=0.01,vignette=PI/5"
  const card = (file, secs, lines) => {
    // A dark card with a thin accent bar, the lines fading up one after another.
    const draws = lines.map((l, i) => `drawtext=fontfile=${l.font}:textfile=${text(l.text)}:fontcolor=white:fontsize=${l.size}:x=(w-text_w)/2:y=${l.y}:alpha='min(1,max(0,(t-${0.25 + i * 0.3})/0.45))'`)
    ff(["-f", "lavfi", "-i", `color=c=0x0b1220:s=${W}x${H}:d=${secs}:r=${FPS}`, "-vf", [`drawbox=x=(iw-160)/2:y=${lines[0].y - 34}:w='min(160,160*t/0.6)':h=6:color=0x2f7de1:t=fill`, ...draws, look].join(","), ...enc, file])
    return { file, secs }
  }
  const parts = []
  parts.push(card(path.join(tmp, "intro.mp4"), 3, [
    { font: display, text: "POOLEAN INTEL", size: 92, y: 270 },
    { font: bold, text: `Top plays, summer ${year}`, size: 44, y: 390 },
  ]))
  list.forEach((p, i) => {
    const src = path.join(tmp, `src${i}.mp4`)
    curl(["-o", src, urlOf(p.key)])
    const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).toString().trim())
    // From 3.5 s before the logged moment to the end of the cut, at normal speed. The logged moment is often the release, or a tap made
    // after the basket, so a fixed stretch after it (and the old slow motion around it) cut plays off before the ball went in; the cut
    // itself already ends 6 s after the moment, or where the editor trimmed it.
    const at = Math.min(Math.max(0, p.at), dur)
    const a = Math.max(0, at - 3.5), c = dur
    const secs = c - a
    const fadeAt = secs - 1.1
    const caption = [
      // The bar slides in, and goes with its words (it used to stay up, empty, after the words faded).
      `drawbox=x=0:y=ih-150:w='min(iw*0.62,iw*0.62*(t-0.3)/0.35)':h=110:color=black@0.55:t=fill:enable='between(t,0.3,${(fadeAt + 0.15).toFixed(2)})'`,
      `drawbox=x=0:y=ih-150:w=8:h=110:color=0x2f7de1:t=fill:enable='between(t,0.3,${(fadeAt + 0.15).toFixed(2)})'`,
      `drawtext=fontfile=${bold}:textfile=${text(`${p.label}, ${p.player}`)}:fontcolor=white:fontsize=42:x=36:y=h-136:alpha='min(1,max(0,(t-0.5)/0.3))*min(1,max(0,(${fadeAt}-t)/0.3))'`,
      `drawtext=fontfile=${regular}:textfile=${text(`${month(p.date)}   Play ${i + 1} of ${list.length}`)}:fontcolor=white@0.85:fontsize=26:x=38:y=h-80:alpha='min(1,max(0,(t-0.65)/0.3))*min(1,max(0,(${fadeAt}-t)/0.3))'`,
    ]
    const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`
    const file = path.join(tmp, `play${i}.mp4`)
    ff(["-i", src, "-filter_complex",
      `[0:v]${fit},trim=${a.toFixed(2)}:${c.toFixed(2)},setpts=PTS-STARTPTS,fps=${FPS},${look},${caption.join(",")}[v]`,
      "-map", "[v]", "-an", ...enc, file])
    parts.push({ file, secs })
    fs.rmSync(src)
  })
  parts.push(card(path.join(tmp, "outro.mp4"), 3.4, [
    { font: display, text: "SEE YOU OUT THERE", size: 64, y: 280 },
    { font: bold, text: "intel.poolean.net", size: 40, y: 380 },
    { font: regular, text: "Every play, every stat", size: 28, y: 440 },
  ]))
  // Join them with a different transition into each part.
  const kinds = ["fadewhite", "slideleft", "circleopen", "smoothleft", "wipeleft", "radial", "zoomin", "dissolve", "slideup", "fadeblack"]
  const inputs = parts.flatMap((p) => ["-i", p.file])
  const chain = []
  let label = "[0:v]"
  let t = parts[0].secs
  for (let k = 1; k < parts.length; k++) {
    const offset = (t - X).toFixed(2)
    const next = k === parts.length - 1 ? "[out]" : `[x${k}]`
    chain.push(`${label}[${k}:v]xfade=transition=${k === parts.length - 1 ? "fadeblack" : kinds[(k - 1) % (kinds.length - 1)]}:duration=${X}:offset=${offset}${next}`)
    label = next
    t += parts[k].secs - X
  }
  ff([...inputs, "-filter_complex", chain.join(";"), "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-maxrate", "2500k", "-bufsize", "5000k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out])
  fs.rmSync(tmp, { recursive: true })
  return Math.round(t)
}

console.log(dry ? `\ncut ${done} into ${work}` : `\nuploaded ${done} cuts, ${needPoster.length} pictures and ${needVertical.length} vertical videos; commit src/data/clip-cuts.json, src/data/clip-shares.json and src/data/trailer.json`)
