// Tiny physical feedback for taps and moments. Android phones buzz through the Vibration API. iPhones
// have no vibration API, but flipping a hidden switch control gives a light tap on iOS 17.4 and later,
// so that is used as a best effort (it only works from a direct tap, and gives one tap, not a pattern).
// Anything else does nothing. A person can switch it off; the choice is remembered.
const KEY = "pooleanIntelHaptics"

export type Haptic = "tick" | "light" | "medium" | "success" | "warn"

const PATTERNS: Record<Haptic, number | number[]> = {
  tick: 6,
  light: 12,
  medium: 22,
  success: [20, 50, 30, 50, 60],
  warn: [28, 60, 28],
}

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off"
  } catch {
    return true
  }
}

export function setHapticsEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off")
  } catch {
    /* private mode: the choice just won't persist */
  }
}

function iosTap() {
  const label = document.createElement("label")
  label.setAttribute("aria-hidden", "true")
  label.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none"
  const input = document.createElement("input")
  input.type = "checkbox"
  input.setAttribute("switch", "")
  label.appendChild(input)
  document.body.appendChild(label)
  label.click()
  setTimeout(() => label.remove(), 60)
}

export function haptic(kind: Haptic) {
  if (typeof navigator === "undefined" || !hapticsEnabled()) return
  try {
    const nav: Navigator = navigator
    if (typeof nav.vibrate === "function") {
      nav.vibrate(PATTERNS[kind])
    } else if (/iPhone|iPad/.test(nav.userAgent)) {
      iosTap()
    }
  } catch {
    /* feedback is a bonus: never let it break a tap */
  }
}
