// components/OptionModal.tsx
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";
import { toast } from "../components/ui/use-toast";
import { Checkbox } from "../components/ui/checkbox";
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
import { SaveIcon, Trash2Icon, EyeOffIcon, EyeIcon, LayersIcon, Loader2 } from "lucide-react";
import type { SegmentType, SegmentApi, OptionApi, OptionSave, Currency, CurrencyConversion, Segment } from "../types/models";
import { cn } from "../lib/utils";
import { TitleTokens } from "../components/TitleTokens";
import {
  buildOptionTitleTokens,
  buildSegmentTitleTokens,
  buildSegmentConfigFromApi,
  summarizeSegmentsForOption,
  tokensToLabel,
} from "../utils/formatters";
import { formatCurrencyAmount, formatConvertedAmount } from "../utils/currency";
import { optionsApi, segmentsApi } from "../utils/apiClient";
import { SegmentFilterPanel, type SegmentFilterValue } from "../components/filters/SegmentFilterPanel"
import type { SegmentSortValue } from "../components/sorting/segmentSortTypes"
import { applySegmentFilters, buildSegmentMetadata } from "../services/segmentFiltering"

const arraysEqual = (a: number[], b: number[]) => a.length === b.length && a.every((val, idx) => val === b[idx])
type DiagramSegment = SegmentApi & { segmentType: SegmentType }

const SEGMENT_COLOR_PALETTE = [
  "#0ea5e9",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#6366f1",
]

interface OptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (option: OptionSave) => Promise<void> | void;
  option?: OptionApi | null;
  tripId: number;
  refreshOptions: () => void;
  tripCurrencyId: number | null;
  displayCurrencyId: number | null;
  currencies: Currency[];
  conversions: CurrencyConversion[];
  initialSegmentFilters?: SegmentFilterValue;
  initialSegmentSort?: SegmentSortValue | null;
}

