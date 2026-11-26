import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// The Content Security Policy in vite.config.ts lists every host the page talks to. A host added elsewhere without it here is blocked
// by browsers on the live site only (the dev server has no policy), so these fail first.
const root = path.resolve(import.meta.dirname, "../..")
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8")
const config = read("vite.config.ts")

describe("the security policy", () => {
  it("allows the league data host and the video bucket", () => {
    const cfg = JSON.parse(read("public/cloud-config.json")) as { url: string }
    expect(config).toContain(cfg.url)
    const video = read("src/lib/clipShare.ts").match(/https:\/\/pub-[a-z0-9]+\.r2\.dev/)?.[0]
    expect(video).toBeTruthy()
    expect(config).toContain(video!)
  })
  it("allows YouTube's player script and the weather API", () => {
    expect(read("src/components/YouTubePlayer.tsx")).toContain("https://www.youtube.com/iframe_api")
    expect(config).toMatch(/script-src 'self' https:\/\/www\.youtube\.com/)
    expect(read("src/lib/weather.ts")).toContain("api.open-meteo.com")
    expect(config).toContain("https://api.open-meteo.com")
  })
  it("keeps inline scripts out of the page", () => {
    expect(read("index.html")).not.toMatch(/<script>/)
  })
})
