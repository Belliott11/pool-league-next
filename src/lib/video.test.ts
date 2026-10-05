import { describe, expect, it } from "vitest"
import { checkVideoFile, embedKind, youtubeId } from "@/lib/video"

describe("youtubeId", () => {
  it("reads the id from every common link shape", () => {
    expect(youtubeId("https://youtu.be/jNQXAC9IVRw")).toBe("jNQXAC9IVRw")
    expect(youtubeId("https://www.youtube.com/watch?v=jNQXAC9IVRw&t=30s")).toBe("jNQXAC9IVRw")
    expect(youtubeId("https://www.youtube.com/shorts/jNQXAC9IVRw")).toBe("jNQXAC9IVRw")
    expect(youtubeId("https://www.youtube.com/live/jNQXAC9IVRw")).toBe("jNQXAC9IVRw")
  })

  it("rejects other sites and malformed ids", () => {
    expect(youtubeId("https://vimeo.com/123456")).toBeNull()
    expect(youtubeId("https://evil.example/watch?v=jNQXAC9IVRw")).toBeNull()
    expect(youtubeId("https://youtu.be/short")).toBeNull()
    expect(youtubeId("not a link")).toBeNull()
  })
})

describe("embedKind", () => {
  it("tells files, YouTube and Vimeo apart", () => {
    expect(embedKind("https://x.example/clip.mp4")).toBe("file")
    expect(embedKind("https://youtu.be/jNQXAC9IVRw")).toBe("youtube")
    expect(embedKind("https://vimeo.com/123456")).toBe("vimeo")
    expect(embedKind("https://example.com/page")).toBe("other")
  })
})

describe("checkVideoFile", () => {
  it("accepts a video, falling back to the extension when the type is empty", () => {
    expect(checkVideoFile({ name: "game.mp4", size: 5e6, type: "video/mp4" })).toBeNull()
    expect(checkVideoFile({ name: "game.MOV", size: 5e6, type: "" })).toBeNull()
  })

  it("refuses non-videos and files over 4 GB", () => {
    expect(checkVideoFile({ name: "notes.pdf", size: 1000, type: "application/pdf" })).toMatch(/video/)
    expect(checkVideoFile({ name: "huge.mp4", size: 5 * 1024 ** 3, type: "video/mp4" })).toMatch(/4 GB/)
  })
})
