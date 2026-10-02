import type { ReactNode } from "react"
import { IconChip } from "@/components/IconChip"
import { Badge } from "@/components/ui/badge"
import { panelIcon } from "@/lib/panelIcons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// One titled card, the building block of every Leaderboard / Player panel. `tag` is the small
// "Real site data" / "Early / Experimental" chip the classic site puts next to a panel title.
export function Panel({ title, hint, tag, children }: { title: string; hint?: ReactNode; tag?: string; children: ReactNode }) {
  return (
    <Card data-panel={title} className="min-w-0 scroll-mt-20">
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <IconChip icon={panelIcon(title)} />
          {title}
          {tag && (
            <Badge variant="secondary" className="ml-2 align-middle">
              {tag}
            </Badge>
          )}
        </CardTitle>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-3">{children}</CardContent>
    </Card>
  )
}
