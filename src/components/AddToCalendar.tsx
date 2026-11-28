import { CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { feedUrl, icsFor, type Night } from "@/lib/calendar"

// "Add to calendar" for one game night (calendar.ts): a calendar file the phone opens in its calendar app. With `subscribe`, also a link
// to every night (nights.ics), which a calendar keeps up to date by itself.
export function AddToCalendar({ night, subscribe = true }: { night: Night; subscribe?: boolean }) {
  const save = () => {
    const blob = new Blob([icsFor([night])], { type: "text/calendar;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `pool-basketball-${night.date}.ics`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button size="sm" variant="outline" onClick={save}>
        <CalendarPlus aria-hidden /> Add to calendar
      </Button>
      {subscribe && (
        <a href={feedUrl()} className="text-xs font-medium text-accent hover:underline">
          Or subscribe to every game night
        </a>
      )}
    </div>
  )
}
