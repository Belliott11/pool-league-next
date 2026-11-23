import fs from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const BASE = "/pool-league-next/"
const SITE = "https://intel.poolean.net/" // the public address links and previews use (src/lib/site.ts)
const VIDEO_HOST = "https://pub-fe959ca0159c462e9b4e69082ac20db5.r2.dev" // the video bucket's public address (see src/lib/clipCuts.ts)

// One small page per shareable clip (src/data/clip-shares.json, written by npm run cut-clips), at clip/<id>.html. It carries the title
// and picture a group chat shows for the link, and sends a visitor straight on to the clip on the site.
function clipPages(): Plugin {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  return {
    name: "clip-pages",
    apply: "build",
    generateBundle() {
      const shares = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "src/data/clip-shares.json"), "utf8")) as Record<string, { key: string; title: string; poster: string }>
      const cuts = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "src/data/clip-cuts.json"), "utf8")) as Record<string, string>
      for (const [id, s] of Object.entries(shares)) {
        const to = `../#/games/clip/${id}`
        const video = cuts[s.key] ? `\n<meta property="og:video" content="${VIDEO_HOST}/${esc(cuts[s.key])}">\n<meta property="og:video:type" content="video/mp4">` : ""
        this.emitFile({
          type: "asset",
          fileName: `clip/${id}.html`,
          source: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.title)} | Poolean Intel</title>
<meta property="og:site_name" content="Poolean Intel">
<meta property="og:title" content="${esc(s.title)}">
<meta property="og:description" content="A play from the backyard pool basketball league.">
<meta property="og:url" content="${SITE}clip/${id}.html">
<meta property="og:type" content="video.other">
<meta property="og:image" content="${VIDEO_HOST}/${esc(s.poster)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="675">${video}
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${to}">
<script>location.replace(${JSON.stringify(to)})</script>
</head>
<body><a href="${to}">Watch the play</a></body>
</html>
`,
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [react(), tailwindcss(), clipPages()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
