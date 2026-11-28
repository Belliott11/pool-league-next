// Hands a file to the phone's share sheet when it can take files, else saves it as a download. Cancelling the share sheet is not an
// error; a share that fails for another reason falls back to the download.
export async function shareFile(file: File, title: string): Promise<void> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
    }
  }
  const a = document.createElement("a")
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

// Fetches a video (a vertical clip or reel) and shares it as a file. Throws when the download fails.
export async function shareVideo(url: string, fileName: string, title: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not get the video (${res.status}).`)
  await shareFile(new File([await res.blob()], fileName, { type: "video/mp4" }), title)
}
