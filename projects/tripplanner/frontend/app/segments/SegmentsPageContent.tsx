"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { PlusIcon, ListIcon, EditIcon, EyeOffIcon, Loader2Icon, Search, CheckSquareIcon, XIcon, MapPinIcon } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import SegmentModal from "../segments/SegmentModal";
import BatchLocationModal from "../segments/BatchLocationModal";
import FlightSearch from "../segments/FlightSearch";
import AccomodationSearch from "../segments/AccomodationSearch";
import { formatDateWithUserOffset, formatWeekday } from "../utils/dateformatters";
import { OptionBadge } from "../components/OptionBadge";
import { cn } from "../lib/utils";
import { SegmentFilterPanel, type SegmentFilterValue } from "../components/filters/SegmentFilterPanel";
import type { SegmentSortValue } from "../components/sorting/segmentSortTypes";
import { applySegmentFilters, buildSegmentMetadata } from "../services/segmentFiltering";
import { CurrencyDropdown } from "../components/CurrencyDropdown";
import { useCurrencies } from "../hooks/useCurrencies";
import { useCurrencyConversions } from "../hooks/useCurrencyConversions";
import { useCurrentUser } from "../hooks/useCurrentUser";

import type {
  Segment,
  SegmentType,
  OptionRef,
  SegmentSave,
  Currency,
  CurrencyConversion,
  OptionFilterPreset,
  SimpleOptionSortValue,
} from "../types/models";
import { formatCurrencyAmount, convertWithFallback } from "../utils/currency";
import { segmentsApi, tripsApi } from "../utils/apiClient";
import { useChatContext } from "../chat/ChatProvider";

const getLocationLabel = (loc: any | null) => {
  if (!loc) return "";
  const name = loc.name ?? "";
  const country = loc.country ?? "";
  const label = country ? `${name}, ${country}` : name;
  return label;
};

const formatSegmentDateWithWeekday = (iso: string, offset: number) => {
  const weekday = formatWeekday(iso, offset);
  return `${weekday}, ${formatDateWithUserOffset(iso, offset)}`;
};

/* ------------------------- Card Component ------------------------- */

