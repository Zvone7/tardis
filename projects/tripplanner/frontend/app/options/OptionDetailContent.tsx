// OptionDetailContent.tsx
// Contains all state and UI for viewing/editing an option.
// Can be hosted inside a Dialog (OptionModal) or an inline panel (OptionDetailPanel).
"use client";

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";
import { toast } from "../components/ui/use-toast";
import { Collapsible } from "../components/Collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { SaveIcon, Trash2Icon, EyeOffIcon, EyeIcon, LayersIcon, Loader2, LayoutListIcon, CalendarRangeIcon, MapPinIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { SegmentSelectCard } from "../components/SegmentSelectCard";
import type { SegmentType, SegmentApi, OptionApi, OptionSave, Currency, CurrencyConversion, Segment } from "../types/models";
import { TitleTokens } from "../components/TitleTokens";
import {
  buildOptionTitleTokens,
  buildSegmentTitleTokens,
  buildSegmentConfigFromApi,
  summarizeSegmentsForOption,
  tokensToLabel,
} from "../utils/formatters";
import { formatCurrencyAmount, formatConvertedAmount } from "../utils/currency";
import { optionsApi } from "../utils/apiClient";
import { SegmentFilterPanel, type SegmentFilterValue } from "../components/filters/SegmentFilterPanel"
import type { SegmentSortValue } from "../components/sorting/segmentSortTypes"
import { applySegmentFilters, buildSegmentMetadata } from "../services/segmentFiltering"
import { useStageBuilder } from "../hooks/useStageBuilder"
import { SegmentTimeline } from "../components/timeline/SegmentTimeline"
import { TimelineSegmentCard } from "../components/timeline/TimelineSegmentCard"
import { useTripLayout } from "../trip/[tripId]/TripLayoutContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { locationKeyOf } from "../lib/tripLocations"
import { ItineraryView } from "../components/itinerary/ItineraryView"

const arraysEqual = (a: number[], b: number[]) => a.length === b.length && a.every((val, idx) => val === b[idx])
type DiagramSegment = SegmentApi & { segmentType: SegmentType }

export interface OptionDetailContentProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (option: OptionSave) => Promise<void> | void;
  option?: OptionApi | null;
  tripId: number;
  tripName?: string;
  refreshOptions: () => void;
  onConnectedSegmentsUpdated?: (optionId: number) => void;
  tripCurrencyId: number | null;
  displayCurrencyId: number | null;
  currencies: Currency[];
  conversions: CurrencyConversion[];
  segments: SegmentApi[];
  segmentTypes: SegmentType[];
  segmentsLoading?: boolean;
  initialSegmentFilters?: SegmentFilterValue;
  initialSegmentSort?: SegmentSortValue | null;
}

export interface OptionDetailContentHandle {
  /** Triggers the close flow (shows unsaved-changes prompt if needed). */
  requestClose: () => void;
}

