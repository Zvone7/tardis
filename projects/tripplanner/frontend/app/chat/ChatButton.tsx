"use client"

import { MessageCircle } from "lucide-react"
import { Button } from "../components/ui/button"
import { useChatContext } from "./ChatProvider"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { useMediaQuery } from "../hooks/useMediaQuery"

export function ChatButton() {
  const { isOpen, setIsOpen, isMinimized, setIsMinimized } = useChatContext()
  const { user, isLoading } = useCurrentUser()
  const isWide = useMediaQuery("(min-width: 768px)")

  if (isLoading || !user) return null

  // On wide screens, hide FAB when minimized — the minimized bar handles restore
  if (isWide && isMinimized) return null

  const handleClick = () => {
    if (isOpen) {
      setIsOpen(false)
    } else {
      setIsMinimized(false)
      setIsOpen(true)
    }
  }

  return (
    <Button
      onClick={handleClick}
      size="icon"
      className="fixed bottom-20 left-6 h-12 w-12 rounded-full shadow-lg z-40"
    >
      <MessageCircle className="h-5 w-5" />
    </Button>
  )
}
