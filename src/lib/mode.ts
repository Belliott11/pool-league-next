import { createContext, useContext } from "react"

// True for everyone who is looking at the shared stats without an editor account: the pages hide
// their add, edit and delete controls.
export const ReadOnlyContext = createContext(false)
export const useReadOnly = () => useContext(ReadOnlyContext)
