import { describe, expect, it } from "vitest"
import { gameNights, icsFor } from "@/lib/calendar"

describe("game night calendar", () => {
  it("lists upcoming nights once each, earliest first", () => {
    const n = gameNights({ openingNight: { date: "2027-06-01", time: "16:00" }, rsvps: [{ date: "2027-06-08" }, { date: "2027-06-01" }, { date: "2026-08-10" }] }, "2026-11-28")
    expect(n.map((x) => x.date)).toEqual(["2027-06-01", "2027-06-08"])
    expect(n[0].title).toContain("opening night")
  })
  it("writes a calendar file with timed and all-day nights", () => {
    const ics = icsFor([{ date: "2027-06-01", time: "16:00", title: "Pool basketball: opening night" }, { date: "2027-06-08", title: "Pool basketball" }], new Date("2026-11-28T12:00:00Z"))
    expect(ics).toContain("DTSTART;TZID=America/New_York:20270601T160000")
    expect(ics).toContain("DTEND;TZID=America/New_York:20270601T190000")
    expect(ics).toContain("DTSTART;VALUE=DATE:20270608")
    expect(ics).toContain("DTEND;VALUE=DATE:20270609")
    expect(ics).toContain("SUMMARY:Pool basketball: opening night")
    expect(ics.split("BEGIN:VEVENT").length).toBe(3)
    expect(ics.includes("\r\n")).toBe(true)
  })
})
