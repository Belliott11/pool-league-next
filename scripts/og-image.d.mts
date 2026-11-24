// Types for og-image.mjs, which vite.config.ts imports at build time.
export function cherryHillDate(now: Date): string
export function standings(state: unknown): { id: string; name: string; w: number; l: number }[]
export function ogContent(state: unknown, now?: Date): { kicker: string; headline: string; sub: string; tableTitle: string; table: { id: string; name: string; w: number; l: number }[] }
export function ogSvg(content: ReturnType<typeof ogContent>): string
export function renderOg(state: unknown, now?: Date): Buffer
