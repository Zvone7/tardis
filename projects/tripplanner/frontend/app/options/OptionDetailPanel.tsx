// OptionDetailPanel.tsx
// Hosts OptionDetailContent:
//   - Desktop/tablet: rendered as an inline column (no wrapper needed, parent grid handles it)
//   - Mobile: rendered as a right Sheet
"use client"

import { DetailPanel } from "../components/DetailPanel"
import { OptionDetailContent, type OptionDetailContentProps } from "./OptionDetailContent"

export function OptionDetailPanel(props: OptionDetailContentProps) {
  return (
    <DetailPanel isOpen={props.isOpen} sheetTitle="Option">
      {(ref) => <OptionDetailContent ref={ref} {...props} />}
    </DetailPanel>
  )
}
