import { ThumbsDown } from "lucide-react";
import { useLabels } from "@/lib/labelsContext";
import { useReadOnly } from "@/lib/mode";
import { Terms } from "@/components/Terms";
import { ClipButton } from "@/components/ClipTile";
import { HeadlineTone } from "@/components/HeadlineTone";
import { headlineClip } from "@/lib/headlineClips";
import type { PooleanState } from "@/lib/types";
import { useMemo } from "react";

// A list of finished headlines. The editor gets a thumbs-down on each one: it removes that wording and the
// headline is written again with another one (or dropped if there is none).
// With `state`, a headline that names a player gets a film button: a good clip for good news, a rough one for bad news, nothing otherwise.
// The editor also gets a clapperboard on each one to mark who it is about and whether it is good or bad news, which picks that clip.
export function StoryList({ stories, state, gameIds }: { stories: string[]; state?: PooleanState; gameIds?: string[] }) {
  const readOnly = useReadOnly();
  const { hideLine } = useLabels();
  const clips = useMemo(() => {
    const used = new Set<string>(); // each clip once within the list
    return stories.map((x) => (state ? headlineClip(state, x, gameIds, undefined, used) : undefined));
  }, [stories, state, gameIds]);
  return (
    <>
      <ul className="flex flex-col gap-2 text-sm">
        {stories.map((x, i) => (
          <li
            key={x}
            className="anim-line flex gap-2"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span
              aria-hidden
              className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
            />
            <span className="min-w-0 flex-1">
              {x}
              {state && clips[i] && <ClipButton state={state} clip={clips[i]} compact />}
            </span>
            {!readOnly && state && <HeadlineTone state={state} text={x} gameIds={gameIds} />}
            {!readOnly && (
              <button
                type="button"
                aria-label="Remove this headline"
                title="Remove this headline"
                className="-my-1 shrink-0 self-start p-2 text-muted-foreground hover:text-foreground"
                onClick={() => hideLine(x)}
              >
                <ThumbsDown aria-hidden className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <Terms texts={stories} />
    </>
  );
}
