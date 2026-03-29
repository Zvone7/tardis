// SegmentDetailPanel.tsx
// Hosts SegmentDetailContent:
//   - Desktop/tablet: rendered as an inline column (no wrapper needed, parent grid handles it)
//   - Mobile: rendered as a right Sheet
"use client"

import { useRef } from "react"
import { Sheet, SheetContent, SheetTitle } from "../components/ui/sheet"
import { SegmentDetailContent, type SegmentDetailContentHandle } from "./SegmentDetailContent"
import type { SegmentModalProps } from "../types/models"
import { useTripLayout } from "../trip/[tripId]/TripLayoutContext"

export function SegmentDetailPanel(props: SegmentModalProps) {
  const contentRef = useRef<SegmentDetailContentHandle>(null)
  const { panelMode } = useTripLayout()

  const handleClose = () => {
    contentRef.current?.requestClose()
  }

  if (panelMode === "mobile") {
    return (
      <Sheet
        open={props.isOpen}
        onOpenChange={(open) => { if (!open) handleClose() }}
      >
        <SheetContent side="right" hideOverlay className="flex flex-col p-0 w-[90vw] sm:max-w-lg">
          <SheetTitle className="sr-only">Segment</SheetTitle>
          <SegmentDetailContent ref={contentRef} {...props} />
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop/tablet: render inline
  return <SegmentDetailContent ref={contentRef} {...props} />
}
