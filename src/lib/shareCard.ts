import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import { getGameStats, isLiveScoreOnly, liveScoreOf, teamScore } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// A post-game picture to send to the group chat: the final score in the team colors, who played, and who
// scored most. Drawn on a canvas in the app's own colors and fonts, then shared or downloaded.
const W = 1080
const H = 1350

// Reads a CSS color variable as a plain rgb() string the canvas understands.
function cssColor(name: string, fallback: string): string {
  const probe = document.createElement("div")
  probe.style.color = `var(--${name})`
  probe.style.display = "none"
  document.body.appendChild(probe)
  const rgb = getComputedStyle(probe).color
  probe.remove()
  // Browsers may report modern color spaces (oklch); draw through a 1px canvas to get sRGB.
  const probeCanvas = document.createElement("canvas")
  probeCanvas.width = probeCanvas.height = 1
  const p = probeCanvas.getContext("2d", { willReadFrequently: true })
  if (!p) return fallback
  p.fillStyle = rgb
  p.fillRect(0, 0, 1, 1)
  const [r, g, b] = p.getImageData(0, 0, 1, 1).data
  return `rgb(${r}, ${g}, ${b})`
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1)
  return t + "…"
}

export async function drawGameCard(state: PooleanState, game: Game): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load("800 120px Anybody"), document.fonts.load("600 40px 'Hanken Grotesk'")])
  } catch {
    /* the system font is used instead */
  }
  const display = "Anybody, 'Arial Black', sans-serif"
  const body = "'Hanken Grotesk', system-ui, sans-serif"
  const bg = "#071014"
  const fg = "#eaf2f4"
  const muted = "#8aa0a6"
  const teamA = cssColor("team-a", "#7fb4f2")
  const teamB = cssColor("team-b", "#ffa94d")

  const live = isLiveScoreOnly(game)
  const sa = live ? liveScoreOf(game, game.teamA) : teamScore(game, game.teamA)
  const sb = live ? liveScoreOf(game, game.teamB) : teamScore(game, game.teamB)

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Two soft washes of the team colors behind each side.
  for (const [x, color] of [[0, teamA], [W / 2, teamB]] as const) {
    const g = ctx.createLinearGradient(0, 330, 0, 800)
    g.addColorStop(0, color.replace("rgb", "rgba").replace(")", ", 0.22)"))
    g.addColorStop(1, color.replace("rgb", "rgba").replace(")", ", 0)"))
    ctx.fillStyle = g
    ctx.fillRect(x, 330, W / 2, 470)
  }

  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = fg
  ctx.font = `800 64px ${display}`
  ctx.fillText("Poolean Intel", 72, 130)
  ctx.fillStyle = muted
  ctx.font = `600 38px ${body}`
  ctx.fillText(formatDateDisplay(game.date), 72, 190)

  const sides = [
    { x: W / 4, ids: game.teamA, score: sa, other: sb, color: teamA, label: "Team A" },
    { x: (3 * W) / 4, ids: game.teamB, score: sb, other: sa, color: teamB, label: "Team B" },
  ]
  ctx.textAlign = "center"
  for (const s of sides) {
    ctx.fillStyle = s.color
    ctx.font = `700 40px ${body}`
    ctx.fillText(s.label + (s.score > s.other ? "  ·  Winner" : ""), s.x, 420)
    ctx.fillStyle = fg
    ctx.globalAlpha = s.score >= s.other ? 1 : 0.7
    ctx.font = `800 260px ${display}`
    ctx.fillText(String(s.score), s.x, 660)
    ctx.globalAlpha = 1
    ctx.fillStyle = muted
    ctx.font = `600 34px ${body}`
    s.ids.slice(0, 5).forEach((id, i) => ctx.fillText(fit(ctx, playerName(state, id), W / 2 - 60), s.x, 740 + i * 46))
  }

  // Top scorers across both teams.
  const rows = [...game.teamA, ...game.teamB]
    .map((id) => ({ id, pts: live ? liveScoreOf(game, [id]) : getGameStats(game, id).pts, team: game.teamA.includes(id) ? teamA : teamB }))
    .sort((a, b) => b.pts - a.pts)
    .filter((r) => r.pts > 0)
    .slice(0, 3)
  ctx.textAlign = "left"
  if (rows.length) {
    ctx.fillStyle = fg
    ctx.font = `700 44px ${body}`
    ctx.fillText("Top scorers", 72, 1040)
    rows.forEach((r, i) => {
      const y = 1100 + i * 64
      ctx.fillStyle = r.team
      ctx.fillRect(72, y - 38, 10, 48)
      ctx.fillStyle = fg
      ctx.font = `600 44px ${body}`
      ctx.fillText(fit(ctx, playerName(state, r.id), 640), 104, y)
      ctx.textAlign = "right"
      ctx.font = `800 52px ${display}`
      ctx.fillText(`${r.pts} pts`, W - 72, y + 4)
      ctx.textAlign = "left"
    })
  }
  ctx.fillStyle = muted
  ctx.font = `500 30px ${body}`
  ctx.fillText(game.notes ? fit(ctx, game.notes, W - 144) : "Backyard pool basketball", 72, H - 44)
  return canvas
}

// Shares the picture through the phone's share sheet when it can, otherwise saves it as a file.
export async function shareGameCard(state: PooleanState, game: Game): Promise<void> {
  const canvas = await drawGameCard(state, game)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"))
  if (!blob) throw new Error("Could not make the picture.")
  const file = new File([blob], `poolean-${game.date || "game"}.png`, { type: "image/png" })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Poolean Intel" })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
    }
  }
  const a = document.createElement("a")
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
