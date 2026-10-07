// Sends text through the phone's share sheet when there is one, and copies it otherwise. Returns what happened so the
// button can say so.
export async function shareText(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({ text })
      return "shared"
    }
  } catch (e) {
    // Closing the share sheet is not a failure; anything else falls through to copying.
    if (e instanceof DOMException && e.name === "AbortError") return "shared"
  }
  try {
    await navigator.clipboard.writeText(text)
    return "copied"
  } catch {
    return "failed"
  }
}
