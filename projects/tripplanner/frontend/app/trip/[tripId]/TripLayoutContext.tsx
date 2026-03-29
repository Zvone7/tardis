"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { useMediaQuery } from "../../hooks/useMediaQuery"
import { useChatContext } from "../../chat/ChatProvider"
import type { OptionApi, Segment } from "../../types/models"

export type PanelMode = "desktop" | "tablet" | "mobile"
export type ActiveTab = "options" | "segments"

export interface DetailPanel {
  type: "option" | "segment"
  id: number
}

interface TripLayoutContextValue {
  // Panel visibility
  isChatOpen: boolean
  toggleChat: () => void
  openChat: () => void
  closeChat: () => void

  // Detail panel
  detailPanel: DetailPanel | null
  openOptionDetail: (id: number) => void
  openSegmentDetail: (id: number) => void
  closeDetail: () => void

  // Active tab
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void

  // Responsive mode
  panelMode: PanelMode
}

const TripLayoutContext = createContext<TripLayoutContextValue | null>(null)

export function useTripLayout() {
  const ctx = useContext(TripLayoutContext)
  if (!ctx) throw new Error("useTripLayout must be used within TripLayoutProvider")
  return ctx
}

export function TripLayoutProvider({
  children,
  initialTab = "options",
}: {
  children: React.ReactNode
  initialTab?: ActiveTab
}) {
  const chatContext = useChatContext()
  const isDesktop = useMediaQuery("(min-width: 1280px)")
  const isTablet = useMediaQuery("(min-width: 768px)")
  const panelMode: PanelMode = isDesktop ? "desktop" : isTablet ? "tablet" : "mobile"

  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab)
  const [detailPanel, setDetailPanel] = useState<DetailPanel | null>(null)

  // Bridge chat state from ChatProvider
  const isChatOpen = chatContext.isOpen && !chatContext.isMinimized

  const toggleChat = useCallback(() => {
    if (isChatOpen) {
      chatContext.setIsOpen(false)
      chatContext.setIsMinimized(false)
    } else {
      chatContext.setIsOpen(true)
      chatContext.setIsMinimized(false)
    }
  }, [isChatOpen, chatContext])

  const openChat = useCallback(() => {
    chatContext.setIsOpen(true)
    chatContext.setIsMinimized(false)
  }, [chatContext])

  const closeChat = useCallback(() => {
    chatContext.setIsOpen(false)
    chatContext.setIsMinimized(false)
  }, [chatContext])

  const openOptionDetail = useCallback((id: number) => {
    setDetailPanel({ type: "option", id })
    // On tablet, opening detail auto-closes chat
    if (panelMode === "tablet" && chatContext.isOpen) {
      chatContext.setIsOpen(false)
      chatContext.setIsMinimized(false)
    }
  }, [panelMode, chatContext])

  const openSegmentDetail = useCallback((id: number) => {
    setDetailPanel({ type: "segment", id })
    // On tablet, opening detail auto-closes chat
    if (panelMode === "tablet" && chatContext.isOpen) {
      chatContext.setIsOpen(false)
      chatContext.setIsMinimized(false)
    }
  }, [panelMode, chatContext])

  const closeDetail = useCallback(() => {
    setDetailPanel(null)
  }, [])

  return (
    <TripLayoutContext.Provider
      value={{
        isChatOpen,
        toggleChat,
        openChat,
        closeChat,
        detailPanel,
        openOptionDetail,
        openSegmentDetail,
        closeDetail,
        activeTab,
        setActiveTab,
        panelMode,
      }}
    >
      {children}
    </TripLayoutContext.Provider>
  )
}
