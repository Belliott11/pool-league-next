// Picks one option, the same one every time for the same seed, so wording varies between moments without shuffling
// on refresh.
export function pick<T>(seed: string, options: T[]): T {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return options[h % options.length]
}
