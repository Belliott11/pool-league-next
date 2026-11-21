import { useSyncExternalStore } from "react"

// A wide screen: where the clip window shows above the headlines. Phones get the film button only. (Width alone: some desktop browsers on touch
// laptops report no hover, which wrongly hid the window.)
const DESKTOP = "(min-width: 1024px)"
export const useDesktop = () =>
  useSyncExternalStore(
    (cb) => {
      const m = matchMedia(DESKTOP)
      m.addEventListener("change", cb)
      return () => m.removeEventListener("change", cb)
    },
    () => matchMedia(DESKTOP).matches,
    () => false,
  )
