import { expect, test } from "vitest"
import { clipId } from "@/lib/clipShare"
import shares from "@/data/clip-shares.json"

test("a clip's link id is short, the same every time, and different for another clip", () => {
  const a = clipId("rec.mp4|95|106")
  expect(a).toBe(clipId("rec.mp4|95|106"))
  expect(a).not.toBe(clipId("rec.mp4|96|106"))
  expect(a).toMatch(/^[0-9a-z]{1,7}$/)
})

test("every shareable clip's id matches its cut key (the script and the site agree)", () => {
  // A followed clip's key carries a follow tag (|f...); its link id stays on the plain key, so links do not change when a follow is added.
  for (const [id, s] of Object.entries(shares as Record<string, { key: string }>)) expect(clipId(s.key.split("|f")[0])).toBe(id)
})
