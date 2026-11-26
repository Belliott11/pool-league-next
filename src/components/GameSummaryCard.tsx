import { useMemo, useState } from "react"
import { Check, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { gameSummary } from "@/lib/gameSummary"
import { playerName } from "@/lib/players"
import type { Game, PooleanState } from "@/lib/types"

// A finished game's lines under the score on the game page, ready for the group chat (src/lib/gameSummary.ts): share them as text. (The
// header's Share picture sends the picture with the same lines.) No card of its own, so the page stays short.
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
    <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
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
        <Button size="sm" variant="outline" className="self-start" onClick={() => void shareText()}>
          {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
          {copied ? "Copied" : "Share the summary"}
        </Button>
    </div>
  )
}
