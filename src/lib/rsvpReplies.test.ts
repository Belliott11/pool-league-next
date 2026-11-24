import { expect, test } from "vitest"
import { whoIsComing } from "@/lib/rsvpReplies"

test("a player's own reply wins over the editor's list, and new yeses are added after it", () => {
  expect(whoIsComing(["ben", "zach"], [])).toEqual(["ben", "zach"])
  expect(whoIsComing(["ben", "zach"], [{ player: "zach", going: false }])).toEqual(["ben"])
  expect(whoIsComing(["ben"], [{ player: "evan", going: true }, { player: "ben", going: true }])).toEqual(["ben", "evan"])
  expect(whoIsComing([], [{ player: "kayla", going: false }])).toEqual([])
})
