"use client"

import { usePathname } from "next/navigation"
import { ChatButton } from "./ChatButton"
import { ChatPanel } from "./ChatPanel"

/**
 * Renders the floating chat button and overlay panel.
 * Hidden on /trip/* routes where chat is embedded inline in the 3-panel layout.
 */
export function ConditionalChatOverlay() {
  const pathname = usePathname()
  if (pathname?.startsWith("/trip") || pathname === "/trips") return null
  return (
    <>
      <ChatButton />
      <ChatPanel />
    </>
  )
}
