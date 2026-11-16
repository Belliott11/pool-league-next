import { termsIn } from "@/lib/terms"

// Definitions for the stat terms the given text uses. Nothing shows when it uses none.
export function Terms({ texts, open = false }: { texts: string[]; open?: boolean }) {
  const rows = termsIn(texts)
  if (rows.length === 0) return null
  return (
    <details open={open} className="text-xs">
      <summary className="cursor-pointer font-semibold text-muted-foreground">Terms used here</summary>
      <dl className="mt-2 flex max-w-prose flex-col gap-1.5">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="inline font-semibold">{k}: </dt>
            <dd className="inline text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
