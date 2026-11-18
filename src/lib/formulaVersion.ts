// Bump this whenever a stat formula or a filter rule changes what the panels show. The hand-written reads and headlines are stamped with
// the version they were written for (the "formula" field in src/data/*.json); when the stamp is behind, the site says so, and the
// going-in, season and night headlines step aside for the self-updating ones until they are rewritten.
//
//  1  rates per 25 combined points
//  2  rates per average game of trips (turns with the ball)
//  3  double teams split between defenders everywhere; the Filters menu applies to every panel and stat
export const FORMULA_VERSION = 3