export default function OptionModal({
  isOpen,
  onClose,
  onSave,
  option,
  tripId,
  refreshOptions,
  tripCurrencyId,
  displayCurrencyId,
  currencies,
  conversions,
  initialSegmentFilters,
  initialSegmentSort,
}: OptionModalProps) {
  const [name, setName] = useState("");
  const [segments, setSegments] = useState<SegmentApi[]>([]);
  const [segmentTypes, setSegmentTypes] = useState<SegmentType[]>([]);
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
  const [segmentFilterState, setSegmentFilterState] = useState<SegmentFilterValue>({
    locations: [],
    types: [],
    dateRange: { start: "", end: "" },
    showHidden: false,
  })
  const [segmentSortState, setSegmentSortState] = useState<SegmentSortValue | null>(null)
  const resolvedDisplayCurrencyId = displayCurrencyId ?? tripCurrencyId ?? null;
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

  // fetch user offset (for time formatting)

  const fetchSegments = useCallback(async () => {
    try {
      const data = await segmentsApi.getByTripId(tripId);
      setSegments(data);
    } catch (error) {
      console.error("Error fetching segments:", error);
      toast({ title: "Error", description: "Failed to fetch segments. Please try again." });
    }
  }, [tripId, toast]);

  const fetchSegmentTypes = useCallback(async () => {
    try {
      const data = await segmentsApi.getTypes();
      setSegmentTypes(data);
    } catch (error) {
      console.error("Error fetching segment types:", error);
      toast({ title: "Error", description: "Failed to fetch segment types. Please try again." });
    }
  }, [toast]);

  const fetchConnectedSegments = useCallback(
    async (optionId: number) => {
      try {
        const data = await optionsApi.getConnectedSegments(tripId, optionId);
        const ids = data.map((segment) => segment.id);
        setSelectedSegments(ids);
        initialSelectedSegmentsRef.current = [...ids].sort((a, b) => a - b);
        setBaselineReady(true);
      } catch (error) {
        console.error("Error fetching connected segments:", error);
        toast({ title: "Error", description: "Failed to fetch connected segments. Please try again." });
        setBaselineReady(true);
      }
    },
    [tripId, toast],
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
    void fetchSegments();
    void fetchSegmentTypes();
  }, [option, fetchConnectedSegments, fetchSegments, fetchSegmentTypes]);

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
        locations: [...initialFilters.locations],
        types: [...initialFilters.types],
        dateRange: { ...initialFilters.dateRange },
        showHidden: initialFilters.showHidden,
      })
    } else {
      setSegmentFilterState({
        locations: [],
        types: [],
        dateRange: { start: "", end: "" },
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

      toast({ title: "Success", description: "Connected segments updated successfully" });
      refreshOptions();
      handleClose();
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

  const closeModal = useCallback(() => {
    skipClosePromptRef.current = true
    onClose()
  }, [onClose])

  const handleClose = () => {
    closeModal()
  }

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
  }, [isEditing, baselineReady, name, isUiVisible, selectedSegments]);

  const isSaveDisabled = isEditing ? !hasChanges : false;

  const formatSegmentDateWithWeekday = useCallback((iso?: string | null) => {
    if (!iso) return "N/A"
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return "N/A"
    const weekday = date.toLocaleDateString(undefined, { weekday: "short" })
    const dayMonth = date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    const timeLabel = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    return `${weekday}, ${dayMonth} · ${timeLabel}`
  }, [])

  const createFormTouched = useMemo(() => {
    if (isEditing) return false
    return Boolean(
      (name && name.trim()) ||
        selectedSegments.length > 0 ||
        isUiVisible === false,
    )
  }, [isEditing, name, selectedSegments.length, isUiVisible])

  const shouldPromptOnClose = isEditing ? hasChanges : createFormTouched

  const segmentFilterMetadata = useMemo(() => {
    return buildSegmentMetadata((segments as Segment[]) ?? [], segmentTypes)
  }, [segments, segmentTypes])

  const filteredSegmentsForDisplay = useMemo(() => {
    if (!option) return []
    return applySegmentFilters(
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
    return buildOptionTitleTokens({
      name,
      fallbackName: option?.name || "New option",
      segmentCount: derived.segmentCount ?? null,
      startLocationLabel: derived.startLocationLabel ?? undefined,
      endLocationLabel: derived.endLocationLabel ?? undefined,
      startDateIso: derived.startDateIso ?? option?.startDateTimeUtc ?? null,
      endDateIso: derived.endDateIso ?? option?.endDateTimeUtc ?? null,
      startOffset: derived.startOffset ?? (option ? 0 : null),
      endOffset: derived.endOffset ?? (option ? 0 : null),
      totalCost: derived.totalCost ?? option?.totalCost ?? null,
    });
  }, [name, option, selectedSegmentEntities, displayCurrencyId, tripCurrencyId, conversions]);

  const defaultOptionTitle = option ? `Edit Option: ${option.name ?? "Option"}` : "Create Option";
  const optionTitleText = tokensToLabel(optionTitleTokens) || defaultOptionTitle;
  const headerTitle = option?.name?.trim() ? option.name.trim() : "New option"
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
    return (
      <div className="flex flex-col gap-1 text-left">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Connected segments
        </span>
        <span className="text-sm font-medium text-foreground">
          {selectedSegmentsCount ? `${selectedSegmentsCount} selected` : "No segments linked"}
        </span>
      </div>
    )
  }, [selectedSegmentsCount])

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) return
      if (skipClosePromptRef.current) {
        skipClosePromptRef.current = false
        return
      }
      if (shouldPromptOnClose) {
        setShowUnsavedConfirm(true)
      } else {
        closeModal()
      }
    },
    [shouldPromptOnClose, closeModal],
  )

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-lg w-full p-0 flex flex-col h-[90vh]">
          <DialogTitle className="sr-only">{optionTitleText}</DialogTitle>
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="border-b bg-background px-4 py-3">
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

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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
                    <SegmentFilterPanel
                      value={segmentFilterState}
                      onChange={setSegmentFilterState}
                      sort={segmentSortState}
                      onSortChange={setSegmentSortState}
                      availableLocations={segmentFilterMetadata.locations}
                      availableTypes={segmentFilterMetadata.types}
                      minDate={segmentFilterMetadata.dateBounds.min}
                      maxDate={segmentFilterMetadata.dateBounds.max}
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
                          const summaryLabel = tokensToLabel(tokens) || segment.name
                          const isHiddenSegment = segment.isUiVisible === false
                          const dimmed = !segmentFilterState.showHidden && isHiddenSegment

                          return (
                            <label
                              key={segment.id}
                              htmlFor={`segment-${segment.id}`}
                              className={cn(
                                "flex items-start gap-3 rounded-md p-2 hover:bg-muted/60 cursor-pointer",
                                dimmed && "bg-muted text-muted-foreground",
                              )}
                            >
                              <Checkbox
                                id={`segment-${segment.id}`}
                                checked={selectedSegments.includes(segment.id)}
                                onCheckedChange={(checked) => handleSegmentCheckedChange(segment.id, checked)}
                                className="mt-1"
                                aria-label={`Select ${summaryLabel}`}
                              />

                              <div className="flex-1 min-w-0" aria-label={summaryLabel}>
                                <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
                                  <TitleTokens tokens={tokens} size="sm" />
                                </div>
                                {segmentCostLabel ? (
                                  <div className="mt-0.5 text-xs text-muted-foreground">{segmentCostLabel}</div>
                                ) : null}
                                <div className="mt-1 text-xs text-muted-foreground leading-snug">
                                  {formatSegmentDateWithWeekday(segment.startDateTimeUtc)}
                                  <span className="mx-1 text-muted-foreground">→</span>
                                  {formatSegmentDateWithWeekday(segment.endDateTimeUtc)}
                                </div>
                              </div>
                              {dimmed && <EyeOffIcon className="mt-1 h-4 w-4" aria-hidden="true" />}
                            </label>
                          )
                        })
                      )}
                    </ScrollArea>
                    {selectedConnectedSegments.length > 0 ? (
                      <div className="pt-2">
                        <SegmentDiagram segments={selectedConnectedSegments} />
                      </div>
                    ) : null}
                  </div>
                </Collapsible>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
}

