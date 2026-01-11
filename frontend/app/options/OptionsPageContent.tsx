// components/OptionsPageContent.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { PlusIcon, LayoutIcon, EditIcon, EyeOffIcon } from "lucide-react";
import OptionModal from "./OptionModal";
import { formatDateStr, formatWeekday } from "../utils/dateformatters";
import { OptionFilterPanel, type OptionFilterValue } from "../components/filters/OptionFilterPanel";
import type { SegmentFilterValue } from "../components/filters/SegmentFilterPanel";
import type { OptionSortValue } from "../components/sorting/optionSortTypes";
import { applyOptionFilters, buildOptionMetadata } from "../services/optionFiltering";
import { cn } from "../lib/utils";
import { optionsApi, segmentsApi, tripsApi } from "../utils/apiClient";
import { CurrencyDropdown } from "../components/CurrencyDropdown";
import { useCurrencies } from "../hooks/useCurrencies";
import { useCurrencyConversions } from "../hooks/useCurrencyConversions";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatCurrencyAmount, convertWithFallback } from "../utils/currency";

// shared API types
import type { OptionApi, OptionSave, SegmentApi, SegmentType, Currency, CurrencyConversion } from "../types/models";

const formatOptionDateWithWeekday = (iso: string | null) => {
  if (!iso) return "N/A";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "N/A";
  const weekday = formatWeekday(iso);
  const dayMonth = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const timeLabel = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${weekday}, ${dayMonth} · ${timeLabel}`;
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
    <div className="rounded-md border p-3 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-medium">Costs</div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{totalLabel}</span>
          {originalTotalLabel ? (
            <span className="font-medium text-xs text-muted-foreground ml-2">({originalTotalLabel})</span>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          {option.totalDays} {option.totalDays === 1 ? "day" : "days"} ( {perDayLabel} per day)
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
  showVisibilityIndicator,
  displayCurrencyId,
  tripCurrencyId,
  currencies,
  conversions,
}: {
  option: OptionApi;
  onEdit: (option: OptionApi) => void;
  showVisibilityIndicator: boolean;
  displayCurrencyId: number | null;
  tripCurrencyId: number | null;
  currencies: Currency[];
  conversions: CurrencyConversion[];
}) {
  const isHidden = option.isUiVisible === false;

  return (
    <Card
      className={cn(
        "hover:shadow-sm transition-all duration-200 ease-in-out border cursor-pointer hover:-translate-y-0.5",
        isHidden && "bg-muted text-muted-foreground border-muted-foreground/40"
      )}
      onClick={() => onEdit(option)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onEdit(option);
      }}
      aria-label={`Edit option ${option.name}`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold tracking-tight">
              {option.name}
            </CardTitle>

            <div className="mt-1 text-sm text-muted-foreground">
              <div>{formatOptionDateWithWeekday(option.startDateTimeUtc)}</div>
              <div>{formatOptionDateWithWeekday(option.endDateTimeUtc)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4 shrink-0">
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
              size="icon"
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
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <CostSummary
          option={option}
          displayCurrencyId={displayCurrencyId}
          tripCurrencyId={tripCurrencyId}
          currencies={currencies}
          conversions={conversions}
        />
      </CardContent>
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
  const [editingOption, setEditingOption] = useState<OptionApi | null>(null);
  const [tripName, setTripName] = useState<string>("");
  const [tripCurrencyId, setTripCurrencyId] = useState<number | null>(null);
  const [displayCurrencyId, setDisplayCurrencyId] = useState<number | null>(null);
  const [userPreferredCurrencyId, setUserPreferredCurrencyId] = useState<number | null>(null);
  const [filterState, setFilterState] = useState<OptionFilterValue>({
    locations: [],
    dateRange: { start: "", end: "" },
    showHidden: false,
  });
  const [sortState, setSortState] = useState<OptionSortValue | null>(null);
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

  useEffect(() => {
    if (!user) return
    setUserPreferredCurrencyId(user.userPreference?.preferredCurrencyId ?? null)
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
    const source = connectedSegmentList.length ? connectedSegmentList : segments
    return buildOptionMetadata(source)
  }, [connectedSegmentList, segments])

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

  const initialModalFilters = useMemo<SegmentFilterValue>(
    () => ({
      locations: [...filterState.locations],
      types: [],
      dateRange: { ...filterState.dateRange },
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


  if (!tripId) {
    return <div>No trip ID provided</div>;
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Options</CardTitle>
          <CardDescription>{tripName ? tripName : `Trip ID: ${tripId}`}</CardDescription>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.push(`/segments?tripId=${tripId}`)}>
            <LayoutIcon className="mr-2 h-4 w-4" />
            View Segments
          </Button>
          <Button onClick={handleCreateOption}>
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
          <LoadingSkeleton />
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {sortedOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full text-center">No options to display.</p>
            ) : (
              sortedOptions.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  onEdit={handleEditOption}
                  showVisibilityIndicator={filterState.showHidden}
                  displayCurrencyId={effectiveDisplayCurrencyId}
                  tripCurrencyId={tripCurrencyId}
                  currencies={currencies}
                  conversions={conversions}
                />
              ))
            )}
          </div>
        )}
      </CardContent>

      <OptionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveOption}
        option={editingOption ?? undefined}
        tripId={Number(tripId)}
        refreshOptions={fetchOptions}
        tripCurrencyId={tripCurrencyId}
        displayCurrencyId={effectiveDisplayCurrencyId}
        currencies={currencies}
        conversions={conversions}
        initialSegmentFilters={initialModalFilters}
        initialSegmentSort={initialModalSort}
      />
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-56 w-full" />
      ))}
    </div>
  );
}
