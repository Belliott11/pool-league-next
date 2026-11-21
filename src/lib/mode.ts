import { createContext, useContext } from "react"
import type { Update } from "@/lib/store"

// True for everyone who is looking at the shared stats without an editor account: the pages hide
// their add, edit and delete controls.
export const ReadOnlyContext = createContext(false)
export const useReadOnly = () => useContext(ReadOnlyContext)

// The editor's way to change the league data, for small controls deep in a page (a headline's clip mark). Null for visitors.
export const UpdateContext = createContext<Update | null>(null)
export const useUpdate = () => useContext(UpdateContext)
