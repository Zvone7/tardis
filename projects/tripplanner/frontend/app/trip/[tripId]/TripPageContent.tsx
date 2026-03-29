// TripPageContent.tsx
// Orchestrates the 3-panel trip view.
// Fetches shared trip data once. Renders TripPanelLayout with:
//   - Chat panel (inline ChatPanel in grid mode)
//   - Tabbed list (OptionsList / SegmentsList)
//   - Detail panel (OptionDetailPanel / SegmentDetailPanel)
"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../../components/ui/button"
import { PlusIcon, MessageCircle, MessageCircleOff, CombineIcon, PlaneIcon, BedDoubleIcon, MoreVerticalIcon } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "../../components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { TripPanelLayout } from "./TripPanelLayout"
import { TripLayoutProvider, useTripLayout, type ActiveTab } from "./TripLayoutContext"
import { OptionsList } from "../../options/OptionsList"
import { SegmentsList } from "../../segments/SegmentsList"
import { OptionDetailPanel } from "../../options/OptionDetailPanel"
import { SegmentDetailPanel } from "../../segments/SegmentDetailPanel"
import CombineAllModal from "../../options/CombineAllModal"
import FlightSearch from "../../segments/FlightSearch"
import AccomodationSearch from "../../segments/AccomodationSearch"
import { CurrencyDropdown } from "../../components/CurrencyDropdown"
import { UtcOffsetDropdown } from "../../components/UtcOffsetDropdown"
import { ChatPanel } from "../../chat/ChatPanel"
import { useChatContext } from "../../chat/ChatProvider"
import { useCurrencies } from "../../hooks/useCurrencies"
import { useCurrencyConversions } from "../../hooks/useCurrencyConversions"
import { useCurrentUser } from "../../hooks/useCurrentUser"
import { optionsApi, segmentsApi, tripsApi } from "../../utils/apiClient"
import type { OptionApi, OptionSave, Segment, SegmentSave, SegmentType, Currency, CurrencyConversion, SegmentApi } from "../../types/models"
import { extractTripLocations } from "../../lib/tripLocations"
import type { SegmentFilterValue } from "../../components/filters/SegmentFilterPanel"

// ---- inner component that can use useTripLayout ----

