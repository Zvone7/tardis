"use client"

import { MessageCircle } from "lucide-react"
import { Button } from "../components/ui/button"
import { useChatContext } from "./ChatProvider"
import { useCurrentUser } from "../hooks/useCurrentUser"

export function ChatButton() {
  const { isOpen, setIsOpen } = useChatContext()
  const { user, isLoading } = useCurrentUser()

  if (isLoading || !user) return null

  return (
    <Button
      onClick={() => setIsOpen(!isOpen)}
      size="icon"
      className="fixed bottom-20 left-6 h-12 w-12 rounded-full shadow-lg z-40"
    >
      <MessageCircle className="h-5 w-5" />
    </Button>
  )
}
