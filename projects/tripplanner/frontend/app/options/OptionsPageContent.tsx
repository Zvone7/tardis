// components/OptionsPageContent.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { PlusIcon, LayoutIcon, EditIcon, EyeIcon, EyeOffIcon, CombineIcon, LinkIcon, MoreVerticalIcon, SlidersHorizontal } from "lucide-react";
import SelectPopupMenu from "../components/SelectPopupMenu";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { Checkbox } from "../components/ui/checkbox";
import OptionModal from "./OptionModal";
import CombineAllModal from "./CombineAllModal";
import BatchConnectSegmentModal from "./BatchConnectSegmentModal";
import { formatDateWithUserOffset, formatWeekday } from "../utils/dateformatters";
import { OptionFilterPanel, useOptionFilterHasFilters, type OptionFilterValue } from "../components/filters/OptionFilterPanel";
import type { SegmentFilterValue } from "../components/filters/SegmentFilterPanel";
import type { OptionSortValue } from "../components/sorting/optionSortTypes";
import { applyOptionFilters, buildOptionMetadata } from "../services/optionFiltering";
import { computeCostChips } from "../components/filters/costChips";
import { cn } from "../lib/utils";
import { optionsApi, segmentsApi, tripsApi } from "../utils/apiClient";
import { CurrencyDropdown } from "../components/CurrencyDropdown";
import { UtcOffsetDropdown } from "../components/UtcOffsetDropdown";
import { useCurrencies } from "../hooks/useCurrencies";
import { useCurrencyConversions } from "../hooks/useCurrencyConversions";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatCurrencyAmount, convertWithFallback } from "../utils/currency";
import { useChatContext } from "../chat/ChatProvider";

// shared API types
import type { OptionApi, OptionSave, SegmentApi, SegmentType, Currency, CurrencyConversion } from "../types/models";

const formatOptionDateWithWeekday = (iso: string | null, offset: number) => {
  if (!iso) return "N/A";
  const weekday = formatWeekday(iso, offset);
  const formatted = formatDateWithUserOffset(iso, offset);
  return `${weekday}, ${formatted}`;
};

const formatLocationLabel = (loc: any | null) => {
  if (!loc) return "";
  const name = loc.name ?? "";
  const country = loc.country ?? "";
  return country ? `${name}, ${country}` : name ?? "";
};

/* ---------------------------------- helpers ---------------------------------- */

// Normalize backend enum/string keys into { Accommodation, Transport, Other }
function normalizeCostPerType(raw?: Record<string | number, number> | null) {
  const out = { Accommodation: 0, Transport: 0, Other: 0 };
  if (!raw) return out;

  for (const key of Object.keys(raw)) {
    const rawVal = (raw as any)[key];
    const val = Number(rawVal) || 0;

    const lower = String(key).toLowerCase();
    if (lower.includes("accom")) { out.Accommodation += val; continue; }
    if (lower.includes("trans")) { out.Transport += val; continue; }
    if (lower.includes("other")) { out.Other += val; continue; }

    // fallback enum numbers: 0=Accommodation, 1=Transport, 2=Other
    const asNum = Number(key);
    if (!Number.isNaN(asNum)) {
      if (asNum === 0) out.Accommodation += val;
      else if (asNum === 1) out.Transport += val;
      else if (asNum === 2) out.Other += val;
    }
  }
  return out;
}

/* ---------------------------------- UI bits ---------------------------------- */

function CostPieChart({
  accommodation,
  transport,
  other,
}: {
  accommodation: number;
  transport: number;
  other: number;
}) {
  const total = accommodation + transport + other;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { label: "Transport", value: transport, color: "hsl(var(--chart-1))" },
    { label: "Accommodation", value: accommodation, color: "hsl(var(--chart-2))" },
    { label: "Other", value: other, color: "hsl(var(--chart-3))" },
  ];

  let accumulated = 0;

  return (
    <svg width="90" height="90" viewBox="0 0 90 90" className="shrink-0">
      <circle cx="45" cy="45" r={radius} fill="transparent" stroke="hsl(var(--muted))" strokeWidth="14" />
      {total > 0 &&
        segments.map((segment) => {
          if (segment.value <= 0) return null;
          const dash = (segment.value / total) * circumference;
          const circle = (
            <circle
              key={segment.label}
              cx="45"
              cy="45"
              r={radius}
              fill="transparent"
              stroke={segment.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-(accumulated)}
              strokeLinecap="butt"
              transform="rotate(-90 45 45)"
            />
          );
          accumulated += dash;
          return circle;
        })}
    </svg>
  );
}

