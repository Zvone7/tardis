"use client";

import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "../components/ui/use-toast";
import { Loader2, CombineIcon } from "lucide-react";
import { optionsApi } from "../utils/apiClient";
import { formatDateStr } from "../utils/dateformatters";
import { formatCurrencyAmount } from "../utils/currency";
import { RangeLocationPicker, type RangeLocationPickerValue } from "../components/RangeLocationPicker";
import type { SegmentApi, SegmentType, Currency, LocationOption } from "../types/models";

interface LocationEntry {
  id: number;
  label: string;
  lat: number;
  lng: number;
  key: string; // "lat,lng" used for deduplication
}

interface CombineAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  segments: SegmentApi[];
  segmentTypes: SegmentType[];
  currencies: Currency[];
  tripId: number;
}

const formatLocationLabel = (loc: any | null): string => {
  if (!loc) return "";
  const name = loc.name ?? "";
  const country = loc.country ?? "";
  return country ? `${name}, ${country}` : name;
};

export default function CombineAllModal({
  isOpen,
  onClose,
  onComplete,
  segments,
  segmentTypes,
  currencies,
  tripId,
}: CombineAllModalProps) {
  const [locRange, setLocRange] = useState<RangeLocationPickerValue>({ start: null, end: null });
  const [excludedSegmentIds, setExcludedSegmentIds] = useState<Set<number>>(new Set());
  const [excludedTypeIds, setExcludedTypeIds] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract unique locations from all segments, deduplicated by lat/lng
  const locations = useMemo(() => {
    const map = new Map<string, LocationEntry>();
    const addLoc = (loc: any) => {
      if (!loc?.id || loc.latitude == null || loc.longitude == null) return;
      const key = `${loc.latitude},${loc.longitude}`;
      if (!map.has(key)) {
        map.set(key, { id: loc.id, label: formatLocationLabel(loc), lat: loc.latitude, lng: loc.longitude, key });
      }
    };
    for (const seg of segments) {
      addLoc((seg as any).startLocation);
      addLoc((seg as any).endLocation);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [segments]);

  // Convert LocationEntry to LocationOption for the picker value
  const toLocationOption = useCallback((entry: LocationEntry): LocationOption => ({
    provider: "local",
    providerPlaceId: entry.key,
    name: entry.label,
    lat: entry.lat,
    lng: entry.lng,
  }), []);

  // Find LocationEntry by LocationOption's lat/lng
  const entryFromOption = useCallback(
    (opt: LocationOption | null): LocationEntry | null => {
      if (!opt) return null;
      const key = `${opt.lat},${opt.lng}`;
      return locations.find((l) => l.key === key) ?? null;
    },
    [locations],
  );

  const startEntry = useMemo(() => entryFromOption(locRange.start), [locRange.start, entryFromOption]);
  const endEntry = useMemo(() => entryFromOption(locRange.end), [locRange.end, entryFromOption]);

  const locKeyOf = (loc: any): string | null => {
    if (!loc || loc.latitude == null || loc.longitude == null) return null;
    return `${loc.latitude},${loc.longitude}`;
  };

  const hasBothLocations = !!startEntry && !!endEntry;

  // Filter segments that match the selected start/end locations (by lat/lng)
  const matchingSegments = useMemo(() => {
    if (!startEntry || !endEntry) return [];
    const keySet = new Set([startEntry.key, endEntry.key]);

    return segments.filter((s) => {
      const sStartKey = locKeyOf((s as any).startLocation);
      const sEndKey = locKeyOf((s as any).endLocation);
      return sStartKey && sEndKey && keySet.has(sStartKey) && keySet.has(sEndKey);
    });
  }, [segments, startEntry, endEntry]);

  // Group matching segments into legs by (startLatLng, endLatLng)
  const legs = useMemo(() => {
    const map = new Map<string, { label: string; segments: SegmentApi[] }>();
    for (const seg of matchingSegments) {
      const sStart = (seg as any).startLocation;
      const sEnd = (seg as any).endLocation;
      const sStartKey = locKeyOf(sStart);
      const sEndKey = locKeyOf(sEnd);
      if (!sStartKey || !sEndKey) continue;
      const key = `${sStartKey}->${sEndKey}`;
      if (!map.has(key)) {
        map.set(key, {
          label: `${formatLocationLabel(sStart)} → ${formatLocationLabel(sEnd)}`,
          segments: [],
        });
      }
      map.get(key)!.segments.push(seg);
    }
    return Array.from(map.values()).sort((a, b) => {
      const aMin = Math.min(...a.segments.map((s) => new Date(s.startDateTimeUtc).getTime()));
      const bMin = Math.min(...b.segments.map((s) => new Date(s.startDateTimeUtc).getTime()));
      return aMin - bMin;
    });
  }, [matchingSegments]);

  // Segment types present in matching segments
  const presentTypeIds = useMemo(() => {
    const ids = new Set<number>();
    for (const seg of matchingSegments) ids.add(seg.segmentTypeId);
    return ids;
  }, [matchingSegments]);

  const presentTypes = useMemo(
    () => segmentTypes.filter((t) => presentTypeIds.has(t.id)),
    [segmentTypes, presentTypeIds]
  );

  // Final included segment IDs (after type filter + individual exclusions)
  const includedSegmentIds = useMemo(() => {
    return matchingSegments
      .filter((s) => !excludedTypeIds.has(s.segmentTypeId) && !excludedSegmentIds.has(s.id))
      .map((s) => s.id);
  }, [matchingSegments, excludedTypeIds, excludedSegmentIds]);

  const toggleSegment = useCallback((segId: number) => {
    setExcludedSegmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(segId)) next.delete(segId);
      else next.add(segId);
      return next;
    });
  }, []);

  const toggleType = useCallback((typeId: number) => {
    setExcludedTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  }, []);

  const handleGenerate = async () => {
    if (includedSegmentIds.length === 0 || !startEntry || !endEntry) return;
    setIsSubmitting(true);
    try {
      const count = await optionsApi.combineAll(tripId, {
        tripId,
        startLocationId: startEntry.id,
        endLocationId: endEntry.id,
        segmentIds: includedSegmentIds,
      });
      toast({
        title: "Options generated",
        description: `${count} option(s) created or restored.`,
      });
      onComplete();
      handleClose();
    } catch (err) {
      console.error("CombineAll failed:", err);
      toast({ title: "Error", description: "Failed to generate options. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setLocRange({ start: null, end: null });
    setExcludedSegmentIds(new Set());
    setExcludedTypeIds(new Set());
    onClose();
  };

  const getSegmentTypeName = (typeId: number) => {
    return segmentTypes.find((t) => t.id === typeId)?.name ?? "Unknown";
  };

  // Render a Select dropdown from the fixed locations list
  const renderLocationSelect = useCallback(
    ({ id: _selectId, placeholder, selected, onSelected }: { id: string; placeholder: string; selected: LocationOption | null; onSelected: (loc: LocationOption | null) => void }) => {
      const selectedKey = selected ? `${selected.lat},${selected.lng}` : "";
      return (
        <Select
          value={selectedKey}
          onValueChange={(key) => {
            const entry = locations.find((l) => l.key === key);
            onSelected(entry ? toLocationOption(entry) : null);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {locations.map((loc) => (
              <SelectItem key={loc.key} value={loc.key}>
                {loc.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
    [locations, toLocationOption],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2">
          <CombineIcon className="h-5 w-5" />
          Combine All
        </DialogTitle>

        <div className="space-y-4 mt-2">
          <RangeLocationPicker
            id="combine-loc"
            label=""
            value={locRange}
            onChange={setLocRange}
            compact
            renderPicker={renderLocationSelect}
          />

          {/* Segment type filter */}
          {hasBothLocations && presentTypes.length > 0 && (
            <div className="space-y-1.5">
              <Label>Segment types</Label>
              <div className="flex flex-wrap gap-2">
                {presentTypes.map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    variant={excludedTypeIds.has(t.id) ? "outline" : "default"}
                    onClick={() => toggleType(t.id)}
                    className="text-xs"
                  >
                    {t.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Segment list grouped by leg */}
          {hasBothLocations && (
            <ScrollArea className="max-h-[350px]">
              {legs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No segments match the selected locations.
                </p>
              ) : (
                <div className="space-y-3">
                  {legs.map((leg) => (
                    <div key={leg.label}>
                      <p className="text-sm font-medium mb-1.5">{leg.label}</p>
                      <div className="space-y-1">
                        {leg.segments.map((seg) => {
                          const isTypeExcluded = excludedTypeIds.has(seg.segmentTypeId);
                          const isExcluded = excludedSegmentIds.has(seg.id) || isTypeExcluded;
                          return (
                            <label
                              key={seg.id}
                              className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/50 ${
                                isExcluded ? "opacity-40" : ""
                              }`}
                            >
                              <Checkbox
                                checked={!isExcluded}
                                disabled={isTypeExcluded}
                                onCheckedChange={() => toggleSegment(seg.id)}
                              />
                              <span className="flex-1 min-w-0">
                                {seg.name ? <span className="block truncate">{seg.name}</span> : null}
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span>{getSegmentTypeName(seg.segmentTypeId)}</span>
                                  <span>·</span>
                                  <span>{formatDateStr(seg.startDateTimeUtc)}</span>
                                  {seg.cost ? (
                                    <>
                                      <span>·</span>
                                      <span>{formatCurrencyAmount(seg.cost, seg.currencyId, currencies)}</span>
                                    </>
                                  ) : null}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">
              {includedSegmentIds.length} segment(s) selected across {legs.length} leg(s)
            </span>
            <Button
              onClick={handleGenerate}
              disabled={isSubmitting || includedSegmentIds.length === 0 || legs.length === 0}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CombineIcon className="h-4 w-4 mr-2" />
              )}
              Generate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