function SegmentDiagram({ segments }: { segments: DiagramSegment[] }) {
  const sorted = [...segments].sort((a, b) => {
    if (a.startDateTimeUtc && b.startDateTimeUtc) {
      return new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime()
    }
    return 0
  })

  const segmentWidth = sorted.length ? 100 / sorted.length : 100

  return (
    <div className="mt-2 flex w-full space-x-1 overflow-x-auto py-2">
      {sorted.map((segment, index) => {
        const paletteColor = SEGMENT_COLOR_PALETTE[index % SEGMENT_COLOR_PALETTE.length]
        const bgColor = segment.segmentType.color?.trim() ? segment.segmentType.color : paletteColor
        return (
          <div key={segment.id} className="flex-grow" style={{ width: `${segmentWidth}%`, minWidth: "80px" }}>
            <div
              className="relative flex h-12 items-center justify-center overflow-hidden rounded-md shadow-lg ring-1 ring-black/10 dark:ring-white/20"
              style={{
                backgroundColor: bgColor,
                clipPath: "polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 10% 50%)",
              }}
              title={`${segment.segmentType.name} - ${segment.name}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-transparent mix-blend-overlay pointer-events-none" />
              <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-md">
                {segment.segmentType.iconSvg ? (
                  <div
                    className="h-5 w-5"
                    dangerouslySetInnerHTML={{ __html: segment.segmentType.iconSvg as string }}
                    suppressHydrationWarning
                  />
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