function CostSummary({
  option,
  displayCurrencyId,
  tripCurrencyId,
  currencies,
  conversions,
}: {
  option: OptionApi;
  displayCurrencyId: number | null;
  tripCurrencyId: number | null;
  currencies: Currency[];
  conversions: CurrencyConversion[];
}) {
  const split = useMemo(() => normalizeCostPerType(option.costPerType), [option.costPerType]);
  const effectiveCurrencyId = displayCurrencyId ?? tripCurrencyId ?? null;
  const primaryCurrencyId = effectiveCurrencyId ?? tripCurrencyId ?? null;
  const totalDisplay = convertWithFallback({
    amount: option.totalCost ?? 0,
    fromCurrencyId: tripCurrencyId ?? null,
    toCurrencyId: effectiveCurrencyId,
    conversions,
  });
  const perDayDisplay = convertWithFallback({
    amount: option.costPerDay ?? 0,
    fromCurrencyId: tripCurrencyId ?? null,
    toCurrencyId: effectiveCurrencyId,
    conversions,
  });
  const totalLabel = formatCurrencyAmount(totalDisplay.amount, totalDisplay.currencyId ?? primaryCurrencyId, currencies);
  const perDayLabel = formatCurrencyAmount(perDayDisplay.amount, perDayDisplay.currencyId ?? primaryCurrencyId, currencies);
  const showOriginalTotal =
    displayCurrencyId !== null && tripCurrencyId !== null && tripCurrencyId !== displayCurrencyId && option.totalCost !== null;
  const originalTotalLabel = showOriginalTotal
    ? formatCurrencyAmount(option.totalCost ?? 0, tripCurrencyId, currencies)
    : null;
  const convertSplitValue = (value: number) =>
    convertWithFallback({
      amount: value,
      fromCurrencyId: tripCurrencyId ?? null,
      toCurrencyId: effectiveCurrencyId,
      conversions,
    });
  const displaySplit = {
    Accommodation: convertSplitValue(split.Accommodation),
    Transport: convertSplitValue(split.Transport),
    Other: convertSplitValue(split.Other),
  };
  const splitLabel = (value: ReturnType<typeof convertSplitValue>) =>
    formatCurrencyAmount(value.amount, value.currencyId ?? primaryCurrencyId, currencies);

  const legendEntries = [
    { key: "Transport", color: "hsl(var(--chart-1))", value: split.Transport, label: splitLabel(displaySplit.Transport) },
    { key: "Accommodation", color: "hsl(var(--chart-2))", value: split.Accommodation, label: splitLabel(displaySplit.Accommodation) },
    { key: "Other", color: "hsl(var(--chart-3))", value: split.Other, label: splitLabel(displaySplit.Other) },
  ].filter((entry) => entry.value > 0)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-lg font-semibold">{totalLabel}</div>
          {originalTotalLabel ? (
            <span className="text-sm text-muted-foreground">({originalTotalLabel})</span>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          {option.totalDays} {option.totalDays === 1 ? "day" : "days"} ({perDayLabel} per day)
        </div>
      </div>
      <div className="flex items-center gap-4">
        <CostPieChart
          accommodation={split.Accommodation}
          transport={split.Transport}
          other={split.Other}
        />
        <div className="space-y-2 text-xs text-muted-foreground">
          {legendEntries.length === 0 ? (
            <div className="text-muted-foreground">No categorized costs yet.</div>
          ) : (
            legendEntries.map((entry) => (
              <div key={entry.key} className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-sm ring-1 ring-black/10 dark:ring-white/40"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-foreground">{entry.key}</span> ({entry.label})
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

type ConnectedSegment = SegmentApi & { segmentType: SegmentType };

/* ---------------------------------- Card ---------------------------------- */
function OptionCard({
  option,
  onEdit,
  onToggleVisibility,
  showVisibilityIndicator,
  displayCurrencyId,
  tripCurrencyId,
  currencies,
  conversions,
  connectedSegments,
  userPreferredOffset,
  isSelected = false,
  onToggleSelect,
}: {
  option: OptionApi;
  onEdit: (option: OptionApi) => void;
  onToggleVisibility: (option: OptionApi) => void;
  showVisibilityIndicator: boolean;
  displayCurrencyId: number | null;
  tripCurrencyId: number | null;
  currencies: Currency[];
  conversions: CurrencyConversion[];
  connectedSegments: ConnectedSegment[];
  userPreferredOffset: number;
  isSelected?: boolean;
  onToggleSelect?: (optionId: number) => void;
}) {
  const isHidden = option.isUiVisible === false;

  const sortedSegments = useMemo(
    () => [...connectedSegments].sort((a, b) => (a.startDateTimeUtc ?? "").localeCompare(b.startDateTimeUtc ?? "")),
    [connectedSegments]
  );

  return (
    <Card
      className={cn(
        "hover:shadow-sm transition-all duration-200 ease-in-out border cursor-pointer hover:-translate-y-0.5",
        isHidden && "bg-muted text-muted-foreground border-muted-foreground/40",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onEdit(option)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onEdit(option);
      }}
      aria-label={`Edit option ${option.name}`}
    >
      <div className="flex flex-col md:flex-row">
        {/* Left: checkbox, name, dates, segment icons */}
        <div className="flex-1 min-w-0 p-4 pb-3 md:pb-4">
          <div className="flex items-start">
            <div className="mr-2 mt-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect?.(option.id)}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold tracking-tight">
                  {option.name}
                </CardTitle>
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                <div>{formatOptionDateWithWeekday(option.startDateTimeUtc, userPreferredOffset)}</div>
                <div>{formatOptionDateWithWeekday(option.endDateTimeUtc, userPreferredOffset)}</div>
              </div>

              {sortedSegments.length > 0 && (
                <div className="mt-2 flex items-center gap-1">
                  {(sortedSegments.length <= 6 ? sortedSegments : sortedSegments.slice(0, 5)).map((seg, i) =>
                    seg.segmentType?.iconSvg ? (
                      <span
                        key={`${seg.id}-${i}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/60 text-secondary-foreground shadow-sm ring-1 ring-black/5 dark:bg-white dark:text-black"
                        title={seg.segmentType.name}
                      >
                        <span
                          className="w-4 h-4"
                          dangerouslySetInnerHTML={{ __html: seg.segmentType.iconSvg }}
                          suppressHydrationWarning
                        />
                      </span>
                    ) : null
                  )}
                  {sortedSegments.length > 6 && (
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm ring-1 ring-black/5 text-xs font-medium"
                      title={`${sortedSegments.length - 5} more segments`}
                    >
                      +{sortedSegments.length - 5}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              {showVisibilityIndicator && (
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title={isHidden ? "Show option" : "Hide option"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(option);
                  }}
                >
                  {isHidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(option);
                }}
                aria-label="Edit option"
              >
                <EditIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right: cost summary (desktop: side column) */}
        <div className="md:w-1/2 md:shrink-0 p-4 pt-0 md:pt-4">
          <CostSummary
            option={option}
            displayCurrencyId={displayCurrencyId}
            tripCurrencyId={tripCurrencyId}
            currencies={currencies}
            conversions={conversions}
          />
        </div>
      </div>
    </Card>
  );
}



/* ----------------------------------- Page ----------------------------------- */

export default function OptionsPageContent() {
  const [options, setOptions] = useState<OptionApi[]>([]);
  const [segments, setSegments] = useState<SegmentApi[]>([]);
  const [segmentTypes, setSegmentTypes] = useState<SegmentType[]>([]);
  const [connectedSegments, setConnectedSegments] = useState<Record<number, ConnectedSegment[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCombineAllOpen, setIsCombineAllOpen] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<number>>(new Set());
  const [isBatchConnectOpen, setIsBatchConnectOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<OptionApi | null>(null);
  const [tripName, setTripName] = useState<string>("");
  const [tripCurrencyId, setTripCurrencyId] = useState<number | null>(null);
  const [displayCurrencyId, setDisplayCurrencyId] = useState<number | null>(null);
  const [userPreferredCurrencyId, setUserPreferredCurrencyId] = useState<number | null>(null);
  const [userPreferredOffset, setUserPreferredOffset] = useState<number>(0);
  const [filterState, setFilterState] = useState<OptionFilterValue>({
    locations: [],
    dateRange: { start: "", end: "" },
    costMin: null,
    costMax: null,
    showHidden: false,
  });
  const [sortState, setSortState] = useState<OptionSortValue | null>(null);
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

  const fetchOptions = useCallback(async () => {
    if (!tripId) return;
    setIsLoading(true);
    try {
      const data = await optionsApi.getByTripId(tripId);
      setOptions(data);
    } catch (err) {
      setError("An error occurred while fetching options");
      console.error("Error fetching options:", err);
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  const fetchSegments = useCallback(async () => {
    if (!tripId) return;
    try {
      const data = await segmentsApi.getByTripId(tripId);
      setSegments(data);
    } catch (err) {
      console.error("Error fetching segments:", err);
    }
  }, [tripId]);

  const fetchSegmentTypes = useCallback(async () => {
    try {
      const data = await segmentsApi.getTypes();
      setSegmentTypes(data);
    } catch (err) {
      console.error("Error fetching segment types:", err);
    }
  }, []);

  const getConnectedSegments = useCallback(
    async (optionId: number): Promise<ConnectedSegment[]> => {
      try {
        if (!tripId) {
          setError("No trip ID provided");
          return [];
        }
        const connected = await optionsApi.getConnectedSegments(tripId, optionId);
        return connected.map((segment) => ({
          ...segment,
          segmentType:
            segmentTypes.find((st) => st.id === segment.segmentTypeId) || {
              id: 0,
              shortName: "Unknown",
              name: "Unknown",
              description: "Unknown segment type",
              color: "#CCCCCC",
              iconSvg: "<svg></svg>",
            },
        }));
      } catch (error) {
        console.error("Error fetching connected segments:", error);
        return [];
      }
    },
    [segmentTypes, tripId]
  );

  useEffect(() => {
    fetchTripName();
    fetchOptions();
    fetchSegments();
    fetchSegmentTypes();
  }, [fetchTripName, fetchOptions, fetchSegments, fetchSegmentTypes]);

  // Chat assistant integration
  const chatContext = useChatContext();
  useEffect(() => {
    if (tripId) chatContext.setTrip(Number(tripId), tripName);
    return () => chatContext.setTrip(null, null);
  }, [tripId, tripName]);
  useEffect(() => {
    return chatContext.registerRefreshCallback(fetchOptions);
  }, [chatContext.registerRefreshCallback, fetchOptions]);

  useEffect(() => {
    if (!user) return
    setUserPreferredCurrencyId(user.userPreference?.preferredCurrencyId ?? null)
    setUserPreferredOffset(user.userPreference?.preferredUtcOffset ?? 0)
  }, [user])

  useEffect(() => {
    if (displayCurrencyId !== null) return
    if (tripCurrencyId) {
      setDisplayCurrencyId(tripCurrencyId)
      return
    }
    if (userPreferredCurrencyId) {
      setDisplayCurrencyId(userPreferredCurrencyId)
    }
  }, [displayCurrencyId, tripCurrencyId, userPreferredCurrencyId])

  const segmentLookup = useMemo(() => {
    const map = new Map<number, SegmentApi>()
    segments.forEach((segment) => map.set(segment.id, segment))
    return map
  }, [segments])

  useEffect(() => {
    const fetchAllConnected = async () => {
      const map: Record<number, ConnectedSegment[]> = {}
      for (const option of options) {
        const connected = await getConnectedSegments(option.id)
        map[option.id] = connected.map((segment) => {
          const fallback = segmentLookup.get(segment.id)
          const start =
            (segment as any).startLocation ??
            fallback?.startLocation ??
            null
          const end =
            (segment as any).endLocation ??
            fallback?.endLocation ??
            null

          return {
            ...segment,
            startLocation: start,
            endLocation: end,
          }
        })
      }
      setConnectedSegments(map)
    }
    if (options.length > 0 && segmentTypes.length > 0) {
      void fetchAllConnected()
    }
  }, [options, segmentTypes, getConnectedSegments, segmentLookup])

  const connectedSegmentList = useMemo(() => {
    const list: SegmentApi[] = []
    Object.values(connectedSegments).forEach((segmentsArr) => {
      list.push(...segmentsArr)
    })
    return list
  }, [connectedSegments])

  const optionMetadata = useMemo(() => {
    const segSource = connectedSegmentList.length ? connectedSegmentList : segments
    return buildOptionMetadata(options, segSource)
  }, [options, connectedSegmentList, segments])

  const costChips = useMemo(() => computeCostChips(options.map((o) => o.totalCost ?? 0)), [options])
  const tripCurrencyLabel = useMemo(() => currencies.find((c) => c.id === tripCurrencyId)?.shortName ?? "", [currencies, tripCurrencyId])

  const locationOptions = useMemo(() => {
    const labels = new Set<string>()
    const addLocations = (segment: SegmentApi) => {
      const startLoc = (segment as any).startLocation ?? null
      const endLoc = (segment as any).endLocation ?? null
      const startLabel = formatLocationLabel(startLoc)
      const endLabel = formatLocationLabel(endLoc)
      if (startLabel) labels.add(startLabel)
      if (endLabel) labels.add(endLabel)
    }
    segments.forEach(addLocations)
    connectedSegmentList.forEach(addLocations)
    return Array.from(labels).sort((a, b) => a.localeCompare(b))
  }, [segments, connectedSegmentList])

  const toggleOptionSelection = useCallback((optionId: number) => {
    setSelectedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  }, []);

  const handleBatchConnectComplete = useCallback(() => {
    setSelectedOptionIds(new Set());
    fetchOptions();
  }, [fetchOptions]);

  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const handleBatchDelete = useCallback(async () => {
    if (!tripId || selectedOptionIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedOptionIds.size} option(s)? This cannot be undone.`)) return;
    setIsBatchDeleting(true);
    try {
      await optionsApi.batchDelete(tripId, Array.from(selectedOptionIds));
      setSelectedOptionIds(new Set());
      fetchOptions();
    } catch (err) {
      console.error("Batch delete failed:", err);
    } finally {
      setIsBatchDeleting(false);
    }
  }, [tripId, selectedOptionIds, fetchOptions]);

  const handleToggleVisibility = useCallback(async (option: OptionApi) => {
    if (!tripId) return;
    const isHidden = option.isUiVisible === false;
    if (!isHidden && !window.confirm(`Hide "${option.name}"?`)) return;
    try {
      await optionsApi.batchSetVisibility(tripId, [option.id], isHidden);
      fetchOptions();
    } catch (err) {
      console.error("Toggle visibility failed:", err);
    }
  }, [tripId, fetchOptions]);

  const handleBatchSetVisibility = useCallback(async (isVisible: boolean) => {
    if (!tripId || selectedOptionIds.size === 0) return;
    try {
      await optionsApi.batchSetVisibility(tripId, Array.from(selectedOptionIds), isVisible);
      setSelectedOptionIds(new Set());
      fetchOptions();
    } catch (err) {
      console.error("Batch visibility failed:", err);
    }
  }, [tripId, selectedOptionIds, fetchOptions]);

  const handleEditOption = (option: OptionApi) => {
    setEditingOption(option);
    setIsModalOpen(true);
  };

  const handleCreateOption = () => {
    setEditingOption(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingOption(null);
  };

  const handleSaveOption = async (optionData: OptionSave) => {
    if (!tripId) {
      setError("No trip ID provided");
      return;
    }
    try {
      if (editingOption) {
        await optionsApi.update(tripId, { ...optionData, id: editingOption.id });
      } else {
        await optionsApi.create(tripId, optionData);
      }
      handleCloseModal();
      await fetchOptions();
    } catch (err) {
      console.error("Error saving option:", err);
      setError("An error occurred while saving the option");
    }
  };


  const sortedOptions = useMemo(
    () => applyOptionFilters(options, filterState, sortState, connectedSegments),
    [options, filterState, sortState, connectedSegments],
  )

  const selectAllFiltered = useCallback(() => {
    setSelectedOptionIds(new Set(sortedOptions.map((o) => o.id)));
  }, [sortedOptions]);

  const initialModalFilters = useMemo<SegmentFilterValue>(
    () => ({
      locations: [...filterState.locations],
      types: [],
      dateRange: { ...filterState.dateRange },
      costMin: null,
      costMax: null,
      showHidden: filterState.showHidden,
    }),
    [filterState],
  )

  type ModalSegmentSort = { field: "startDate" | "endDate"; direction: "asc" | "desc" }
  const initialModalSort = useMemo<ModalSegmentSort | null>(() => {
    if (!sortState) return null
    switch (sortState.field) {
      case "startDate":
        return { field: "startDate", direction: sortState.direction }
      case "endDate":
        return { field: "endDate", direction: sortState.direction }
      default:
        return null
    }
  }, [sortState])

  const effectiveDisplayCurrencyId = displayCurrencyId ?? tripCurrencyId ?? userPreferredCurrencyId ?? null
  const selectedCurrencyMeta = useMemo(
    () => currencies.find((c) => c.id === effectiveDisplayCurrencyId) ?? null,
    [currencies, effectiveDisplayCurrencyId],
  )
  const tripCurrencyMeta = useMemo(
    () => currencies.find((c) => c.id === (tripCurrencyId ?? undefined)) ?? null,
    [currencies, tripCurrencyId],
  )


  const hasActiveFilters = useOptionFilterHasFilters(filterState, optionMetadata.dateBounds.min, optionMetadata.dateBounds.max)

  if (!tripId) {
    return <div>No trip ID provided</div>;
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-lg font-semibold">{tripName ? tripName : `Trip ID: ${tripId}`}</CardTitle>
          <CardDescription>Options</CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => router.push(`/segments?tripId=${tripId}`)}>
            <LayoutIcon className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Segments</span>
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
                  onClick={() => setIsCombineAllOpen(true)}
                >
                  <CombineIcon className="h-4 w-4" />
                  Combine All
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={handleCreateOption}>
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <OptionFilterPanel
          value={filterState}
          onChange={setFilterState}
          sort={sortState}
          onSortChange={setSortState}
          availableLocations={locationOptions}
          minDate={optionMetadata.dateBounds.min}
          maxDate={optionMetadata.dateBounds.max}
          uniqueStartDates={optionMetadata.uniqueStartDates}
          uniqueEndDates={optionMetadata.uniqueEndDates}
          totalCount={options.length}
          filteredCount={sortedOptions.length}
          hiddenCount={options.filter((o) => o.isUiVisible === false).length}
          costMinChips={costChips.minChips}
          costMaxChips={costChips.maxChips}
          allSameCost={costChips.allSameCost}
          currencyLabel={tripCurrencyLabel}
        />


        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 mt-4">
            {sortedOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full text-center">No options to display.</p>
            ) : (
              sortedOptions.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  onEdit={handleEditOption}
                  onToggleVisibility={handleToggleVisibility}
                  showVisibilityIndicator
                  displayCurrencyId={effectiveDisplayCurrencyId}
                  tripCurrencyId={tripCurrencyId}
                  currencies={currencies}
                  conversions={conversions}
                  connectedSegments={connectedSegments[option.id] ?? []}
                  userPreferredOffset={userPreferredOffset}
                  isSelected={selectedOptionIds.has(option.id)}
                  onToggleSelect={toggleOptionSelection}
                />
              ))
            )}
          </div>
        )}
      </CardContent>

      <CombineAllModal
        isOpen={isCombineAllOpen}
        onClose={() => setIsCombineAllOpen(false)}
        onComplete={fetchOptions}
        segments={segments}
        segmentTypes={segmentTypes}
        currencies={currencies}
        tripId={Number(tripId)}
      />

      <OptionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveOption}
        option={editingOption ?? undefined}
        tripId={Number(tripId)}
        tripName={tripName}
        refreshOptions={fetchOptions}
        tripCurrencyId={tripCurrencyId}
        displayCurrencyId={effectiveDisplayCurrencyId}
        currencies={currencies}
        conversions={conversions}
        initialSegmentFilters={initialModalFilters}
        initialSegmentSort={initialModalSort}
      />

      <BatchConnectSegmentModal
        isOpen={isBatchConnectOpen}
        onClose={() => setIsBatchConnectOpen(false)}
        onComplete={handleBatchConnectComplete}
        selectedOptionIds={Array.from(selectedOptionIds)}
        tripId={Number(tripId)}
        segments={segments}
        segmentTypes={segmentTypes}
        currencies={currencies}
        conversions={conversions}
        tripCurrencyId={tripCurrencyId}
        displayCurrencyId={displayCurrencyId}
      />

      <SelectPopupMenu
        selectedCount={selectedOptionIds.size}
        totalCount={sortedOptions.length}
        onSelectAll={selectAllFiltered}
        onHide={() => handleBatchSetVisibility(false)}
        onShow={() => handleBatchSetVisibility(true)}
        onDelete={handleBatchDelete}
        isDeleting={isBatchDeleting}
        onClear={() => setSelectedOptionIds(new Set())}
        extraActions={[
          {
            icon: <LinkIcon className="h-4 w-4" />,
            label: "Connect / Disconnect Segment",
            onClick: () => setIsBatchConnectOpen(true),
          },
        ]}
      />
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-56 w-full" />
      ))}
    </div>
  );
}
