// TripPanelLayout.tsx
// CSS-grid shell with up to 4 panels: chat | list | option-detail | segment-detail.
// Columns animate as panels open/close.
// Desktop: up to 4 panels side by side.
// Tablet: up to 3 panels.
// Mobile: handled by parent (detail/chat render as Sheets).
"use client"

import { useTripLayout } from "./TripLayoutContext"
import { cn } from "../../lib/utils"

interface TripPanelLayoutProps {
  chatPanel: React.ReactNode
  listPanel: React.ReactNode
  /** Option detail content */
  detailPanel: React.ReactNode
  /** Segment detail content — shown as 4th column when set and optionPanel is open */
  secondaryDetailPanel?: React.ReactNode
  /** Whether the option detail column is visible */
  isOptionPanelOpen: boolean
  /** Whether the segment detail column is visible */
  isSegmentPanelOpen: boolean
}

export function TripPanelLayout({
  chatPanel,
  listPanel,
  detailPanel,
  secondaryDetailPanel,
  isOptionPanelOpen,
  isSegmentPanelOpen,
}: TripPanelLayoutProps) {
  const { isChatOpen, panelMode } = useTripLayout()

  const showChatColumn = isChatOpen && panelMode !== "mobile"
  const showOptionColumn = isOptionPanelOpen && panelMode !== "mobile"
  const showSegmentColumn = isSegmentPanelOpen && panelMode !== "mobile"

  // Build grid-template-columns dynamically
  let gridCols = "1fr"
  if (panelMode === "desktop") {
    if (showChatColumn && showOptionColumn && showSegmentColumn) gridCols = "1fr 1fr 1fr 1fr"
    else if (showChatColumn && showOptionColumn) gridCols = "1fr 1fr 2fr"
    else if (showOptionColumn && showSegmentColumn) gridCols = "1fr 2fr 1fr"
    else if (showChatColumn) gridCols = "300px 1fr"
    else if (showOptionColumn) gridCols = "1fr 2fr"
    else gridCols = "1fr"
  } else if (panelMode === "tablet") {
    if (showOptionColumn && showSegmentColumn) gridCols = "1fr 1fr 1fr"
    else if (showChatColumn) gridCols = "300px 1fr"
    else if (showOptionColumn) gridCols = "1fr 1.5fr"
    else gridCols = "1fr"
  }

  return (
    <div
      className="grid h-full transition-[grid-template-columns] duration-300 ease-in-out overflow-hidden"
      style={{ gridTemplateColumns: gridCols }}
    >
      {/* Chat panel column */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out border-r bg-background",
          showChatColumn ? "opacity-100" : "opacity-0 w-0 pointer-events-none hidden"
        )}
        aria-hidden={!showChatColumn}
      >
        <div className="h-full overflow-y-auto">
          {chatPanel}
        </div>
      </div>

      {/* List panel column — always visible */}
      <div className="overflow-y-auto min-w-0">
        {listPanel}
      </div>

      {/* Option detail panel column */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out border-l bg-background",
          showOptionColumn ? "opacity-100" : "opacity-0 w-0 pointer-events-none hidden"
        )}
        aria-hidden={!showOptionColumn}
      >
        <div className="h-full overflow-y-auto">
          {detailPanel}
        </div>
      </div>

      {/* Segment detail panel column */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out border-l bg-background",
          showSegmentColumn ? "opacity-100" : "opacity-0 w-0 pointer-events-none hidden"
        )}
        aria-hidden={!showSegmentColumn}
      >
        <div className="h-full overflow-y-auto">
          {secondaryDetailPanel}
        </div>
      </div>
    </div>
  )
}
