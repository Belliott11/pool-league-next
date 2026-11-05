import { describe, expect, it } from "vitest"
import { arrange, LEADERBOARD_GROUPS, PLAYER_GROUPS, type GroupDef } from "@/lib/panelGroups"

const spec = (title: string, section: string, order: number) => ({ title, section, order })
const groups: GroupDef[] = [
  { id: "g", title: "G", home: "b", members: [["Two", "2"], ["Four", "4"]] },
  { id: "dev", title: "Dev", home: "a", editorOnly: true, members: [["Tune", "t"], ["Beta", "b"]] },
]
const specs = [spec("One", "a", 1), spec("Two", "a", 2), spec("Three", "b", 3), spec("Four", "b", 4), spec("Tune", "a", 5), spec("Beta", "a", 6), spec("Gone", "a", 7)]

describe("panel groups", () => {
  it("puts members in one entry at the group's home, at the earliest member's place", () => {
    const m = arrange(specs, groups, { drop: new Set(["Gone"]) })
    expect(m.get("a")?.map((p) => p.item?.title)).toEqual(["One"])
    expect(m.get("b")?.map((p) => p.group?.id ?? p.item?.title)).toEqual(["g", "Three"])
    expect(m.get("b")![0].members?.map((x) => x.label)).toEqual(["2", "4"])
  })
  it("hides editor-only groups from visitors and shows them to editors", () => {
    expect(arrange(specs, groups).get("a")?.some((p) => p.group?.id === "dev")).toBe(false)
    expect(arrange(specs, groups, { editor: true }).get("a")?.some((p) => p.group?.id === "dev")).toBe(true)
  })
  it("leaves a group of one panel as a plain panel", () => {
    const m = arrange([spec("Two", "a", 2), spec("Three", "a", 3)], groups)
    expect(m.get("a")?.map((p) => p.item?.title)).toEqual(["Two", "Three"])
  })
  it("never lists a panel in two groups", () => {
    for (const set of [LEADERBOARD_GROUPS, PLAYER_GROUPS]) {
      const titles = set.flatMap((g) => g.members.map(([t]) => t))
      expect(new Set(titles).size).toBe(titles.length)
    }
  })
})
