"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useMediaQuery } from "../../hooks/useMediaQuery"
import { useChatContext } from "../../chat/ChatProvider"

export type PanelMode = "desktop" | "tablet" | "mobile"
export type ActiveTab = "options" | "segments"

interface TripLayoutContextValue {
  // Panel visibility
  isChatOpen: boolean
  toggleChat: () => void
  openChat: () => void
  closeChat: () => void

  // Option detail panel (left detail)
  optionPanelId: number | null
  openOptionDetail: (id: number) => void
  closeOptionDetail: () => void  // closes option AND segment

  // Segment detail panel (right detail — can coexist with option panel)
  segmentPanelId: number | null
  openSegmentDetail: (id: number) => void
  closeSegmentDetail: () => void  // closes segment only

  /** Closes both detail panels. */
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

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTabState] = useState<ActiveTab>(initialTab)
  const [optionPanelId, setOptionPanelId] = useState<number | null>(null)
  const [segmentPanelId, setSegmentPanelId] = useState<number | null>(null)

  const setActiveTab = useCallback((tab: ActiveTab) => {
    setActiveTabState(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

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
    setOptionPanelId(id)
    setSegmentPanelId(null) // opening a new option resets any open segment
    if (panelMode === "tablet" && chatContext.isOpen) {
      chatContext.setIsOpen(false)
      chatContext.setIsMinimized(false)
    }
  }, [panelMode, chatContext])

  const openSegmentDetail = useCallback((id: number) => {
    setSegmentPanelId(id)
    // Keep optionPanelId as-is so both panels can coexist
    if (panelMode === "tablet" && chatContext.isOpen) {
      chatContext.setIsOpen(false)
      chatContext.setIsMinimized(false)
    }
  }, [panelMode, chatContext])

  const closeOptionDetail = useCallback(() => {
    setOptionPanelId(null)
    setSegmentPanelId(null) // closing option also closes segment
  }, [])

  const closeSegmentDetail = useCallback(() => {
    setSegmentPanelId(null)
  }, [])

  const closeDetail = useCallback(() => {
    setOptionPanelId(null)
    setSegmentPanelId(null)
  }, [])

  return (
    <TripLayoutContext.Provider
      value={{
        isChatOpen,
        toggleChat,
        openChat,
        closeChat,
        optionPanelId,
        openOptionDetail,
        closeOptionDetail,
        segmentPanelId,
        openSegmentDetail,
        closeSegmentDetail,
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
