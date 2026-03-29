// OptionDetailPanel.tsx
// Hosts OptionDetailContent:
//   - Desktop/tablet: rendered as an inline column (no wrapper needed, parent grid handles it)
//   - Mobile: rendered as a right Sheet
"use client"

import { useRef } from "react"
import { Sheet, SheetContent, SheetTitle } from "../components/ui/sheet"
import { OptionDetailContent, type OptionDetailContentProps, type OptionDetailContentHandle } from "./OptionDetailContent"
import { useTripLayout } from "../trip/[tripId]/TripLayoutContext"

export function OptionDetailPanel(props: OptionDetailContentProps) {
  const contentRef = useRef<OptionDetailContentHandle>(null)
  const { panelMode, closeDetail } = useTripLayout()

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
          <SheetTitle className="sr-only">Option</SheetTitle>
          <OptionDetailContent ref={contentRef} {...props} />
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop/tablet: render inline — the TripPanelLayout grid handles placement
  return <OptionDetailContent ref={contentRef} {...props} />
}
