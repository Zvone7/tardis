"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { PlusIcon, ListIcon, EditIcon, EyeOffIcon, Loader2Icon, MapPinIcon, MoreVerticalIcon, BedDoubleIcon, PlaneIcon, SlidersHorizontal } from "lucide-react";
import SelectPopupMenu from "../components/SelectPopupMenu";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { Checkbox } from "../components/ui/checkbox";
import SegmentModal from "../segments/SegmentModal";
import BatchLocationModal from "../segments/BatchLocationModal";
import FlightSearch from "../segments/FlightSearch";
import AccomodationSearch from "../segments/AccomodationSearch";
import { formatDateWithUserOffset, formatWeekday } from "../utils/dateformatters";
import { OptionBadge } from "../components/OptionBadge";
import { cn } from "../lib/utils";
import { SegmentFilterPanel, useSegmentFilterHasFilters, type SegmentFilterValue } from "../components/filters/SegmentFilterPanel";
import type { SegmentSortValue } from "../components/sorting/segmentSortTypes";
import { applySegmentFilters, buildSegmentMetadata } from "../services/segmentFiltering";
import { CurrencyDropdown } from "../components/CurrencyDropdown";
import { UtcOffsetDropdown } from "../components/UtcOffsetDropdown";
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
  isSelected?: boolean;
  onToggleSelect?: (segmentId: number) => void;
}) {
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
        isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onEdit(segment)}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center mr-3 mt-1" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect?.(segment.id)}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {segmentType?.iconSvg ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/60 text-secondary-foreground shadow-sm ring-1 ring-black/5 dark:bg-white dark:text-black shrink-0" title={segmentType.name}>
                  <span
                    dangerouslySetInnerHTML={{ __html: segmentType.iconSvg }}
                    className="w-4 h-4"
                    suppressHydrationWarning
                  />
                </span>
              ) : null}
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
            <CardTitle className="text-lg">{segment.name}</CardTitle>

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
  const [filterOpen, setFilterOpen] = useState(false);
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


  const toggleSegmentSelection = useCallback((segmentId: number) => {
    setSelectedSegmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) next.delete(segmentId);
      else next.add(segmentId);
      return next;
    });
  }, []);

  const handleBatchLocationComplete = useCallback(() => {
    setSelectedSegmentIds(new Set());
    fetchSegments();
  }, [fetchSegments]);

  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const handleBatchDelete = useCallback(async () => {
    if (!tripId || selectedSegmentIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedSegmentIds.size} segment(s)? This cannot be undone.`)) return;
    setIsBatchDeleting(true);
    try {
      await segmentsApi.batchDelete(tripId, Array.from(selectedSegmentIds));
      setSelectedSegmentIds(new Set());
      fetchSegments();
    } catch (err) {
      console.error("Batch delete failed:", err);
    } finally {
      setIsBatchDeleting(false);
    }
  }, [tripId, selectedSegmentIds, fetchSegments]);

  const handleBatchSetVisibility = useCallback(async (isVisible: boolean) => {
    if (!tripId || selectedSegmentIds.size === 0) return;
    try {
      await segmentsApi.batchSetVisibility(tripId, Array.from(selectedSegmentIds), isVisible);
      setSelectedSegmentIds(new Set());
      fetchSegments();
    } catch (err) {
      console.error("Batch visibility failed:", err);
    }
  }, [tripId, selectedSegmentIds, fetchSegments]);

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

  const hasActiveFilters = useSegmentFilterHasFilters(filterState, dateBounds.min, dateBounds.max)

  if (!tripId) {
    return <div>No trip ID provided</div>;
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-lg font-semibold">{tripName ? tripName : `Trip ID: ${tripId}`}</CardTitle>
          <CardDescription>Segments</CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => router.push(`/options?tripId=${tripId}`)}>
            <ListIcon className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Options</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Toggle filters"
            onClick={() => setFilterOpen((prev) => !prev)}
            className="relative"
          >
            <SlidersHorizontal
              className={cn("h-4 w-4 transition-transform", filterOpen ? "text-primary rotate-90" : "")}
            />
            {hasActiveFilters ? <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-primary" /> : null}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVerticalIcon className="h-4 w-4" />
              </Button>
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
              <div className="border-t pt-1">
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                  onClick={() => setIsFlightSearchOpen(true)}
                >
                  <PlaneIcon className="h-4 w-4" />
                  Search flights
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                  onClick={() => setIsAccommodationOpen(true)}
                >
                  <BedDoubleIcon className="h-4 w-4" />
                  Search stays
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={handleCreateSegment}>
            <PlusIcon className="h-4 w-4" />
          </Button>
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
          open={filterOpen}
          onOpenChange={setFilterOpen}
        />


        {isLoading ? (
          <LoadingGridSkeleton />
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 mt-2">
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

      <SelectPopupMenu
        selectedCount={selectedSegmentIds.size}
        totalCount={sortedSegments.length}
        onSelectAll={selectAllFiltered}
        onHide={() => handleBatchSetVisibility(false)}
        onShow={() => handleBatchSetVisibility(true)}
        onDelete={handleBatchDelete}
        isDeleting={isBatchDeleting}
        onClear={() => setSelectedSegmentIds(new Set())}
        extraActions={[
          {
            icon: <MapPinIcon className="h-4 w-4" />,
            label: "Update Locations",
            onClick: () => setIsBatchLocationOpen(true),
          },
        ]}
      />
    </Card>
  );
}

function LoadingGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-40 w-full" />
      ))}
    </div>
  );
}
