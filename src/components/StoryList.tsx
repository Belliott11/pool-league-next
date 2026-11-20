import { ThumbsDown } from "lucide-react";
import { useLabels } from "@/lib/labelsContext";
import { useReadOnly } from "@/lib/mode";
import { Terms } from "@/components/Terms";
import { ClipButton } from "@/components/ClipTile";
import { headlineClip } from "@/lib/headlineClips";
import type { PooleanState } from "@/lib/types";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ClipBackdrop } from "@/components/ClipBackdrop";
import { clipKey } from "@/lib/clips";

// A wide screen with a mouse: where clips play behind the headlines. Phones and tablets keep the film button only.
const DESKTOP = "(min-width: 1024px) and (hover: hover)";
const useDesktop = () =>
  useSyncExternalStore(
    (cb) => {
      const m = matchMedia(DESKTOP);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(DESKTOP).matches,
    () => false,
  );

// A list of finished headlines. The editor gets a thumbs-down on each one: it removes that wording and the
// headline is written again with another one (or dropped if there is none).
// With `state`, a headline that names a player gets a film button: a good clip for good news, a rough one for bad news, nothing otherwise.
// On desktop the clip of the headline you are pointing at (the first one to start) plays silently behind the list.
export function StoryList({ stories, state, gameIds }: { stories: string[]; state?: PooleanState; gameIds?: string[] }) {
  const readOnly = useReadOnly();
  const { hideLine } = useLabels();
  const clips = useMemo(() => stories.map((x) => (state ? headlineClip(state, x, gameIds) : undefined)), [stories, state, gameIds]);
  const desktop = useDesktop();
  const [hover, setHover] = useState<number | null>(null);
  const lead = hover !== null && clips[hover] ? hover : clips.findIndex(Boolean);
  const behind = desktop && state && lead >= 0 ? clips[lead] : undefined;
  return (
    <>
      <div className={`relative overflow-hidden rounded-lg ${behind ? "p-3" : ""}`}>
      {behind && state && <ClipBackdrop key={clipKey(behind)} state={state} clip={behind} className="absolute inset-0" scrim="bg-card/80" />}
      <ul className="relative flex flex-col gap-2 text-sm">
        {stories.map((x, i) => (
          <li
            key={x}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
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
      </div>
      <Terms texts={stories} />
    </>
  );
}
