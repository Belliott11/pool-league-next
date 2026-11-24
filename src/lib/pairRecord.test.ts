import { expect, test } from "vitest"
import { pairRecord } from "@/lib/headToHead"

test("pair records count every result on the old site's list", () => {
  const r = pairRecord("adam", "zach")
  expect(r.together).toEqual([5, 15])
  const back = pairRecord("zach", "adam")
  expect(back.together).toEqual([5, 15])
  expect(back.vs).toEqual([r.vs[1], r.vs[0]])
  expect(pairRecord("adam", "nobody")).toEqual({ vs: [0, 0], together: [0, 0] })
})
