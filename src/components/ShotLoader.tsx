import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

// A shot that goes in: the ball arcs up from the left, drops through the rim, the net snaps, the ball falls out and
// it starts again. The logo's red, white and blue ball, drawn at 0,0 so it can be moved with a transform.
const START = { x: 14, y: 90 }
const RIM = { x: 113, y: 50 }

// A parabola from the start to the rim: x moves evenly and y follows the curve, peaking near y=24.
const ARC = Array.from({ length: 13 }, (_, i) => {
  const t = i / 12
  const x = START.x + (RIM.x - START.x) * t
  const y = (1 - t) ** 2 * START.y + 2 * t * (1 - t) * -22 + t ** 2 * RIM.y
  return { x, y }
})

function Ball() {
  return (
    <g transform="scale(0.5) translate(-32 -28)">
      <clipPath id="shot-ball">
        <circle cx="32" cy="28" r="17" />
      </clipPath>
      <g clipPath="url(#shot-ball)">
        <rect x="10" y="8" width="44" height="40" fill="#f4f6f7" />
        <path d="M21 16c5 4 5 20 0 24V48H10V8h11z" fill="#1d4fd8" />
        <path d="M43 16c-5 4-5 20 0 24V48h11V8H43z" fill="#e3262e" />
      </g>
      <g fill="none" stroke="#071014" strokeWidth="2" strokeLinecap="round">
        <path d="M32 11v34M15 28h34" />
        <path d="M21 16c5 4 5 20 0 24M43 16c-5 4-5 20 0 24" />
      </g>
    </g>
  )
}

export function ShotLoader({ className }: { className?: string }) {
  const ball = useRef<SVGGElement>(null)
  const net = useRef<SVGGElement>(null)
  const spin = useRef<SVGGElement>(null)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ball.current?.setAttribute("transform", `translate(${RIM.x} ${RIM.y + 6})`)
      return
    }
    const at = (p: { x: number; y: number }) => `translate(${p.x}px, ${p.y}px)`
    const fall = [
      { x: RIM.x, y: RIM.y + 12 },
      { x: RIM.x, y: RIM.y + 26 },
      { x: RIM.x, y: 96 },
    ]
    const pts = [...ARC, ...fall]
    // The arc takes the first 60% of the loop, the fall the next 30%, and the last 10% is a pause.
    const offsets = [...ARC.map((_, i) => (i / 12) * 0.6), 0.68, 0.78, 0.9]
    const a = ball.current?.animate(
      [...pts.map((p, i) => ({ transform: at(p), opacity: i === 0 || i === pts.length - 1 ? 0 : 1, offset: offsets[i] })), { transform: at(START), opacity: 0, offset: 1 }],
      { duration: 2400, iterations: Infinity },
    )
    // Backspin: one and a half turns on the way up and over, then it slows as the ball drops.
    const r = spin.current?.animate(
      [
        { transform: "rotate(0deg)", offset: 0 },
        { transform: "rotate(-540deg)", offset: 0.6 },
        { transform: "rotate(-640deg)", offset: 0.9 },
        { transform: "rotate(-640deg)", offset: 1 },
      ],
      { duration: 2400, iterations: Infinity },
    )
    const n = net.current?.animate(
      [
        { transform: "scaleY(1)", offset: 0 },
        { transform: "scaleY(1)", offset: 0.58 },
        { transform: "scaleY(1.22) scaleX(0.94)", offset: 0.66 },
        { transform: "scaleY(0.94)", offset: 0.76 },
        { transform: "scaleY(1)", offset: 0.86 },
        { transform: "scaleY(1)", offset: 1 },
      ],
      { duration: 2400, iterations: Infinity },
    )
    return () => {
      a?.cancel()
      r?.cancel()
      n?.cancel()
    }
  }, [])
  return (
    <svg viewBox="0 0 140 100" aria-hidden className={cn("h-24 w-auto text-foreground", className)}>
      {/* backboard and its support */}
      <path d="M128 14V52" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
      <path d="M126 50H128" stroke="currentColor" strokeWidth="3" />
      {/* the ball is drawn between the back of the rim and the net, so it drops through */}
      <g ref={ball} style={{ transform: `translate(${START.x}px, ${START.y}px)` }}>
        <g ref={spin}>
          <Ball />
        </g>
      </g>
      {/* net, hung from the rim */}
      <g ref={net} style={{ transformOrigin: `${RIM.x}px ${RIM.y}px`, transformBox: "view-box" }} stroke="currentColor" strokeWidth="1.2" opacity="0.7" fill="none">
        <path d="M101 51L106 74M107 51L110 76M113 51V77M119 51L116 76M125 51L120 74" />
        <path d="M103 59H123M105 67H121" />
      </g>
      {/* rim, in front */}
      <path d="M100 50H127" stroke="#e3262e" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}
