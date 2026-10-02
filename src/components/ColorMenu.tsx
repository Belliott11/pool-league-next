import { useEffect, useState } from "react"
import { buttonVariants } from "@/components/ui/button"

const ACCENTS = [
  { key: "", label: "Coral", swatch: "#e8650f" },
  { key: "violet", label: "Violet", swatch: "#7a5ae0" },
  { key: "blue", label: "Blue", swatch: "#2f74e6" },
  { key: "magenta", label: "Magenta", swatch: "#b83fc4" },
  { key: "ink", label: "Mono", swatch: "#41545b" },
]

// What each color means. The accent is the only one a person can change.
const KEY = [
  { cls: "bg-primary", name: "Accent", means: "The leader, what is selected, links and buttons" },
  { cls: "bg-pos", name: "Aqua", means: "Better than average, a good result" },
  { cls: "bg-neg", name: "Crimson", means: "Worse than average, a bad result" },
  { cls: "bg-gold", name: "Gold", means: "First place and awards" },
  { cls: "bg-chart-4", name: "Purple and blue", means: "Only to tell lines or players apart" },
]

const HINT_KEY = "pooleanIntelColorHint"

function hintUnseen() {
  try {
    return !localStorage.getItem(HINT_KEY)
  } catch {
    return false // storage blocked: never nag, we could not remember the dismissal
  }
}

export function ColorMenu() {
  const [hint, setHint] = useState(hintUnseen)
  function dismissHint() {
    setHint(false)
    try {
      localStorage.setItem(HINT_KEY, "1")
    } catch {
      /* private mode */
    }
  }
  useEffect(() => {
    if (!hint) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissHint()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [hint])
  const [accent, setAccent] = useState(() => document.documentElement.getAttribute("data-accent") ?? "")
  function pick(key: string) {
    if (key) document.documentElement.setAttribute("data-accent", key)
    else document.documentElement.removeAttribute("data-accent")
    try {
      localStorage.setItem("pooleanIntelAccent", key)
    } catch {
      /* private mode: the choice just won't persist */
    }
    setAccent(key)
  }
  return (
    <div className="relative">
    <details className="relative" onToggle={(e) => e.currentTarget.open && hint && dismissHint()}>
      <summary className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>Colors</summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
        <div className="mb-1 font-semibold">Accent</div>
        <div className="mb-3 flex gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.label}
              type="button"
              aria-label={a.label}
              title={a.label}
              aria-pressed={accent === a.key}
              onClick={() => pick(a.key)}
              className={`size-7 rounded-full border-2 ${accent === a.key ? "border-foreground" : "border-transparent"}`}
              style={{ backgroundColor: a.swatch }}
            />
          ))}
        </div>
        <div className="mb-1 font-semibold">What the colors mean</div>
        <ul className="flex flex-col gap-1.5">
          {KEY.map((k) => (
            <li key={k.name} className="flex items-start gap-2">
              <span className={`mt-1 size-3 shrink-0 rounded-full ${k.cls}`} />
              <span>
                <span className="font-medium">{k.name}</span>
                <span className="text-muted-foreground">: {k.means}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
    {hint && (
      <div role="note" className="absolute right-0 top-full z-10 mt-2 w-60 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
        <p className="mb-2">Pick an accent color, and see what each color means.</p>
        <button type="button" onClick={dismissHint} className={buttonVariants({ size: "sm" })}>
          Got it
        </button>
      </div>
    )}
    </div>
  )
}
