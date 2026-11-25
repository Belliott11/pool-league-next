import type { RuleSection } from "../src/lib/rulebook"
export function normalize(raw: unknown): RuleSection[] | null
export function hashOf(sections: RuleSection[]): string
