import { describe, expect, it } from "vitest"
import { parseCall } from "@/lib/voiceScore"

const P = [
  { id: "zach", name: "Zach" },
  { id: "ben", name: "Ben" },
  { id: "adam", name: "Adam" },
  { id: "reilly", name: "Reilly" },
  { id: "logan-hoskins", name: "Logan H" },
  { id: "logan-watson", name: "Logan W" },
]
const call = (t: string) => parseCall(t, P)

describe("voice scoring", () => {
  it("hears a name and points", () => {
    expect(call("Zach three")).toMatchObject({ ok: true, pid: "zach", points: 3 })
    expect(call("zach 3")).toMatchObject({ ok: true, pid: "zach", points: 3 })
    expect(call("two for Ben")).toMatchObject({ ok: true, pid: "ben", points: 2 })
    expect(call("Ben to")).toMatchObject({ ok: true, pid: "ben", points: 2 })
    expect(call("Adam free throw")).toMatchObject({ ok: true, pid: "adam", points: 1 })
    expect(call("Reilly from deep")).toMatchObject({ ok: true, pid: "reilly", points: 3, passer: null })
  })
  it("forgives a misheard name", () => {
    expect(call("Zack tree")).toMatchObject({ ok: true, pid: "zach", points: 3 })
    expect(call("Riley two")).toMatchObject({ ok: true, pid: "reilly", points: 2 })
    expect(call("Reiley two")).toMatchObject({ ok: true, pid: "reilly", points: 2 })
  })
  it("hears the passer but scores the shooter", () => {
    expect(call("Ben two off Adam")).toMatchObject({ ok: true, pid: "ben", points: 2, passer: "adam" })
  })
  it("tells shared first names apart by the letter", () => {
    expect(call("Logan W two")).toMatchObject({ ok: true, pid: "logan-watson", points: 2 })
    expect(call("Logan double you three")).toMatchObject({ ok: true, pid: "logan-watson", points: 3 })
    expect(call("Logan two")).toMatchObject({ ok: false, why: "Which Logan? Say the letter too." })
    expect(call("Logan two off Ben")).toMatchObject({ ok: false })
    expect(call("two off Ben")).toMatchObject({ ok: false, why: "Did not hear who scored." })
  })
  it("says what is missing", () => {
    expect(call("nice shot")).toMatchObject({ ok: false, why: "Did not hear a player in this game." })
    expect(call("Zach")).toMatchObject({ ok: false, why: "Did not hear one, two or three." })
  })
})
