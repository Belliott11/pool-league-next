import { Check, Clapperboard } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { headlineClip, namedIn, toneOf } from "@/lib/headlineClips"
import { useUpdate } from "@/lib/mode"
import { guessTone } from "@/lib/toneGuess"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

type Mark = [string, "good" | "bad"] | null

// For a headline not marked yet: a guess from the wording of the headlines already marked, to confirm with one tap. Worked out only once
// the dialog is open.
function Suggestion({ state, text, who, onUse }: { state: PooleanState; text: string; who: string; onUse: (tone: "good" | "bad") => void }) {
  const guess = guessTone(state, text)
  if (!guess) return null
  const label = `${guess.tone === "good" ? "Good" : "Bad"} news for ${playerName(state, who)}`
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2">
      <span className="min-w-0 flex-1">Looks like <span className="font-medium">{label}</span>, going by headlines marked before.</span>
      <Button size="sm" onClick={() => onUse(guess.tone)}>Use it</Button>
    </div>
  )
}

// For the editor, beside each headline: who it is about and whether it is good or bad for them, which picks the clip shown with it
// (a highlight for good news, a rough moment for bad news). Saved with the league data, so visitors see the clip straight away.
export function HeadlineTone({ state, text, gameIds }: { state: PooleanState; text: string; gameIds?: string[] }) {
  const update = useUpdate()
  const tone = toneOf(state, text)
  const mine = state.headlineTones && Object.hasOwn(state.headlineTones, text)
  const named = namedIn(state, text)
  const [who, setWho] = useState<string>(tone?.[0] ?? named[0] ?? "")
  if (!update) return null
  const others = state.players.filter((p) => !named.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name))
  const set = (mark: Mark | undefined) =>
    update((s) => {
      const next = { ...(s.headlineTones ?? {}) }
      if (mark === undefined) delete next[text]
      else next[text] = mark
      return { ...s, headlineTones: next }
    })
  const shows = tone ? headlineClip(state, text, gameIds) : undefined
  const status = tone ? `${tone[1] === "good" ? "Good" : "Bad"} news for ${playerName(state, tone[0])}` : mine ? "No clip" : "Not marked"
  const pressed = (m: Mark) => (m === null ? mine && !tone : !!tone && tone[0] === m[0] && tone[1] === m[1])
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Clip for this headline: ${status}`}
            title={`Clip: ${status}`}
            className={cn("-my-1 shrink-0 self-start p-2 hover:text-foreground", mine || tone ? "text-primary" : "text-muted-foreground")} // marked or not; which way is in the label
          />
        }
      >
        <Clapperboard aria-hidden className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Clip for this headline</DialogTitle>
        <DialogDescription>{text}</DialogDescription>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Who is it about?</span>
            <select value={who} onChange={(e) => setWho(e.target.value)} className="h-9 rounded-md border bg-background px-2">
              <option value="" disabled>Pick a player</option>
              {named.length > 0 && (
                <optgroup label="Named in it">
                  {named.map((id) => <option key={id} value={id}>{playerName(state, id)}</option>)}
                </optgroup>
              )}
              <optgroup label={named.length ? "Everyone else" : "Players"}>
                {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            </select>
          </label>
          {!tone && !mine && who && <Suggestion state={state} text={text} who={who} onUse={(t) => set([who, t])} />}
          <div className="grid grid-cols-2 gap-2">
            <Button variant={pressed([who, "good"]) ? "secondary" : "outline"} aria-pressed={pressed([who, "good"])} disabled={!who} onClick={() => set([who, "good"])}>
              {pressed([who, "good"]) && <Check aria-hidden />}Good news
            </Button>
            <Button variant={pressed([who, "bad"]) ? "secondary" : "outline"} aria-pressed={pressed([who, "bad"])} disabled={!who} onClick={() => set([who, "bad"])}>
              {pressed([who, "bad"]) && <Check aria-hidden />}Bad news
            </Button>
            <Button variant={pressed(null) ? "secondary" : "outline"} aria-pressed={!!pressed(null)} onClick={() => set(null)}>
              {pressed(null) && <Check aria-hidden />}No clip
            </Button>
            <Button variant="ghost" disabled={!mine} onClick={() => set(undefined)}>
              Clear my mark
            </Button>
          </div>
          <p className="text-muted-foreground" aria-live="polite">
            {tone
              ? shows
                ? `Shows: ${shows.label}, ${playerName(state, shows.playerId)}.`
                : tone[1] === "bad"
                  ? `No clip yet: bad news needs a play marked rough for ${playerName(state, tone[0])}.`
                  : `No clip of ${playerName(state, tone[0])} to show yet.`
              : mine
                ? "This headline shows no clip."
                : "Not marked yet, so it shows no clip."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
