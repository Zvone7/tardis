"use client"

import React, { createContext, useContext, useState, useCallback, useRef } from "react"
import { useChatAssistant } from "./useChatAssistant"
import type { ChatMessage } from "./types"
import type { ChatSession } from "./chatSessions"

interface ChatContextValue {
  tripId: number | null
  tripName: string | null
  setTrip: (id: number | null, name: string | null) => void
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  sendMessage: (text: string, imageDataUrls?: string[]) => Promise<void>
  stopStreaming: () => void
  newConversation: () => void
  switchToSession: (sessionId: string) => void
  deleteConversation: (sessionId: string) => void
  sessions: ChatSession[]
  activeSessionId: string
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  isMinimized: boolean
  setIsMinimized: (minimized: boolean) => void
  registerRefreshCallback: (cb: () => void) => () => void
  setPreferredUtcOffset: (offset: number) => void
  setPreferredCurrencyId: (id: number | null) => void
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
  const [isMinimized, setIsMinimized] = useState(false)
  const [preferredUtcOffset, setPreferredUtcOffset] = useState(0)
  const [preferredCurrencyId, setPreferredCurrencyId] = useState<number | null>(null)
  const refreshCallbacks = useRef<Set<() => void>>(new Set())

  const onDataChanged = useCallback(() => {
    refreshCallbacks.current.forEach((cb) => cb())
  }, [])

  const chat = useChatAssistant({
    tripId,
    tripName,
    preferredUtcOffset,
    preferredCurrencyId,
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
        isMinimized,
        setIsMinimized,
        registerRefreshCallback,
        setPreferredUtcOffset,
        setPreferredCurrencyId,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}