export const OptionDetailContent = forwardRef<OptionDetailContentHandle, OptionDetailContentProps>(
  function OptionDetailContent({
    isOpen,
    onClose,
    onSave,
    option,
    tripId,
    tripName,
    refreshOptions,
    onConnectedSegmentsUpdated,
    tripCurrencyId,
    displayCurrencyId,
    currencies,
    conversions,
    segments,
    segmentTypes,
    segmentsLoading: segmentsLoadingProp = false,
    initialSegmentFilters,
    initialSegmentSort,
  }, ref) {
  const [name, setName] = useState("");
  const [selectedSegments, setSelectedSegments] = useState<number[]>([]);
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [baselineReady, setBaselineReady] = useState(!option);
  const [isSaving, setIsSaving] = useState(false);
  const [generalOpen, setGeneralOpen] = useState(!option)
  const [connectionsOpen, setConnectionsOpen] = useState(Boolean(option))
  const optionBaselineRef = useRef<{ name: string; isUiVisible: boolean } | null>(
    option ? { name: option.name ?? "", isUiVisible: option.isUiVisible ?? true } : null,
  );
  const initialSelectedSegmentsRef = useRef<number[] | null>(null);
  const [baselineVersion, setBaselineVersion] = useState(0);
  const [segmentFilterState, setSegmentFilterState] = useState<SegmentFilterValue>({
    locations: null,
    types: null,
    dateRange: { start: "", end: "" },
    costMin: null,
    costMax: null,
    showHidden: false,
  })
  const [segmentSortState, setSegmentSortState] = useState<SegmentSortValue | null>(null)
  const [segmentViewMode, setSegmentViewMode] = useState<"timeline" | "list">("timeline")
  const [viewMode, setViewMode] = useState<"edit" | "itinerary">("itinerary")
  const [listCardSegmentId, setListCardSegmentId] = useState<number | null>(null)
  const [listCardAnchorEl, setListCardAnchorEl] = useState<HTMLDivElement | null>(null)
  const listCardHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolvedDisplayCurrencyId = displayCurrencyId ?? tripCurrencyId ?? null;

  const stageBuilder = useStageBuilder(segments, selectedSegments)
  const { panelMode, openSegmentDetail } = useTripLayout()
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false)
  const skipClosePromptRef = useRef(false)

  const formatSegmentCost = useCallback(
    (segment: SegmentApi) => {
      if (segment.cost === null || segment.cost === undefined) return null
      return (
        formatConvertedAmount({
          amount: segment.cost,
          fromCurrencyId: segment.currencyId ?? tripCurrencyId ?? null,
          toCurrencyId: resolvedDisplayCurrencyId,
          currencies,
          conversions,
        }) ?? formatCurrencyAmount(segment.cost, segment.currencyId ?? tripCurrencyId ?? null, currencies)
      )
    },
    [tripCurrencyId, resolvedDisplayCurrencyId, currencies, conversions],
  )

  const segmentsLoading = segmentsLoadingProp

  const fetchConnectedSegments = useCallback(
    async (optionId: number) => {
      try {
        const data = await optionsApi.getConnectedSegments(tripId, optionId);
        const ids = data.map((segment) => segment.id);
        setSelectedSegments(ids);
        initialSelectedSegmentsRef.current = [...ids].sort((a, b) => a - b);
        setBaselineReady(true);
        // Only switch to edit once we know for sure there are no segments
        if (ids.length === 0) setViewMode("edit");
      } catch (error) {
        console.error("Error fetching connected segments:", error);
        toast({ title: "Error", description: "Failed to fetch connected segments. Please try again." });
        setBaselineReady(true);
      }
    },
    [tripId],
  );

  useEffect(() => {
    if (option) {
      optionBaselineRef.current = { name: option.name ?? "", isUiVisible: option.isUiVisible ?? true };
      setBaselineReady(false);
      initialSelectedSegmentsRef.current = null;
      setName(option.name);
      setIsUiVisible(option.isUiVisible ?? true);
      void fetchConnectedSegments(option.id);
    } else {
      setGeneralOpen(true)
      setConnectionsOpen(false)
      optionBaselineRef.current = null;
      initialSelectedSegmentsRef.current = null;
      setBaselineReady(true);
      setName("");
      setSelectedSegments([]);
      setIsUiVisible(true);
    }
    setViewMode(option ? "itinerary" : "edit")
  }, [option, fetchConnectedSegments]);


  useEffect(() => {
    if (option) {
      setGeneralOpen(false)
      setConnectionsOpen(true)
    } else {
      setGeneralOpen(true)
      setConnectionsOpen(false)
    }
  }, [option])

  const latestInitialFiltersRef = useRef<SegmentFilterValue | undefined>(initialSegmentFilters)
  const latestInitialSortRef = useRef<SegmentSortValue | null | undefined>(initialSegmentSort)
  useEffect(() => {
    latestInitialFiltersRef.current = initialSegmentFilters
  }, [initialSegmentFilters])
  useEffect(() => {
    latestInitialSortRef.current = initialSegmentSort
  }, [initialSegmentSort])

  const prevOpenRef = useRef<boolean>(isOpen)
  const prevOptionIdRef = useRef<number | null>(option?.id ?? null)
  useEffect(() => {
    const wasOpen = prevOpenRef.current
    const prevOptionId = prevOptionIdRef.current
    prevOpenRef.current = isOpen
    prevOptionIdRef.current = option?.id ?? null
    const justOpened = isOpen && !wasOpen
    const optionChanged = isOpen && prevOptionId !== (option?.id ?? null)
    if (!justOpened && !optionChanged) return
    const initialFilters = latestInitialFiltersRef.current
    if (initialFilters) {
      setSegmentFilterState({
        locations: initialFilters.locations === null ? null : [...initialFilters.locations],
        types: initialFilters.types === null ? null : [...initialFilters.types],
        dateRange: { ...initialFilters.dateRange },
        costMin: initialFilters.costMin ?? null,
        costMax: initialFilters.costMax ?? null,
        showHidden: initialFilters.showHidden,
      })
    } else {
      setSegmentFilterState({
        locations: null,
        types: null,
        dateRange: { start: "", end: "" },
        costMin: null,
        costMax: null,
        showHidden: false,
      })
    }
    const initialSortValue = latestInitialSortRef.current
    if (typeof initialSortValue !== "undefined") {
      setSegmentSortState(initialSortValue ?? null)
    } else {
      setSegmentSortState(null)
    }
  }, [isOpen, option?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaveDisabled || isSaving) return;

    const payload: OptionSave = {
      name,
      startDateTimeUtc: null,
      endDateTimeUtc: null,
      tripId,
      costPerDay: 0,
      costPerType: {},
      isUiVisible,
    };

    setIsSaving(true)
    try {
      await onSave(payload);

      if (option) {
        await handleUpdateConnectedSegments();
      } else {
        handleClose();
      }
    } catch (error) {
      console.error("Error saving option:", error)
      toast({ title: "Error", description: "Failed to save option. Please try again." })
    } finally {
      setIsSaving(false)
    }
  };

  const handleUpdateConnectedSegments = async () => {
    if (!option) return;

    try {
      await optionsApi.updateConnectedSegments(tripId, option.id, selectedSegments);

      // Reset baseline so save button disables until new changes are made
      const sorted = [...selectedSegments].sort((a, b) => a - b)
      initialSelectedSegmentsRef.current = sorted
      setBaselineVersion((v) => v + 1)

      toast({ title: "Saved", description: "Connected segments updated." });
      onConnectedSegmentsUpdated?.(option.id)
      refreshOptions();
      // Panel stays open — user closes manually when done adding segments
    } catch (error) {
      console.error("Error updating connected segments:", error);
      toast({ title: "Error", description: "Failed to update connected segments. Please try again." });
    }
  };

  const handleSegmentCheckedChange = (segmentId: number, checkedState: boolean | "indeterminate") => {
    const checked = checkedState === true;
    setSelectedSegments((prev) => {
      if (checked) return prev.includes(segmentId) ? prev : [...prev, segmentId];
      return prev.includes(segmentId) ? prev.filter((id) => id !== segmentId) : prev;
    });
  };

  // Used by list-view card toggle
  const handleAutoSaveSegment = useCallback(
    (segmentId: number, checked: boolean) => {
      handleSegmentCheckedChange(segmentId, checked)
    },
    [handleSegmentCheckedChange],
  )

  // Used by timeline card toggle — also updates stageBuilder
  const handleTimelineToggleSegment = useCallback(
    (segmentId: number, checked: boolean) => {
      const seg = segments.find((x) => x.id === segmentId)
      const key = seg ? locationKeyOf(seg.startLocation) : null
      const stageIndex = key
        ? Math.max(0, stageBuilder.stages.findIndex((s) => s.location.key === key))
        : 0
      const newIds = stageBuilder.toggleSegment(segmentId, checked, stageIndex)
      setSelectedSegments(newIds)
    },
    [segments, stageBuilder],
  )

  const closeModal = useCallback(() => {
    skipClosePromptRef.current = true
    onClose()
  }, [onClose])

  const handleClose = () => {
    closeModal()
  }

  const isEditing = Boolean(option);

  const hasChanges = useMemo(() => {
    if (!isEditing) return true;
    if (!baselineReady) return false;
    const baseline = optionBaselineRef.current;
    const baselineSegments = initialSelectedSegmentsRef.current;
    if (!baseline || baselineSegments === null) return false;
    if (baseline.name !== name) return true;
    if (baseline.isUiVisible !== isUiVisible) return true;
    const sortedCurrent = [...selectedSegments].sort((a, b) => a - b);
    if (!arraysEqual(sortedCurrent, baselineSegments)) return true;
    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, baselineReady, baselineVersion, name, isUiVisible, selectedSegments]);

  const createFormTouched = useMemo(() => {
    if (isEditing) return false
    return Boolean(
      (name && name.trim()) ||
        selectedSegments.length > 0 ||
        isUiVisible === false,
    )
  }, [isEditing, name, selectedSegments.length, isUiVisible])

  const shouldPromptOnClose = isEditing ? hasChanges : createFormTouched

  const isSaveDisabled = isEditing ? !hasChanges : false;

  const requestClose = useCallback(() => {
    if (skipClosePromptRef.current) {
      skipClosePromptRef.current = false
      return
    }
    if (shouldPromptOnClose) {
      setShowUnsavedConfirm(true)
    } else {
      closeModal()
    }
  }, [shouldPromptOnClose, closeModal])

  useImperativeHandle(ref, () => ({ requestClose }), [requestClose])

  const handleDelete = async () => {
    if (!option) return;
    try {
      await optionsApi.remove(tripId, option.id);
      toast({ title: "Deleted", description: `"${option.name}" has been removed.` });
      setShowDeleteConfirm(false);
      refreshOptions();
      handleClose();
    } catch (error) {
      console.error("Error deleting option:", error);
      toast({ title: "Error", description: "Failed to delete option. Please try again." });
    }
  };

  const formatSegmentDateWithWeekday = useCallback((iso?: string | null) => {
    if (!iso) return "N/A"
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return "N/A"
    const weekday = date.toLocaleDateString(undefined, { weekday: "short" })
    const dayMonth = date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    const timeLabel = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    return `${weekday}, ${dayMonth} · ${timeLabel}`
  }, [])

  const segmentFilterMetadata = useMemo(() => {
    return buildSegmentMetadata((segments as Segment[]) ?? [], segmentTypes)
  }, [segments, segmentTypes])

  const filteredSegmentsForDisplay = useMemo(() => {
    if (!option) return []
    const filtered = applySegmentFilters(
      segments as Segment[],
      segmentFilterState,
      segmentSortState,
      segmentTypes,
      {
        targetCurrencyId: displayCurrencyId ?? tripCurrencyId ?? null,
        fallbackCurrencyId: tripCurrencyId ?? null,
        currencies,
        conversions,
      },
    )
    const selectedSet = new Set(selectedSegments)
    return [...filtered].sort((a, b) => {
      const aSelected = selectedSet.has(a.id) ? 0 : 1
      const bSelected = selectedSet.has(b.id) ? 0 : 1
      return aSelected - bSelected
    })
  }, [
    option,
    segments,
    segmentFilterState,
    segmentSortState,
    segmentTypes,
    displayCurrencyId,
    tripCurrencyId,
    currencies,
    conversions,
    selectedSegments,
  ])

  const selectedSegmentsCount = selectedSegments.length

  const selectedSegmentEntities = useMemo(() => {
    if (selectedSegmentsCount === 0) return [];
    const byId = new Map<number, SegmentApi>();
    segments.forEach((segment) => byId.set(segment.id, segment));
    return selectedSegments
      .map((id) => byId.get(id))
      .filter((segment): segment is SegmentApi => Boolean(segment));
  }, [segments, selectedSegments, selectedSegmentsCount]);

  const selectedConnectedSegments = useMemo(() => {
    return selectedSegmentEntities
      .map((segment) => {
        const segmentType = segmentTypes.find((st) => st.id === segment.segmentTypeId)
        if (!segmentType) return null
        return { ...segment, segmentType }
      })
      .filter((segment): segment is DiagramSegment => Boolean(segment))
  }, [selectedSegmentEntities, segmentTypes])

  const optionTitleTokens = useMemo(() => {
    const derived = summarizeSegmentsForOption(selectedSegmentEntities, {
      targetCurrencyId: displayCurrencyId ?? tripCurrencyId ?? null,
      fallbackCurrencyId: tripCurrencyId ?? null,
      conversions,
    });
    const typeCounts = new Map<string, number>()
    selectedConnectedSegments.forEach((seg) => {
      const typeName = seg.segmentType.name
      typeCounts.set(typeName, (typeCounts.get(typeName) ?? 0) + 1)
    })
    const segmentLabel = typeCounts.size > 0
      ? Array.from(typeCounts.entries()).map(([typeName, count]) => `${count} ${typeName}`).join(", ")
      : null
    const resolvedCurrencyId = displayCurrencyId ?? tripCurrencyId ?? null
    const currencyLabel = resolvedCurrencyId
      ? (currencies.find((c) => c.id === resolvedCurrencyId)?.shortName ?? null)
      : null
    return buildOptionTitleTokens({
      name,
      fallbackName: option?.name || "New option",
      segmentCount: derived.segmentCount ?? null,
      segmentLabel,
      startLocationLabel: derived.startLocationLabel ?? undefined,
      endLocationLabel: derived.endLocationLabel ?? undefined,
      startDateIso: derived.startDateIso ?? option?.startDateTimeUtc ?? null,
      endDateIso: derived.endDateIso ?? option?.endDateTimeUtc ?? null,
      startOffset: derived.startOffset ?? (option ? 0 : null),
      endOffset: derived.endOffset ?? (option ? 0 : null),
      totalCost: derived.totalCost ?? option?.totalCost ?? null,
      currencyLabel,
    });
  }, [name, option, selectedSegmentEntities, selectedConnectedSegments, displayCurrencyId, tripCurrencyId, conversions, currencies]);

  const headerTitle = option?.name?.trim() ? option.name.trim() : (tripName || "New option")
  const headerSubtitle = option ? "Editing existing option" : "Creating new option"

  const generalSummaryTitle = useMemo(() => {
    return (
      <div className="flex flex-col gap-1 text-left">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          General
        </span>
        {optionTitleTokens.length ? (
          <TitleTokens tokens={optionTitleTokens} size="sm" />
        ) : (
            <span className="text-sm text-muted-foreground">Add name to identify this option</span>
          )}
      </div>
    )
  }, [optionTitleTokens])

  const connectedSummaryTitle = useMemo(() => {
    let summaryText: string
    if (selectedSegmentsCount === 0) {
      summaryText = "No segments linked"
    } else {
      const typeCounts = new Map<string, number>()
      selectedConnectedSegments.forEach((seg) => {
        const typeName = seg.segmentType.name
        typeCounts.set(typeName, (typeCounts.get(typeName) ?? 0) + 1)
      })
      summaryText = Array.from(typeCounts.entries())
        .map(([typeName, count]) => `${count} ${typeName}`)
        .join(", ")
    }
    return (
      <div className="flex flex-col gap-1 text-left">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Connected segments
        </span>
        <span className="text-sm font-medium text-foreground">
          {summaryText}
        </span>
      </div>
    )
  }, [selectedSegmentsCount, selectedConnectedSegments])

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="border-b bg-background px-4 py-3 pr-10">
          <div className="mb-3 space-y-1">
            <div className="flex items-center gap-2 text-lg font-semibold leading-snug">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary/50 text-secondary-foreground shadow-sm">
                <LayersIcon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>{headerTitle}</span>
            </div>
            <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {isEditing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Delete option"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              ) : (
                <span className="h-9 w-9" aria-hidden />
              )}
            </div>
            <div className="flex items-center gap-2">
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() =>
                    setIsUiVisible((prev) => {
                      const next = !prev
                      toast({
                        title: next ? "Will be shown in list view" : "Won't be shown in list view",
                      })
                      return next
                    })
                  }
                  aria-pressed={isUiVisible}
                >
                  {isUiVisible ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                className="bg-primary hover:bg-primary/90"
                disabled={isSaveDisabled || isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="px-4 pt-3 pb-1 border-b border-border">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "itinerary" | "edit")}>
              <TabsList>
                <TabsTrigger value="itinerary">Itinerary view</TabsTrigger>
                <TabsTrigger value="edit">Itinerary edit</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {viewMode === "itinerary" && isEditing ? (
          <div className="flex-1 overflow-hidden">
            <ItineraryView
              segments={segments}
              selectedSegmentIds={selectedSegments}
              segmentTypes={segmentTypes}
              currencies={currencies}
              conversions={conversions}
              tripCurrencyId={tripCurrencyId}
              displayCurrencyId={resolvedDisplayCurrencyId}
              isLoading={!baselineReady || segmentsLoading}
              onDisconnectSegment={(segmentId) => handleSegmentCheckedChange(segmentId, false)}
            />
          </div>
        ) : null}

        <div className={viewMode === "itinerary" && isEditing ? "hidden" : "flex-1 overflow-y-auto px-4 py-4 space-y-3"}>
          <Collapsible title={generalSummaryTitle} open={generalOpen} onToggle={() => setGeneralOpen((prev) => !prev)}>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right text-sm">
                  Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
            </div>
          </Collapsible>

          {option && (
            <Collapsible
              title={connectedSummaryTitle}
              open={connectionsOpen}
              onToggle={() => setConnectionsOpen((prev) => !prev)}
            >
              <div className="space-y-4 pt-4">
                {/* Starting location — shared by both views */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <MapPinIcon className="h-3.5 w-3.5" />
                    Starting location
                  </label>
                  <Select
                    value={stageBuilder.startingLocationKey ?? ""}
                    onValueChange={(v) => stageBuilder.setStartingLocationKey(v || null)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose starting location…" />
                    </SelectTrigger>
                    <SelectContent>
                      {stageBuilder.availableStartLocations.map((loc) => (
                        <SelectItem key={loc.key} value={loc.key}>
                          {loc.country ? `${loc.name}, ${loc.country}` : loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* View mode toggle */}
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={segmentViewMode === "timeline" ? "secondary" : "ghost"}
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setSegmentViewMode("timeline")}
                    title="Timeline view"
                  >
                    <CalendarRangeIcon className="h-3.5 w-3.5" />
                    Timeline
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={segmentViewMode === "list" ? "secondary" : "ghost"}
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setSegmentViewMode("list")}
                    title="List view"
                  >
                    <LayoutListIcon className="h-3.5 w-3.5" />
                    List
                  </Button>
                </div>

                {segmentViewMode === "timeline" ? (
                  <SegmentTimeline
                    segments={segments}
                    segmentTypes={segmentTypes}
                    selectedSegmentIds={selectedSegments}
                    onToggleSegment={handleTimelineToggleSegment}
                    stages={stageBuilder.stages}
                    stageBuilder={stageBuilder}
                    formatSegmentCost={formatSegmentCost}
                    panelMode={panelMode}
                    startingLocationKey={stageBuilder.startingLocationKey}
                    optionName={name}
                    loading={segmentsLoading}
                  />
                ) : (
                  <>
                    <SegmentFilterPanel
                      value={segmentFilterState}
                      onChange={setSegmentFilterState}
                      sort={segmentSortState}
                      onSortChange={setSegmentSortState}
                      availableLocations={segmentFilterMetadata.locations}
                      availableTypes={segmentFilterMetadata.types}
                      minDate={segmentFilterMetadata.dateBounds.min}
                      maxDate={segmentFilterMetadata.dateBounds.max}
                      uniqueStartDates={segmentFilterMetadata.uniqueStartDates}
                      uniqueEndDates={segmentFilterMetadata.uniqueEndDates}
                      totalCount={segments.length}
                      filteredCount={filteredSegmentsForDisplay.length}
                      hiddenCount={segments.filter((s) => s.isUiVisible === false).length}
                    />
                    <ScrollArea className="h-[320px] border rounded-md p-3">
                      {filteredSegmentsForDisplay.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No segments available.</p>
                      ) : (
                        filteredSegmentsForDisplay.map((segment) => {
                          const segmentType = segmentTypes.find((st) => st.id === segment.segmentTypeId) ?? null
                          const segmentCostLabel = formatSegmentCost(segment)
                          const segmentConfig = buildSegmentConfigFromApi(segment, segmentType ?? undefined)
                          const tokens = buildSegmentTitleTokens({
                            ...segmentConfig,
                            cost: segmentCostLabel ?? segmentConfig.cost,
                          })
                          const summaryLabel = tokensToLabel(tokens) || "Segment"
                          const isHiddenSegment = segment.isUiVisible === false
                          const dimmed = !segmentFilterState.showHidden && isHiddenSegment
                          const dateRangeLabel = `${formatSegmentDateWithWeekday(segment.startDateTimeUtc)} → ${formatSegmentDateWithWeekday(segment.endDateTimeUtc)}`

                          return (
                            <SegmentSelectCard
                              key={segment.id}
                              segmentId={segment.id}
                              checked={selectedSegments.includes(segment.id)}
                              onCheckedChange={(checked) => handleSegmentCheckedChange(segment.id, checked)}
                              tokens={tokens}
                              summaryLabel={summaryLabel}
                              costLabel={segmentCostLabel}
                              dateRangeLabel={dateRangeLabel}
                              dimmed={dimmed}
                              savedSelection={initialSelectedSegmentsRef.current?.includes(segment.id) ?? true}
                              segmentType={segmentType}
                              onSegmentIconMouseEnter={(el) => {
                                if (listCardHideTimer.current) clearTimeout(listCardHideTimer.current)
                                setListCardSegmentId(segment.id)
                                setListCardAnchorEl(el)
                              }}
                              onSegmentIconMouseLeave={() => {
                                listCardHideTimer.current = setTimeout(() => {
                                  setListCardSegmentId(null)
                                  setListCardAnchorEl(null)
                                }, 150)
                              }}
                              onSegmentIconClick={(el) => {
                                setListCardSegmentId((prev) => prev === segment.id ? null : segment.id)
                                setListCardAnchorEl((prev) => prev === el ? null : el)
                              }}
                            />
                          )
                        })
                      )}
                    </ScrollArea>
                    <TimelineSegmentCard
                      segment={listCardSegmentId !== null ? (segments.find((s) => s.id === listCardSegmentId) ?? null) : null}
                      segmentType={listCardSegmentId !== null ? (segmentTypes.find((st) => st.id === segments.find((s) => s.id === listCardSegmentId)?.segmentTypeId) ?? null) : null}
                      anchorEl={listCardAnchorEl}
                      formatSegmentCost={formatSegmentCost}
                      selected={listCardSegmentId !== null && selectedSegments.includes(listCardSegmentId)}
                      optionName={name}
                      onToggle={(segmentId) => handleAutoSaveSegment(segmentId, !selectedSegments.includes(segmentId))}
                      onClose={() => { setListCardSegmentId(null); setListCardAnchorEl(null) }}
                      onNavigateToSegment={openSegmentDetail}
                      onMouseEnter={() => { if (listCardHideTimer.current) clearTimeout(listCardHideTimer.current) }}
                      onMouseLeave={() => { setListCardSegmentId(null); setListCardAnchorEl(null) }}
                    />
                  </>
                )}

              </div>
            </Collapsible>
          )}
        </div>
      </form>

      <AlertDialog open={showUnsavedConfirm} onOpenChange={setShowUnsavedConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved updates. Closing now will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedConfirm(false)}>Continue editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowUnsavedConfirm(false)
                closeModal()
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {option && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Option</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{option.name}&quot;? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-700 hover:bg-red-800 text-white"
              >
                Yes, Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
})

