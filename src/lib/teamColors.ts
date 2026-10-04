// Team A is blue and Team B is orange everywhere. Class names are written out in full so Tailwind sees them.
export const TEAM = {
  A: { text: "text-team-a", bg: "bg-team-a", border: "border-team-a", tint: "bg-team-a/15", dot: "bg-team-a" },
  B: { text: "text-team-b", bg: "bg-team-b", border: "border-team-b", tint: "bg-team-b/15", dot: "bg-team-b" },
} as const
