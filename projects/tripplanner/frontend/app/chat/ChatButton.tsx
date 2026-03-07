"use client"

import { MessageCircle } from "lucide-react"
import { Button } from "../components/ui/button"
import { useChatContext } from "./ChatProvider"

export function ChatButton() {
  const { isOpen, setIsOpen } = useChatContext()

  return (
    <Button
      onClick={() => setIsOpen(!isOpen)}
      size="icon"
      className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-40"
    >
      <MessageCircle className="h-5 w-5" />
    </Button>
  )
}