function TripPanelInner({ tripId, initialTab }: { tripId: number; initialTab: ActiveTab }) {
  const { isChatOpen, toggleChat, detailPanel, openOptionDetail, openSegmentDetail, closeDetail, activeTab, setActiveTab, panelMode } = useTripLayout()
  const chatContext = useChatContext()
  const router = useRouter()

  // ---- shared trip data ----
  const [tripName, setTripName] = useState("")
  const [tripCurrencyId, setTripCurrencyId] = useState<number | null>(null)
  const [displayCurrencyId, setDisplayCurrencyId] = useState<number | null>(null)
  const [userPreferredOffset, setUserPreferredOffset] = useState(0)
  const [userPreferredCurrencyId, setUserPreferredCurrencyId] = useState<number | null>(null)

  // ---- options data ----
  const [options, setOptions] = useState<OptionApi[]>([])
  const [connectedSegments, setConnectedSegments] = useState<Record<number, (SegmentApi & { segmentType: SegmentType })[]>>({})
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  // ---- segments data ----
  const [segments, setSegments] = useState<Segment[]>([])
  const [segmentTypes, setSegmentTypes] = useState<SegmentType[]>([])
  const [segmentsLoading, setSegmentsLoading] = useState(true)
  const [segmentsError, setSegmentsError] = useState<string | null>(null)
  const tripLocations = useMemo(() => extractTripLocations(segments), [segments])

  // ---- detail state ----
  const [editingOption, setEditingOption] = useState<OptionApi | null>(null)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // ---- other modals ----
  const [isCombineAllOpen, setIsCombineAllOpen] = useState(false)
  const [isFlightSearchOpen, setIsFlightSearchOpen] = useState(false)
  const [isAccommodationOpen, setIsAccommodationOpen] = useState(false)

  const { currencies, isLoading: isLoadingCurrencies } = useCurrencies()
  const { conversions } = useCurrencyConversions()
  const { user } = useCurrentUser()

  // ---- data fetching ----

  const fetchTripData = useCallback(async () => {
    try {
      const data = await tripsApi.getById(tripId)
      setTripName(data.name)
      setTripCurrencyId(data.currencyId ?? null)
    } catch (err) {
      console.error("Error fetching trip:", err)
      setTripName("Unknown Trip")
    }
  }, [tripId])

  const fetchOptions = useCallback(async () => {
    setOptionsLoading(true)
    try {
      const data = await optionsApi.getByTripId(tripId)
      setOptions(data)
    } catch (err) {
      setOptionsError("Failed to load options")
      console.error(err)
    } finally {
      setOptionsLoading(false)
    }
  }, [tripId])

  const fetchSegments = useCallback(async () => {
    setSegmentsLoading(true)
    try {
      const data = await segmentsApi.getByTripId(tripId)
      setSegments(data)
    } catch (err) {
      setSegmentsError("Failed to load segments")
      console.error(err)
    } finally {
      setSegmentsLoading(false)
    }
  }, [tripId])

  const fetchSegmentTypes = useCallback(async () => {
    try {
      const data = await segmentsApi.getTypes()
      setSegmentTypes(data)
    } catch (err) {
      console.error("Error fetching segment types:", err)
    }
  }, [])

  useEffect(() => {
    fetchTripData()
    fetchOptions()
    fetchSegments()
    fetchSegmentTypes()
  }, [fetchTripData, fetchOptions, fetchSegments, fetchSegmentTypes])

  // Hydrate connected segments for options
  useEffect(() => {
    if (!options.length || !segmentTypes.length) return
    let cancelled = false
    const load = async () => {
      try {
        const entries = await Promise.all(
          options.map(async (option) => {
            try {
              const connected = await optionsApi.getConnectedSegments(tripId, option.id)
              return [option.id, connected.map((s) => ({
                ...s,
                segmentType: segmentTypes.find((st) => st.id === s.segmentTypeId) ?? { id: 0, name: "Unknown", shortName: "?" },
              }))] as const
            } catch {
              return [option.id, []] as const
            }
          })
        )
        if (!cancelled) setConnectedSegments(Object.fromEntries(entries) as any)
      } catch (err) {
        if (!cancelled) console.error("Failed to load connected segments", err)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [tripId, options, segmentTypes])

  // User preferences
  useEffect(() => {
    if (!user) return
    setUserPreferredCurrencyId(user.userPreference?.preferredCurrencyId ?? null)
    setUserPreferredOffset(user.userPreference?.preferredUtcOffset ?? 0)
  }, [user])

  // Default display currency
  useEffect(() => {
    if (displayCurrencyId !== null) return
    if (tripCurrencyId) { setDisplayCurrencyId(tripCurrencyId); return }
    if (userPreferredCurrencyId) setDisplayCurrencyId(userPreferredCurrencyId)
  }, [displayCurrencyId, tripCurrencyId, userPreferredCurrencyId])

  // Register chat callbacks
  useEffect(() => {
    chatContext.setTrip(tripId, tripName)
    return () => chatContext.setTrip(null, null)
  }, [tripId, tripName])

  useEffect(() => {
    return chatContext.registerRefreshCallback(() => {
      fetchOptions()
      fetchSegments()
    })
  }, [chatContext.registerRefreshCallback, fetchOptions, fetchSegments])

  // Sync detail panel with editing state
  useEffect(() => {
    if (!detailPanel) {
      setEditingOption(null)
      setEditingSegment(null)
      setIsDetailModalOpen(false)
      return
    }
    if (detailPanel.type === "option") {
      const found = options.find((o) => o.id === detailPanel.id) ?? null
      setEditingOption(found)
      setIsDetailModalOpen(true)
    } else {
      const found = segments.find((s) => s.id === detailPanel.id) ?? null
      setEditingSegment(found)
      setIsDetailModalOpen(true)
    }
  }, [detailPanel, options, segments])

  // ---- handlers ----

  const handleEditOption = useCallback((option: OptionApi | null) => {
    if (option) {
      openOptionDetail(option.id)
    } else {
      // Create new — open with null (no detailPanel id yet, open modal directly)
      setEditingOption(null)
      setIsDetailModalOpen(true)
      closeDetail()
    }
  }, [openOptionDetail, closeDetail])

  const handleEditSegment = useCallback((segment: Segment | null) => {
    if (segment) {
      openSegmentDetail(segment.id)
    } else {
      setEditingSegment(null)
      setIsDetailModalOpen(true)
      closeDetail()
    }
  }, [openSegmentDetail, closeDetail])

  const handleCloseDetail = useCallback(() => {
    closeDetail()
    setIsDetailModalOpen(false)
    setEditingOption(null)
    setEditingSegment(null)
  }, [closeDetail])

  const handleSaveOption = useCallback(async (optionData: OptionSave) => {
    try {
      if (editingOption) {
        await optionsApi.update(String(tripId), { ...optionData, id: editingOption.id })
      } else {
        await optionsApi.create(String(tripId), optionData)
      }
      await fetchOptions()
    } catch (err) {
      console.error("Error saving option:", err)
    }
  }, [tripId, editingOption, fetchOptions])

  const handleSaveSegment = useCallback(async (segmentData: SegmentSave, isUpdate: boolean, originalSegmentId?: number) => {
    try {
      if (isUpdate && originalSegmentId) {
        await segmentsApi.update(String(tripId), { ...segmentData, id: originalSegmentId })
      } else {
        await segmentsApi.create(String(tripId), segmentData)
      }
      handleCloseDetail()
      await fetchSegments()
    } catch (err) {
      console.error("Error saving segment:", err)
    }
  }, [tripId, fetchSegments, handleCloseDetail])

  const effectiveDisplayCurrencyId = displayCurrencyId ?? tripCurrencyId ?? userPreferredCurrencyId ?? null

  const initialSegmentFilters = useMemo<SegmentFilterValue>(() => ({
    locations: [],
    types: [],
    dateRange: { start: "", end: "" },
    costMin: null,
    costMax: null,
    showHidden: false,
  }), [])

  // ---- render ----

  const isDetailOpen = isDetailModalOpen
  const isOptionDetail = detailPanel?.type === "option" || (!detailPanel && editingOption === null && isDetailModalOpen && activeTab === "options")
  const isSegmentDetail = detailPanel?.type === "segment" || (!detailPanel && editingSegment === null && isDetailModalOpen && activeTab === "segments")

  const chatPanelContent = <ChatPanel mode="inline" />

  const listPanelContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-semibold truncate">{tripName || `Trip ${tripId}`}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Chat toggle */}
          <Button
            size="icon"
            onClick={toggleChat}
            title={isChatOpen ? "Close chat" : "Open chat"}
            className="h-9 w-9 rounded-full shadow-md"
          >
            {isChatOpen ? <MessageCircleOff className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
          </Button>
          {/* More menu */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"><MoreVerticalIcon className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2 space-y-2">
              <div>
                <span className="text-xs text-muted-foreground px-1">Display currency</span>
                <CurrencyDropdown
                  value={effectiveDisplayCurrencyId}
                  onChange={setDisplayCurrencyId}
                  currencies={currencies}
                  placeholder={isLoadingCurrencies ? "Loading..." : "Display currency"}
                  disabled={isLoadingCurrencies}
                  className="w-full text-sm mt-1"
                  triggerClassName="w-full h-9 text-sm px-3"
                />
              </div>
              <div>
                <span className="text-xs text-muted-foreground px-1">Timezone offset</span>
                <UtcOffsetDropdown
                  value={userPreferredOffset}
                  onChange={setUserPreferredOffset}
                  className="w-full text-sm mt-1"
                  triggerClassName="w-full h-9 text-sm px-3"
                />
              </div>
              {activeTab === "options" && (
                <div className="border-t pt-1">
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                    onClick={() => setIsCombineAllOpen(true)}
                  >
                    <CombineIcon className="h-4 w-4" />
                    Combine All
                  </button>
                </div>
              )}
              {activeTab === "segments" && (
                <div className="border-t pt-1">
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                    onClick={() => setIsFlightSearchOpen(true)}
                  >
                    <PlaneIcon className="h-4 w-4" />
                    Search Flights
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                    onClick={() => setIsAccommodationOpen(true)}
                  >
                    <BedDoubleIcon className="h-4 w-4" />
                    Search Accommodation
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          {/* Create button */}
          <Button size="sm" onClick={() => activeTab === "options" ? handleEditOption(null) : handleEditSegment(null)}>
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
          <TabsList>
            <TabsTrigger value="options">Options</TabsTrigger>
            <TabsTrigger value="segments">Segments</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {activeTab === "options" ? (
          <OptionsList
            tripId={tripId}
            options={options}
            connectedSegments={connectedSegments as any}
            segments={segments as any}
            segmentTypes={segmentTypes}
            currencies={currencies}
            conversions={conversions}
            tripCurrencyId={tripCurrencyId}
            displayCurrencyId={effectiveDisplayCurrencyId}
            userPreferredOffset={userPreferredOffset}
            isLoading={optionsLoading}
            error={optionsError}
            onEditOption={handleEditOption}
            onRefresh={fetchOptions}
          />
        ) : (
          <SegmentsList
            tripId={tripId}
            segments={segments}
            segmentTypes={segmentTypes}
            currencies={currencies}
            conversions={conversions}
            tripCurrencyId={tripCurrencyId}
            displayCurrencyId={effectiveDisplayCurrencyId}
            userPreferredOffset={userPreferredOffset}
            userPreferredCurrencyId={userPreferredCurrencyId}
            isLoading={segmentsLoading}
            error={segmentsError}
            onEditSegment={handleEditSegment}
            onRefresh={fetchSegments}
          />
        )}
      </div>
    </div>
  )

  const detailPanelContent = (
    <div className="h-full flex flex-col">
      {detailPanel?.type === "option" || (!detailPanel && isDetailModalOpen && activeTab === "options") ? (
        <OptionDetailPanel
          isOpen={isDetailModalOpen}
          onClose={handleCloseDetail}
          onSave={handleSaveOption}
          option={editingOption ?? undefined}
          tripId={tripId}
          tripName={tripName}
          refreshOptions={fetchOptions}
          tripCurrencyId={tripCurrencyId}
          displayCurrencyId={effectiveDisplayCurrencyId}
          currencies={currencies}
          conversions={conversions}
          initialSegmentFilters={initialSegmentFilters}
          initialSegmentSort={null}
        />
      ) : detailPanel?.type === "segment" || (!detailPanel && isDetailModalOpen && activeTab === "segments") ? (
        <SegmentDetailPanel
          isOpen={isDetailModalOpen}
          onClose={handleCloseDetail}
          onSave={handleSaveSegment}
          segment={editingSegment ?? undefined}
          tripId={tripId}
          tripName={tripName}
          segmentTypes={segmentTypes}
          tripCurrencyId={tripCurrencyId}
          displayCurrencyId={effectiveDisplayCurrencyId}
          initialOptionFilters={undefined}
          initialOptionSort={undefined}
          existingLocations={tripLocations}
        />
      ) : null}
    </div>
  )

  return (
    <>
      <TripPanelLayout
        chatPanel={chatPanelContent}
        listPanel={listPanelContent}
        detailPanel={detailPanelContent}
      />

      {/* Mobile: chat renders as a Sheet (column is hidden on mobile) */}
      {panelMode === "mobile" && <ChatPanel />}

      {/* Additional modals */}
      <CombineAllModal
        isOpen={isCombineAllOpen}
        onClose={() => setIsCombineAllOpen(false)}
        onComplete={fetchOptions}
        segments={segments as any}
        segmentTypes={segmentTypes}
        currencies={currencies}
        tripId={tripId}
      />
      <FlightSearch
        isOpen={isFlightSearchOpen}
        onClose={() => setIsFlightSearchOpen(false)}
        tripId={tripId}
        onSegmentCreated={fetchSegments}
      />
      <AccomodationSearch
        isOpen={isAccommodationOpen}
        onClose={() => setIsAccommodationOpen(false)}
        tripId={tripId}
        onSegmentCreated={fetchSegments}
        existingLocations={tripLocations}
      />
    </>
  )
}

// ---- public export ----

export function TripPageContent({ tripId, initialTab }: { tripId: number; initialTab: ActiveTab }) {
  return (
    <TripLayoutProvider initialTab={initialTab}>
      <TripPanelInner tripId={tripId} initialTab={initialTab} />
    </TripLayoutProvider>
  )
}
