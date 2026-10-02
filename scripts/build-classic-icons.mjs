// Builds scripts/classic-icons.json: the classic site's icon names mapped to Lucide, so every icon the
// classic code draws comes from one set (the same set the React side uses through lucide-react).
// Source: the Iconify API for the "lucide" prefix, the data better-icons searches.
//   node scripts/build-classic-icons.mjs
import fs from "node:fs"

const MAP = {
  search: "search", palette: "palette", link: "link", moon: "moon", sun: "sun", user: "user",
  basketball: "dribbble", timer: "timer", chart: "chart-column", users: "users", upload: "upload",
  video: "video", pencil: "pencil", scale: "scale", calendar: "calendar", megaphone: "megaphone",
  stop: "octagon", flame: "flame", lowlight: "circle-arrow-down", check: "check", x: "x",
  trophy: "trophy", shield: "shield", wall: "brick-wall", gem: "gem", trendingUp: "trending-up",
  star: "star", medal: "medal", sadface: "frown", target: "target", crown: "crown", dice: "dices",
  warning: "triangle-alert", snowflake: "snowflake", pin: "map-pin", film: "film",
  // used where the classic code had an emoji or a text arrow
  play: "play", save: "save", ban: "ban", clipboard: "clipboard-list", handshake: "handshake",
}

const names = [...new Set(Object.values(MAP))]
const res = await fetch(`https://api.iconify.design/lucide.json?icons=${names.join(",")}`)
const set = await res.json()
const out = {}
for (const [key, lucide] of Object.entries(MAP)) {
  const icon = set.icons[lucide] ?? set.icons[set.aliases?.[lucide]?.parent]
  if (!icon) throw new Error(`lucide:${lucide} not found`)
  out[key] = icon.body
}
fs.writeFileSync(new URL("./classic-icons.json", import.meta.url), JSON.stringify(out, null, 2) + "\n")
console.log(`wrote ${Object.keys(out).length} icons`)
