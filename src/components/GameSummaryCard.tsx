import { useMemo, useState } from "react"
import { Check, Copy, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { gameSummary } from "@/lib/gameSummary"
import { playerName } from "@/lib/players"
import { shareGameCard } from "@/lib/shareCard"
import type { Game, PooleanState } from "@/lib/types"

// A finished game's three lines, ready for the group chat (src/lib/gameSummary.ts): share them as text, or the picture with the same lines.
export function GameSummaryCard({ state, game }: { state: PooleanState; game: Game }) {
  const s = useMemo(() => gameSummary(state, game), [state, game])
  const [copied, setCopied] = useState(false)
  if (!s.winner || game.liveInProgress) return null
  const shareText = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ text: s.text })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(s.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // No clipboard either: nothing more to try.
    }
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="font-display text-base font-bold">The game in three lines</div>
        {s.swing && (
          <p>
            <span className="text-muted-foreground">The swing: </span>
            {playerName(state, s.swing.scorerId)}'s {s.swing.points} at {s.swing.before[0]}-{s.swing.before[1]}, +{Math.round(s.swing.gain)} points of win chance.
          </p>
        )}
        {s.top && (
          <p>
            <span className="text-muted-foreground">Most points added: </span>
            {playerName(state, s.top.id)}, +{s.top.value.toFixed(1)}.
          </p>
        )}
        {!s.swing && !s.top && <p className="text-muted-foreground">The final score, with a link to the game.</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void shareText()}>
            {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
            {copied ? "Copied" : "Share the summary"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void shareGameCard(state, game).catch(() => {})}>
            <Copy aria-hidden /> Share the picture
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
