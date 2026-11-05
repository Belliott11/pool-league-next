// Every counting stat and rating is a rate per this many combined points scored by both teams in the games a player was
// in. A typical game totals about 25, so a rate reads as "what a normal game looks like". Changing it rescales every
// "/25" number; the labels in panel text are plain words, so search them when it changes.
export const PER = 25
