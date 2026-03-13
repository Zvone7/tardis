"use client";

import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";
import { toast } from "../components/ui/use-toast";
import { Loader2, LinkIcon, UnlinkIcon, SlidersHorizontal } from "lucide-react";
import { optionsApi } from "../utils/apiClient";
import type { SegmentApi, SegmentType, Segment, Currency, CurrencyConversion } from "../types/models";
import { cn } from "../lib/utils";
import { SegmentSelectCard } from "../components/SegmentSelectCard";
import { buildSegmentTitleTokens, buildSegmentConfigFromApi, tokensToLabel } from "../utils/formatters";
import { formatCurrencyAmount, formatConvertedAmount } from "../utils/currency";
import { SegmentFilterPanel, type SegmentFilterValue } from "../components/filters/SegmentFilterPanel";
import type { SegmentSortValue } from "../components/sorting/segmentSortTypes";
import { applySegmentFilters, buildSegmentMetadata } from "../services/segmentFiltering";

interface BatchConnectSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  selectedOptionIds: number[];
  tripId: number;
  segments: SegmentApi[];
  segmentTypes: SegmentType[];
  currencies: Currency[];
  conversions: CurrencyConversion[];
  tripCurrencyId: number | null;
  displayCurrencyId: number | null;
}

export default function BatchConnectSegmentModal({
  isOpen,
  onClose,
  onComplete,
  selectedOptionIds,
  tripId,
  segments,
  segmentTypes,
  currencies,
  conversions,
  tripCurrencyId,
  displayCurrencyId,
}: BatchConnectSegmentModalProps) {
  const [connect, setConnect] = useState(true);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterState, setFilterState] = useState<SegmentFilterValue>({
    locations: [],
    types: [],
    dateRange: { start: "", end: "" },
    showHidden: false,
  });
  const [sortState, setSortState] = useState<SegmentSortValue | null>(null);

  const resolvedDisplayCurrencyId = displayCurrencyId ?? tripCurrencyId ?? null;

  const filterMetadata = useMemo(() => {
    return buildSegmentMetadata((segments as Segment[]) ?? [], segmentTypes);
  }, [segments, segmentTypes]);

  const formatSegmentCost = useCallback(
    (segment: SegmentApi) => {
      if (segment.cost === null || segment.cost === undefined) return null;
      return (
        formatConvertedAmount({
          amount: segment.cost,
          fromCurrencyId: segment.currencyId ?? tripCurrencyId ?? null,
          toCurrencyId: resolvedDisplayCurrencyId,
          currencies,
          conversions,
        }) ?? formatCurrencyAmount(segment.cost, segment.currencyId ?? tripCurrencyId ?? null, currencies)
      );
    },
    [tripCurrencyId, resolvedDisplayCurrencyId, currencies, conversions],
  );

  const filteredSegments = useMemo(() => {
    const filtered = applySegmentFilters(
      segments as Segment[],
      filterState,
      sortState,
      segmentTypes,
      {
        targetCurrencyId: resolvedDisplayCurrencyId,
        fallbackCurrencyId: tripCurrencyId ?? null,
        currencies,
        conversions,
      },
    );
    const selectedSet = new Set(selectedSegmentIds);
    return [...filtered].sort((a, b) => {
      const aSelected = selectedSet.has(a.id) ? 0 : 1;
      const bSelected = selectedSet.has(b.id) ? 0 : 1;
      return aSelected - bSelected;
    });
  }, [segments, filterState, sortState, segmentTypes, resolvedDisplayCurrencyId, tripCurrencyId, currencies, conversions, selectedSegmentIds]);

  const handleSegmentCheckedChange = useCallback((segmentId: number, checked: boolean | "indeterminate") => {
    const isChecked = checked === true;
    setSelectedSegmentIds((prev) => {
      if (isChecked) return prev.includes(segmentId) ? prev : [...prev, segmentId];
      return prev.filter((id) => id !== segmentId);
    });
  }, []);

  const handleApply = async () => {
    if (selectedSegmentIds.length === 0) return;

    setIsSubmitting(true);
    try {
      let totalUpdated = 0;
      for (const segmentId of selectedSegmentIds) {
        const count = await optionsApi.batchConnectSegment(tripId, {
          optionIds: selectedOptionIds,
          segmentId,
          connect,
        });
        totalUpdated += count;
      }
      toast({
        title: connect ? "Segments connected" : "Segments disconnected",
        description: `${selectedSegmentIds.length} segment(s) × ${selectedOptionIds.length} option(s) — ${totalUpdated} link(s) updated.`,
      });
      onComplete();
      handleClose();
    } catch (err) {
      console.error("Batch connect segment failed:", err);
      toast({ title: "Error", description: "Failed to update options. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedSegmentIds([]);
    setFilterState({ locations: [], types: [], dateRange: { start: "", end: "" }, showHidden: false });
    setSortState(null);
    setFilterOpen(false);
    setConnect(true);
    onClose();
  };

  const formatSegmentDateLabel = (iso: string | null) => {
    if (!iso) return "N/A";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "N/A";
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    const dayMonth = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const timeLabel = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${weekday}, ${dayMonth} · ${timeLabel}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl w-full p-0 flex flex-col h-[90vh]">
        <div className="border-b bg-background px-4 py-3 pr-10">
          <DialogTitle className="flex items-center gap-2">
            {connect ? <LinkIcon className="h-5 w-5" /> : <UnlinkIcon className="h-5 w-5" />}
            {connect ? "Connect" : "Disconnect"} Segments
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Updating <strong>{selectedOptionIds.length}</strong> option(s)
          </p>

          <div className="flex items-center justify-between gap-2 mt-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={connect ? "default" : "outline"}
                onClick={() => setConnect(true)}
                className="text-xs"
              >
                <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                Connect
              </Button>
              <Button
                size="sm"
                variant={!connect ? "default" : "outline"}
                onClick={() => setConnect(false)}
                className="text-xs"
              >
                <UnlinkIcon className="mr-1.5 h-3.5 w-3.5" />
                Disconnect
              </Button>
            </div>
            <Button
              onClick={handleApply}
              size="sm"
              disabled={isSubmitting || selectedSegmentIds.length === 0}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {connect ? "Connect" : "Disconnect"} {selectedSegmentIds.length > 0 ? `(${selectedSegmentIds.length})` : ""}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label>Select segments ({selectedSegmentIds.length} selected)</Label>
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
            </Button>
          </div>
          <SegmentFilterPanel
            value={filterState}
            onChange={setFilterState}
            sort={sortState}
            onSortChange={setSortState}
            availableLocations={filterMetadata.locations}
            availableTypes={filterMetadata.types}
            minDate={filterMetadata.dateBounds.min}
            maxDate={filterMetadata.dateBounds.max}
            open={filterOpen}
            onOpenChange={setFilterOpen}
          />
          <ScrollArea className="h-[calc(100%-80px)] border rounded-md p-3">
            {filteredSegments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No segments found.</p>
            ) : (
              filteredSegments.map((segment) => {
                const segmentType = segmentTypes.find((st) => st.id === segment.segmentTypeId) ?? undefined;
                const segmentCostLabel = formatSegmentCost(segment);
                const segmentConfig = buildSegmentConfigFromApi(segment, segmentType);
                const tokens = buildSegmentTitleTokens({
                  ...segmentConfig,
                  cost: segmentCostLabel ?? segmentConfig.cost,
                });
                const summaryLabel = tokensToLabel(tokens) || segment.name;
                const isHiddenSegment = segment.isUiVisible === false;
                const dimmed = !filterState.showHidden && isHiddenSegment;
                const dateRangeLabel = `${formatSegmentDateLabel(segment.startDateTimeUtc)} → ${formatSegmentDateLabel(segment.endDateTimeUtc)}`;

                return (
                  <SegmentSelectCard
                    key={segment.id}
                    segmentId={segment.id}
                    checked={selectedSegmentIds.includes(segment.id)}
                    onCheckedChange={(checked) => handleSegmentCheckedChange(segment.id, checked)}
                    tokens={tokens}
                    summaryLabel={summaryLabel}
                    costLabel={segmentCostLabel}
                    dateRangeLabel={dateRangeLabel}
                    dimmed={dimmed}
                  />
                );
              })
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
