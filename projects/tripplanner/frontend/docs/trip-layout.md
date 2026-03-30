# Trip Layout

Route: `/trip/[tripId]?tab=options|segments`

## Layout Structure

Up to 4 columns on desktop: chat | list | option detail | segment detail.

```
┌───────────┬───────────┬───────────────────┬───────────────────┐
│ ChatPanel │ List      │ OptionDetailPanel │ SegmentDetailPanel│
│ inline    │ (Options  │                   │ (shown alongside  │
│           │  /Segs)   │                   │  option detail)   │
└───────────┴───────────┴───────────────────┴───────────────────┘
  chat col    list col      option col           segment col
```

Segment detail can be open simultaneously with option detail (e.g. when clicking a segment icon inside an option). Closing the segment panel returns to option-only view.

## Key Components

| Component | File | Role |
|-----------|------|------|
| `TripPageContent` | `app/trip/[tripId]/TripPageContent.tsx` | Orchestrator: fetches data, manages panel state, renders all panels |
| `TripPanelLayout` | `app/trip/[tripId]/TripPanelLayout.tsx` | CSS grid shell; animates column widths; accepts `isOptionPanelOpen` + `isSegmentPanelOpen` booleans |
| `TripLayoutContext` / `TripLayoutProvider` | `app/trip/[tripId]/TripLayoutContext.tsx` | Panel state: `optionPanelId`, `segmentPanelId`, chat open, active tab, `panelMode` |
| `ChatPanel` | `app/chat/ChatPanel.tsx` | Chat UI; `mode="inline"` renders as flex div in grid |
| `ConditionalChatOverlay` | `app/chat/ConditionalChatOverlay.tsx` | Hides floating ChatButton+ChatPanel on `/trip/*` routes |
| `OptionDetailPanel` | `app/options/OptionDetailPanel.tsx` | Wraps `OptionDetailContent` — Sheet on mobile, inline on desktop/tablet |
| `SegmentDetailPanel` | `app/segments/SegmentDetailPanel.tsx` | Wraps `SegmentDetailContent` — Sheet on mobile, inline on desktop/tablet |
| `OptionDetailContent` | `app/options/OptionDetailContent.tsx` | Option form with timeline/list segment selector; exposes `requestClose()` via ref |
| `SegmentDetailContent` | `app/segments/SegmentDetailContent.tsx` | Segment form; exposes `requestClose()` via ref |
| `OptionsList` | `app/options/OptionsList.tsx` | Filterable option cards; segment icons show a floating `TimelineSegmentCard` on click |
| `SegmentsList` | `app/segments/SegmentsList.tsx` | Filterable segment cards; calls `onEditSegment` on click |
| `SegmentTimeline` | `app/components/timeline/SegmentTimeline.tsx` | Interactive timeline inside `OptionDetailContent`; shows all dated segments as horizontal bars |
| `TimelineSegmentCard` | `app/components/timeline/TimelineSegmentCard.tsx` | Floating card shown when a segment bar or icon is clicked; has Add/Remove + pencil (navigate to segment) buttons |

## Context API (`TripLayoutContext`)

```typescript
optionPanelId: number | null       // ID of the open option; null = closed
segmentPanelId: number | null      // ID of the open segment; null = closed

openOptionDetail(id)               // opens option, clears segment panel
openSegmentDetail(id)              // opens segment alongside current option panel
closeOptionDetail()                // closes option AND segment
closeSegmentDetail()               // closes segment only; option stays open
closeDetail()                      // closes both
```

## Grid Column Logic (`TripPanelLayout`) — Desktop

```
chat   option  segment   columns
 ✓       ✓       ✓       "1fr 1fr 1fr 1fr"   (25% each)
 ✓       ✓       ✗       "1fr 1fr 2fr"       (chat ¼, list ¼, option ½)
 ✗       ✓       ✓       "1fr 2fr 1fr"       (list ¼, option ½, segment ¼)
 ✓       ✗       ✗       "300px 1fr"
 ✗       ✓       ✗       "1fr 2fr"
 ✗       ✗       ✗       "1fr"
```

## Grid Column Logic — Tablet

```
option  segment   columns
  ✓       ✓       "1fr 1fr 1fr"   (list + option + segment, equal thirds)
  ✓       ✗       "1fr 1.5fr"
  chat only        "300px 1fr"
  none             "1fr"
```

## Responsive Behaviour

| Mode | Breakpoint | Chat | Detail panels |
|------|-----------|------|--------|
| desktop | ≥1280px | inline column | up to 2 inline detail columns alongside list |
| tablet | 768–1279px | inline column; auto-closes when detail opens | up to 2 detail columns |
| mobile | <768px | Sheet (left) | Sheet (right); only one detail at a time |

## Segment panel open/close flow

1. User clicks a segment icon in `OptionsList` → floating `TimelineSegmentCard` shown (no panel opened)
2. User clicks pencil in `TimelineSegmentCard` → `openSegmentDetail(id)` → segment panel slides in alongside option panel
3. User saves/closes segment panel → `closeSegmentDetail()` → segment panel closes, option panel stays
4. User closes option panel → `closeOptionDetail()` → both panels close

## Old Routes

`/options?tripId=X` and `/segments?tripId=X` redirect to `/trip/X?tab=options|segments`.
