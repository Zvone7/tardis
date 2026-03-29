// SegmentDetailPanel.tsx
// Hosts SegmentDetailContent:
//   - Desktop/tablet: rendered as an inline column (no wrapper needed, parent grid handles it)
//   - Mobile: rendered as a right Sheet
"use client"

import { DetailPanel } from "../components/DetailPanel"
import { SegmentDetailContent } from "./SegmentDetailContent"
import type { SegmentModalProps } from "../types/models"

export function SegmentDetailPanel(props: SegmentModalProps) {
  return (
    <DetailPanel isOpen={props.isOpen} sheetTitle="Segment">
      {(ref) => <SegmentDetailContent ref={ref} {...props} />}
    </DetailPanel>
  )
}
