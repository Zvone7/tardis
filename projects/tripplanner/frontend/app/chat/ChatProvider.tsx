"use client"

import React, { createContext, useContext, useState, useCallback, useRef } from "react"
import { useChatAssistant } from "./useChatAssistant"
import type { ChatMessage } from "./types"

interface ChatContextValue {
  tripId: number | null
  tripName: string | null
  setTrip: (id: number | null, name: string | null) => void
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  sendMessage: (text: string, imageDataUrls?: string[]) => Promise<void>
  stopStreaming: () => void
  clearMessages: () => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  registerRefreshCallback: (cb: () => void) => () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider")
  return ctx
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [tripId, setTripId] = useState<number | null>(null)
  const [tripName, setTripName] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [preferredUtcOffset, setPreferredUtcOffset] = useState(0)
  const refreshCallbacks = useRef<Set<() => void>>(new Set())

  const onDataChanged = useCallback(() => {
    refreshCallbacks.current.forEach((cb) => cb())
  }, [])

  const chat = useChatAssistant({
    tripId,
    tripName,
    preferredUtcOffset,
    onDataChanged,
  })

  const setTrip = useCallback((id: number | null, name: string | null) => {
    setTripId(id)
    setTripName(name)
  }, [])

  const registerRefreshCallback = useCallback((cb: () => void) => {
    refreshCallbacks.current.add(cb)
    return () => {
      refreshCallbacks.current.delete(cb)
    }
  }, [])

  return (
    <ChatContext.Provider
      value={{
        tripId,
        tripName,
        setTrip,
        ...chat,
        isOpen,
        setIsOpen,
        registerRefreshCallback,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}