function SegmentCard({
  segment,
  segmentType,
  userPreferredOffset,
  onEdit,
  connectedOptions,
  isLoadingConnections,
  showVisibilityIndicator,
  displayCurrencyId,
  tripCurrencyId,
  currencies,
  conversions,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: {
  segment: Segment;
  segmentType: SegmentType | undefined;
  userPreferredOffset: number;
  onEdit: (segment: Segment) => void;
  connectedOptions: OptionRef[];
  isLoadingConnections: boolean;
  showVisibilityIndicator: boolean;
  displayCurrencyId: number | null;
  tripCurrencyId: number | null;
  currencies: Currency[];
  conversions: CurrencyConversion[];
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (segmentId: number) => void;
}) {
  const getTimezoneDisplayText = () =>
    userPreferredOffset === 0 ? "UTC" : `UTC${userPreferredOffset >= 0 ? "+" : ""}${userPreferredOffset}`;

  // location can arrive as startLocation/StartLocation or endLocation/EndLocation
  const startLoc = (segment as any).startLocation ?? null;
  const endLoc = (segment as any).endLocation ?? null;

  const isHidden = segment.isUiVisible === false;
  const numericCost = Number(segment.cost ?? 0)
  const desiredCurrencyId = displayCurrencyId ?? tripCurrencyId ?? segment.currencyId ?? null
  const primaryDisplay = convertWithFallback({
    amount: numericCost,
    fromCurrencyId: segment.currencyId ?? null,
    toCurrencyId: desiredCurrencyId,
    conversions,
  })
  const primaryLabel = formatCurrencyAmount(primaryDisplay.amount, primaryDisplay.currencyId, currencies)
  const originalLabel = formatCurrencyAmount(numericCost, segment.currencyId, currencies)
  const showOriginalCost =
    displayCurrencyId !== null &&
    segment.currencyId !== null &&
    segment.currencyId !== undefined &&
    segment.currencyId !== displayCurrencyId

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-all duration-200 ease-in-out hover:-translate-y-0.5",
        isHidden && "bg-muted text-muted-foreground border-muted-foreground/40",
        selectionMode && isSelected && "ring-2 ring-primary"
      )}
      onClick={() => {
        if (selectionMode && onToggleSelect) {
          onToggleSelect(segment.id);
        } else {
          onEdit(segment);
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          {selectionMode && (
            <div className="flex items-center mr-3 mt-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect?.(segment.id)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              {segmentType && (
                <>
                  {segmentType.iconSvg ? (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/60 text-secondary-foreground shadow-sm ring-1 ring-black/5 dark:bg-white dark:text-black">
                      <span
                        dangerouslySetInnerHTML={{ __html: segmentType.iconSvg }}
                        className="w-4 h-4"
                        suppressHydrationWarning
                      />
                    </span>
                  ) : null}
                  <span className="text-sm text-muted-foreground">{segmentType.name}</span>
                </>
              )}
            </div>
            <CardTitle className="text-lg">{segment.name}</CardTitle>

            <div className="mt-2 flex flex-wrap gap-1">
              {isLoadingConnections ? (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2Icon className="h-3 w-3 animate-spin" />
                  Loading options…
                </span>
              ) : connectedOptions?.length ? (
                connectedOptions.map((option) => {
                  const optionHidden = (option as any)?.isUiVisible === false;
                  return (
                    <OptionBadge
                      key={option.id}
                      id={option.id}
                      name={option.name}
                      isHidden={showVisibilityIndicator && optionHidden}
                    />
                  );
                })
              ) : (
                <span className="text-xs text-muted-foreground">No connected options</span>
              )}
            </div>

            <div className="mt-2 text-sm text-muted-foreground space-y-1">
              <div className="space-y-1">
                <div>
                  {formatSegmentDateWithWeekday(segment.startDateTimeUtc, userPreferredOffset)}
                  {startLoc ? ` (${getLocationLabel(startLoc)})` : ""}
                </div>
                <div>
                  {formatSegmentDateWithWeekday(segment.endDateTimeUtc, userPreferredOffset)}
                  {endLoc ? ` (${getLocationLabel(endLoc)})` : ""}
                </div>
                <div className="font-medium text-foreground">
                  {primaryLabel}
                  {showOriginalCost ? (
                    <span className="ml-2 text-xs text-muted-foreground">({originalLabel})</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">Times shown in {getTimezoneDisplayText()}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            {showVisibilityIndicator && isHidden && (
              <div
                className="rounded-full border p-1 bg-muted-foreground/20 text-muted-foreground"
                title="Hidden from UI"
                aria-label="Hidden from UI"
              >
                <EyeOffIcon className="h-5 w-5" />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(segment);
              }}
            >
              <EditIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}


/* ----------------------------------- Page ----------------------------------- */

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentTypes, setSegmentTypes] = useState<SegmentType[]>([]);
  const [userPreferredOffset, setUserPreferredOffset] = useState<number>(0);
  const [userPreferredCurrencyId, setUserPreferredCurrencyId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFlightSearchOpen, setIsFlightSearchOpen] = useState(false);
  const [isAccommodationOpen, setIsAccommodationOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<number>>(new Set());
  const [isBatchLocationOpen, setIsBatchLocationOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null | undefined>(null);
  const [tripName, setTripName] = useState<string>("");
  const [tripCurrencyId, setTripCurrencyId] = useState<number | null>(null);
  const [displayCurrencyId, setDisplayCurrencyId] = useState<number | null>(null);
  const [connectedBySegment, setConnectedBySegment] = useState<Record<number, OptionRef[]>>({});
  const [connectionsLoading, setConnectionsLoading] = useState<Record<number, boolean>>({});
  const [filterState, setFilterState] = useState<SegmentFilterValue>({
    locations: [],
    types: [],
    dateRange: { start: "", end: "" },
    showHidden: false,
  });
  const [sortState, setSortState] = useState<SegmentSortValue | null>(null);
  const { currencies, isLoading: isLoadingCurrencies } = useCurrencies();
  const { conversions } = useCurrencyConversions();
  const { user } = useCurrentUser();

  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");
  const router = useRouter();

  const fetchTripName = useCallback(async () => {
    if (!tripId) return;
    try {
      const data = await tripsApi.getById(tripId);
      setTripName(data.name);
      setTripCurrencyId(data.currencyId ?? null);
    } catch (err) {
      console.error("Error fetching trip details:", err);
      setTripName("Unknown Trip");
      setTripCurrencyId(null);
    }
  }, [tripId]);

  const fetchSegmentTypes = useCallback(async () => {
    try {
      const data = await segmentsApi.getTypes();
      setSegmentTypes(data);
    } catch (err) {
      console.error("Error fetching segment types:", err);
      setError("An error occurred while fetching segment types");
    }
  }, []);

  const fetchSegments = useCallback(async () => {
    if (!tripId) return;
    setIsLoading(true);
    try {
      const data = await segmentsApi.getByTripId(tripId);
      setSegments(data);
    } catch (err) {
      setError("An error occurred while fetching segments");
      console.error("Error fetching segments:", err);
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  // After segments load, fetch their connected options in parallel
  useEffect(() => {
    if (!segments.length || !tripId) {
      setConnectionsLoading({})
      if (!segments.length) setConnectedBySegment({})
      return
    }

    let cancelled = false;
    const loadingFlags: Record<number, boolean> = {};
    segments.forEach((segment) => {
      loadingFlags[segment.id] = true;
    });
    setConnectionsLoading(loadingFlags);

    const fetches = segments.map(async (seg) => {
      try {
        const options = await segmentsApi.getConnectedOptions(tripId, seg.id);
        if (cancelled) return;
        setConnectedBySegment((prev) => ({ ...prev, [seg.id]: options }));
      } catch (err) {
        if (!cancelled) console.warn("Connected options fetch failed:", err);
      } finally {
        if (cancelled) return;
        setConnectionsLoading((prev) => {
          const next = { ...prev };
          delete next[seg.id];
          return next;
        });
      }
    });

    void Promise.allSettled(fetches);

    return () => {
      cancelled = true;
    };
  }, [segments, tripId]);

  useEffect(() => {
    fetchTripName();
    fetchSegmentTypes();
    fetchSegments();
  }, [fetchTripName, fetchSegmentTypes, fetchSegments]);

  // Chat assistant integration
  const chatContext = useChatContext();
  useEffect(() => {
    if (tripId) chatContext.setTrip(Number(tripId), tripName);
    return () => chatContext.setTrip(null, null);
  }, [tripId, tripName]);
  useEffect(() => {
    return chatContext.registerRefreshCallback(fetchSegments);
  }, [chatContext.registerRefreshCallback, fetchSegments]);

  useEffect(() => {
    if (!user) return;
    setUserPreferredOffset(user.userPreference?.preferredUtcOffset ?? 0);
    setUserPreferredCurrencyId(user.userPreference?.preferredCurrencyId ?? null);
  }, [user]);

  useEffect(() => {
    if (displayCurrencyId !== null) return;
    if (tripCurrencyId) {
      setDisplayCurrencyId(tripCurrencyId);
      return;
    }
    if (userPreferredCurrencyId) {
      setDisplayCurrencyId(userPreferredCurrencyId);
    }
  }, [displayCurrencyId, tripCurrencyId, userPreferredCurrencyId]);

  const handleEditSegment = (segment: Segment) => {
    setEditingSegment(segment);
    setIsModalOpen(true);
  };

  const handleCreateSegment = () => {
    setEditingSegment(null);
    setIsModalOpen(true);
  };

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedSegmentIds(new Set());
      return !prev;
    });
  }, []);

  const toggleSegmentSelection = useCallback((segmentId: number) => {
    setSelectedSegmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) next.delete(segmentId);
      else next.add(segmentId);
      return next;
    });
  }, []);

  const handleBatchLocationComplete = useCallback(() => {
    setSelectionMode(false);
    setSelectedSegmentIds(new Set());
    fetchSegments();
  }, [fetchSegments]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSegment(null);
  };

  const handleSaveSegment = async (
    segmentData: SegmentSave,
    isUpdate: boolean,
    originalSegmentId?: number
  ) => {
    try {
      if (!tripId) throw new Error("Missing trip context");
      if (isUpdate && originalSegmentId) {
        await segmentsApi.update(tripId, { ...segmentData, id: originalSegmentId });
      } else {
        await segmentsApi.create(tripId, segmentData);
      }
      handleCloseModal();
      await fetchSegments();
    } catch (err) {
      console.error("Error saving segment:", err);
      setError("An error occurred while saving the segment");
    }
  };

  const availableLocations = useMemo(() => {
    const labels = new Set<string>()
    segments.forEach((segment) => {
      const startLoc = (segment as any).startLocation ?? null
      const endLoc = (segment as any).endLocation ?? null
      const startLabel = getLocationLabel(startLoc)
      const endLabel = getLocationLabel(endLoc)
      if (startLabel) labels.add(startLabel)
      if (endLabel) labels.add(endLabel)
    })
    return Array.from(labels)
  }, [segments])

  const availableSegmentTypes = useMemo(() => {
    const ids = new Set<number>()
    segments.forEach((segment) => ids.add(segment.segmentTypeId))
    return segmentTypes.filter((type) => ids.has(type.id))
  }, [segments, segmentTypes])

  const dateBounds = useMemo(() => {
    if (!segments.length) return { min: "", max: "" }
    let min: number | null = null
    let max: number | null = null
    segments.forEach((segment) => {
      const start = new Date(segment.startDateTimeUtc).getTime()
      const end = new Date(segment.endDateTimeUtc).getTime()
      if (!Number.isNaN(start)) min = min === null ? start : Math.min(min, start)
      if (!Number.isNaN(end)) max = max === null ? end : Math.max(max, end)
    })
    return {
      min: min !== null ? new Date(min).toISOString().split("T")[0] : "",
      max: max !== null ? new Date(max).toISOString().split("T")[0] : "",
    }
  }, [segments])

  const effectiveDisplayCurrencyId = displayCurrencyId ?? tripCurrencyId ?? userPreferredCurrencyId ?? null
  const selectedCurrencyMeta = useMemo(
    () => currencies.find((c) => c.id === effectiveDisplayCurrencyId) ?? null,
    [currencies, effectiveDisplayCurrencyId],
  )
  const tripCurrencyMeta = useMemo(
    () => currencies.find((c) => c.id === (tripCurrencyId ?? undefined)) ?? null,
    [currencies, tripCurrencyId],
  )

  const filteredSegments = useMemo(() => {
    return applySegmentFilters(segments, filterState, sortState, segmentTypes, {
      targetCurrencyId: effectiveDisplayCurrencyId,
      fallbackCurrencyId: tripCurrencyId ?? userPreferredCurrencyId ?? null,
      currencies,
      conversions,
    })
  }, [
    segments,
    filterState,
    sortState,
    segmentTypes,
    effectiveDisplayCurrencyId,
    tripCurrencyId,
    userPreferredCurrencyId,
    currencies,
    conversions,
  ])

  const sortedSegments = filteredSegments

  const selectAllFiltered = useCallback(() => {
    setSelectedSegmentIds(new Set(sortedSegments.map((s) => s.id)));
  }, [sortedSegments]);

  const optionModalFilters = useMemo<OptionFilterPreset>(
    () => ({
      locations: [...filterState.locations],
      dateRange: { ...filterState.dateRange },
      showHidden: filterState.showHidden,
    }),
    [filterState],
  )

  const optionModalSort = useMemo<SimpleOptionSortValue | null>(() => {
    if (!sortState) return null
    if (sortState.field === "startDate" || sortState.field === "endDate") {
      return { field: sortState.field, direction: sortState.direction }
    }
    return null
  }, [sortState])

  if (!tripId) {
    return <div>No trip ID provided</div>;
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Segments</CardTitle>
          <CardDescription>{tripName ? tripName : `Trip ID: ${tripId}`}</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => router.push(`/options?tripId=${tripId}`)}>
              <ListIcon className="mr-2 h-4 w-4" />
              View Options
            </Button>
            <Button
              variant={selectionMode ? "default" : "outline"}
              onClick={toggleSelectionMode}
            >
              {selectionMode ? (
                <>
                  <XIcon className="mr-2 h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <CheckSquareIcon className="mr-2 h-4 w-4" />
                  Select
                </>
              )}
            </Button>
            {!selectionMode && (
              <Button onClick={handleCreateSegment}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" className="text-muted-foreground" onClick={() => setIsFlightSearchOpen(true)}>
              <Search className="mr-2 h-4 w-4" />
              Search flights
            </Button>
            <Button variant="outline" className="text-muted-foreground" onClick={() => setIsAccommodationOpen(true)}>
              <Search className="mr-2 h-4 w-4" />
              Search stays
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <SegmentFilterPanel
          value={filterState}
          onChange={setFilterState}
          sort={sortState}
          onSortChange={setSortState}
          availableLocations={availableLocations}
          availableTypes={availableSegmentTypes}
          minDate={dateBounds.min}
          maxDate={dateBounds.max}
          toolbarAddon={
            <CurrencyDropdown
              value={effectiveDisplayCurrencyId}
              onChange={setDisplayCurrencyId}
              currencies={currencies}
              placeholder={isLoadingCurrencies ? "Loading currencies..." : "Display currency"}
              disabled={isLoadingCurrencies}
              className="w-full sm:w-[150px] text-sm"
              triggerClassName="w-full h-9 text-sm px-3"
            />
          }
        />

        {isLoading ? (
          <LoadingGridSkeleton />
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {sortedSegments.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full text-center">No segments to display.</p>
            ) : (
              sortedSegments.map((segment) => {
                const segmentType = segmentTypes.find((st) => st.id === segment.segmentTypeId)
                const connected = connectedBySegment[segment.id] || []
                return (
                  <SegmentCard
                    key={segment.id}
                    segment={segment}
                    segmentType={segmentType}
                    userPreferredOffset={userPreferredOffset}
                    onEdit={handleEditSegment}
                    connectedOptions={connected}
                    isLoadingConnections={Boolean(connectionsLoading[segment.id])}
                    showVisibilityIndicator={filterState.showHidden}
                    displayCurrencyId={effectiveDisplayCurrencyId}
                    tripCurrencyId={tripCurrencyId}
                    currencies={currencies}
                    conversions={conversions}
                    selectionMode={selectionMode}
                    isSelected={selectedSegmentIds.has(segment.id)}
                    onToggleSelect={toggleSegmentSelection}
                  />
                )
              })
            )}
          </div>
        )}
      </CardContent>

      <SegmentModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveSegment}
        segment={editingSegment}
        tripId={Number(tripId)}
        segmentTypes={segmentTypes}
        tripCurrencyId={tripCurrencyId}
        displayCurrencyId={effectiveDisplayCurrencyId}
        initialOptionFilters={optionModalFilters}
        initialOptionSort={optionModalSort}
      />
      <FlightSearch
        isOpen={isFlightSearchOpen}
        onClose={() => setIsFlightSearchOpen(false)}
        tripId={Number(tripId)}
        tripCurrencyId={tripCurrencyId}
        onSegmentCreated={fetchSegments}
        segments={segments}
        onViewSegment={handleEditSegment}
        planeIconSvg={segmentTypes.find((type) => type.id === 1)?.iconSvg ?? null}
      />
      <AccomodationSearch
        isOpen={isAccommodationOpen}
        onClose={() => setIsAccommodationOpen(false)}
        tripId={Number(tripId)}
        tripCurrencyId={tripCurrencyId}
        onSegmentCreated={fetchSegments}
      />
      <BatchLocationModal
        isOpen={isBatchLocationOpen}
        onClose={() => setIsBatchLocationOpen(false)}
        onComplete={handleBatchLocationComplete}
        selectedSegmentIds={Array.from(selectedSegmentIds)}
        tripId={Number(tripId)}
      />

      {/* Floating action bar for selection mode */}
      {selectionMode && selectedSegmentIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
          <span className="text-sm font-medium">{selectedSegmentIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={selectAllFiltered}>
            Select all ({sortedSegments.length})
          </Button>
          <Button size="sm" onClick={() => setIsBatchLocationOpen(true)}>
            <MapPinIcon className="mr-2 h-4 w-4" />
            Update Locations
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedSegmentIds(new Set())}>
            Clear
          </Button>
        </div>
      )}
    </Card>
  );
}

function LoadingGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-40 w-full" />
      ))}
    </div>
  );
}
