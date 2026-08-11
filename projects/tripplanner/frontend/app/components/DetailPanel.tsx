"use client"

import { useRef } from "react"
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet"
import { useTripLayout } from "../trip/[tripId]/TripLayoutContext"

export interface DetailPanelContentHandle {
  requestClose: () => void
}

interface DetailPanelProps {
  isOpen: boolean
  sheetTitle: string
  children: (ref: React.Ref<DetailPanelContentHandle>) => React.ReactNode
}

export function DetailPanel({ isOpen, sheetTitle, children }: DetailPanelProps) {
  const contentRef = useRef<DetailPanelContentHandle>(null)
  const { panelMode } = useTripLayout()

  const handleClose = () => {
    contentRef.current?.requestClose()
  }

  if (panelMode === "mobile") {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
        <SheetContent side="right" hideOverlay className="flex flex-col p-0 w-[90vw] sm:max-w-lg">
          <SheetTitle className="sr-only">{sheetTitle}</SheetTitle>
          {children(contentRef)}
        </SheetContent>
      </Sheet>
    )
  }

  return <>{children(contentRef)}</>
}
