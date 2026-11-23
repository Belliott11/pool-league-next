// This phone's private key for the things a visitor saves without an account (Pick'em votes, preseason predictions). It goes with
// every save, and the database keeps only its hash, so what someone saved can only be changed from the phone that saved it
// (supabase/pickem.sql, supabase/predictions.sql). Without storage (private mode) a key lasts the visit.
const KEY = "pooleanIntelVoteKey"
let sessionKey = ""

export function deviceKey(): string {
  try {
    const have = localStorage.getItem(KEY)
    if (have) return have
  } catch {
    /* storage blocked */
  }
  const key = sessionKey || Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("")
  sessionKey = key
  try {
    localStorage.setItem(KEY, key)
  } catch {
    /* kept for this visit only */
  }
  return key
}
