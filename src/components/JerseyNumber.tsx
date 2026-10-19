import { cn } from "@/lib/utils"

// A tank-top jersey with the player's number in scoreboard digits. Nothing is drawn for a player with no number.
export function JerseyNumber({ number, className }: { number?: number; className?: string }) {
  if (number === undefined || number === null) return null
  return (
    <svg viewBox="0 0 64 72" role="img" aria-label={`Jersey number ${number}`} className={cn("h-14 w-auto shrink-0", className)}>
      <path d="M16 3H26C26 13 38 13 38 3H48C48 15 52 21 55 27V70H9V27C12 21 16 15 16 3Z" fill="var(--primary)" stroke="var(--card)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M12 66H52" stroke="var(--primary-foreground)" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <text x="32" y="54" textAnchor="middle" className="font-score" fontSize={String(number).length > 1 ? 30 : 36} fill="var(--primary-foreground)">
        {number}
      </text>
    </svg>
  )
}
