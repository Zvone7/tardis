"use client"

import { usePathname } from "next/navigation"
import { ChatButton } from "./ChatButton"
import { ChatPanel } from "./ChatPanel"
import { useCurrentUser } from "../hooks/useCurrentUser"

/**
 * Renders the floating chat button and overlay panel.
 * Hidden on /trip/* routes where chat is embedded inline in the 3-panel layout.
 * Hidden for unauthenticated users.
 */
export function ConditionalChatOverlay() {
  const pathname = usePathname()
  const { user, isLoading } = useCurrentUser()
  if (pathname?.startsWith("/trip") || pathname === "/trips") return null
  if (isLoading || !user) return null
  return (
    <>
      <ChatButton />
      <ChatPanel />
    </>
  )
}
