import { ThumbsDown } from "lucide-react"
import { useLabels } from "@/lib/labelsContext"
import { useReadOnly } from "@/lib/mode"

// A list of finished headlines. The editor gets a thumbs-down on each one: it removes that wording and the
// headline is written again with another one (or dropped if there is none).
export function StoryList({ stories }: { stories: string[] }) {
  const readOnly = useReadOnly()
  const { hideLine } = useLabels()
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {stories.map((x) => (
        <li key={x} className="flex gap-2">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
          <span className="min-w-0 flex-1">{x}</span>
          {!readOnly && (
            <button type="button" aria-label="Remove this headline" title="Remove this headline" className="-my-1 shrink-0 self-start p-2 text-muted-foreground hover:text-foreground" onClick={() => hideLine(x)}>
              <ThumbsDown aria-hidden className="size-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
