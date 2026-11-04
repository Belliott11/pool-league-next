// 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd".
export function ordinalOf(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"
  return `${n}${suffix}`
}
