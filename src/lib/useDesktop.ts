import { useSyncExternalStore } from "react"

// A wide screen with a mouse: where clips play behind and above the headlines. Phones and tablets get the film button only.
const DESKTOP = "(min-width: 1024px) and (hover: hover)"
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
