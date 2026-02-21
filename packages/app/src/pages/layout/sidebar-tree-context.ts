import { createContext, useContext } from "solid-js"
import type { Session } from "@opencode-ai/sdk/v2/client"

export type SessionTreeContext = {
  allSessions: () => Session[]
  expanded: (sessionId: string) => boolean
  toggle: (sessionId: string) => void
}

export const SessionTreeContext = createContext<SessionTreeContext>()

export const useSessionTree = () => {
  const ctx = useContext(SessionTreeContext)
  return (
    ctx ?? {
      allSessions: () => [],
      expanded: () => false,
      toggle: () => {},
    }
  )
}
