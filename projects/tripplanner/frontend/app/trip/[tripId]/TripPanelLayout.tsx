// TripPanelLayout.tsx
// CSS-grid 3-panel shell. Columns animate as panels open/close.
// Desktop: up to 3 panels side by side.
// Tablet: up to 2 panels.
// Mobile: handled by parent (detail/chat render as Sheets).
"use client"

import { useTripLayout } from "./TripLayoutContext"
import { cn } from "../../lib/utils"

interface TripPanelLayoutProps {
  chatPanel: React.ReactNode
  listPanel: React.ReactNode
  detailPanel: React.ReactNode
}

export function TripPanelLayout({ chatPanel, listPanel, detailPanel }: TripPanelLayoutProps) {
  const { isChatOpen, detailPanel: detailState, panelMode } = useTripLayout()

  const isDetailOpen = detailState !== null
  const showChatColumn = isChatOpen && panelMode !== "mobile"
  const showDetailColumn = isDetailOpen && panelMode !== "mobile"

  // Build grid-template-columns dynamically
  let gridCols = "1fr"
  if (panelMode === "desktop") {
    if (showChatColumn && showDetailColumn) gridCols = "300px 1fr 420px"
    else if (showChatColumn) gridCols = "300px 1fr"
    else if (showDetailColumn) gridCols = "1fr 420px"
    else gridCols = "1fr"
  } else if (panelMode === "tablet") {
    if (showChatColumn) gridCols = "300px 1fr"
    else if (showDetailColumn) gridCols = "1fr 420px"
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

      {/* Detail panel column */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out border-l bg-background",
          showDetailColumn ? "opacity-100" : "opacity-0 w-0 pointer-events-none hidden"
        )}
        aria-hidden={!showDetailColumn}
      >
        <div className="h-full overflow-y-auto">
          {detailPanel}
        </div>
      </div>
    </div>
  )
}
