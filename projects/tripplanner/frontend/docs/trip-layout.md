# Trip 3-Panel Layout

Route: `/trip/[tripId]?tab=options|segments`

## Layout Structure

```
┌──────────────┬──────────────────────┬──────────────────────┐
│  ChatPanel   │  TripPageContent     │  OptionDetailPanel   │
│  mode=inline │  (list panel)        │  or                  │
│              │  Tabs: Options /     │  SegmentDetailPanel  │
│              │  Segments            │                      │
└──────────────┴──────────────────────┴──────────────────────┘
     chat col         list col               detail col
```

## Key Components

| Component | File | Role |
|-----------|------|------|
| `TripPageContent` | `app/trip/[tripId]/TripPageContent.tsx` | Orchestrator: fetches data, renders all 3 panels |
| `TripPanelLayout` | `app/trip/[tripId]/TripPanelLayout.tsx` | CSS grid shell; animates column widths |
| `TripLayoutContext` / `TripLayoutProvider` | `app/trip/[tripId]/TripLayoutContext.tsx` | Panel state (chat open, detail item, active tab, panelMode) |
| `ChatPanel` | `app/chat/ChatPanel.tsx` | Chat UI; `mode="inline"` renders as flex div in grid |
| `ConditionalChatOverlay` | `app/chat/ConditionalChatOverlay.tsx` | Hides floating ChatButton+ChatPanel on `/trip/*` routes |
| `OptionDetailPanel` | `app/options/OptionDetailPanel.tsx` | Wraps `OptionDetailContent` — Sheet on mobile, inline on desktop/tablet |
| `SegmentDetailPanel` | `app/segments/SegmentDetailPanel.tsx` | Wraps `SegmentDetailContent` — Sheet on mobile, inline on desktop/tablet |
| `OptionDetailContent` | `app/options/OptionDetailContent.tsx` | Option form (no Dialog wrapper); exposes `requestClose()` via ref |
| `SegmentDetailContent` | `app/segments/SegmentDetailContent.tsx` | Segment form (no Dialog wrapper); exposes `requestClose()` via ref |
| `OptionsList` | `app/options/OptionsList.tsx` | Filterable option cards; calls `onEditOption` on click |
| `SegmentsList` | `app/segments/SegmentsList.tsx` | Filterable segment cards; calls `onEditSegment` on click |

## Responsive Behaviour

| Mode | Breakpoint | Chat | Detail |
|------|-----------|------|--------|
| desktop | ≥1280px | inline column (300px) | inline column (420px) |
| tablet | 768–1279px | inline column; auto-closes when detail opens | inline column |
| mobile | <768px | Sheet (left) | Sheet (right) |

## Grid Column Logic (`TripPanelLayout`)

```
isChatOpen  isDetailOpen  columns
true        true          "300px 1fr 420px"
true        false         "300px 1fr"
false       true          "1fr 420px"
false       false         "1fr"
```

## Old Routes

`/options?tripId=X` and `/segments?tripId=X` redirect to `/trip/X?tab=options|segments`.
