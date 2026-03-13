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
import type { SegmentApi, SegmentType } from "../types/models";

interface LocationEntry {
  id: number;
  label: string;
}

interface CombineAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  segments: SegmentApi[];
  segmentTypes: SegmentType[];
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
  tripId,
}: CombineAllModalProps) {
  const [startLocationId, setStartLocationId] = useState<string>("");
  const [endLocationId, setEndLocationId] = useState<string>("");
  const [excludedSegmentIds, setExcludedSegmentIds] = useState<Set<number>>(new Set());
  const [excludedTypeIds, setExcludedTypeIds] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract unique locations from all segments
  const locations = useMemo(() => {
    const map = new Map<number, LocationEntry>();
    for (const seg of segments) {
      const startLoc = (seg as any).startLocation;
      const endLoc = (seg as any).endLocation;
      if (startLoc?.id) {
        map.set(startLoc.id, { id: startLoc.id, label: formatLocationLabel(startLoc) });
      }
      if (endLoc?.id) {
        map.set(endLoc.id, { id: endLoc.id, label: formatLocationLabel(endLoc) });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [segments]);

  // Filter segments that match the selected start/end locations
  const matchingSegments = useMemo(() => {
    if (!startLocationId || !endLocationId) return [];
    const startId = Number(startLocationId);
    const endId = Number(endLocationId);
    const locSet = new Set([startId, endId]);

    return segments.filter((s) => {
      const sStart = (s as any).startLocation?.id;
      const sEnd = (s as any).endLocation?.id;
      return sStart && sEnd && locSet.has(sStart) && locSet.has(sEnd);
    });
  }, [segments, startLocationId, endLocationId]);

  // Group matching segments into legs by (startLocationId, endLocationId)
  const legs = useMemo(() => {
    const map = new Map<string, { label: string; segments: SegmentApi[] }>();
    for (const seg of matchingSegments) {
      const sStart = (seg as any).startLocation;
      const sEnd = (seg as any).endLocation;
      if (!sStart?.id || !sEnd?.id) continue;
      const key = `${sStart.id}->${sEnd.id}`;
      if (!map.has(key)) {
        map.set(key, {
          label: `${formatLocationLabel(sStart)} → ${formatLocationLabel(sEnd)}`,
          segments: [],
        });
      }
      map.get(key)!.segments.push(seg);
    }
    // Sort legs by earliest segment start time
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
    if (includedSegmentIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const count = await optionsApi.combineAll(tripId, {
        tripId,
        startLocationId: Number(startLocationId),
        endLocationId: Number(endLocationId),
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
    setStartLocationId("");
    setEndLocationId("");
    setExcludedSegmentIds(new Set());
    setExcludedTypeIds(new Set());
    onClose();
  };

  const getSegmentTypeName = (typeId: number) => {
    return segmentTypes.find((t) => t.id === typeId)?.name ?? "Unknown";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="flex items-center gap-2">
          <CombineIcon className="h-5 w-5" />
          Combine All
        </DialogTitle>

        <div className="space-y-4 mt-2">
          {/* Location pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start location</Label>
              <Select value={startLocationId} onValueChange={setStartLocationId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>End location</Label>
              <Select value={endLocationId} onValueChange={setEndLocationId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Segment type filter */}
          {startLocationId && endLocationId && presentTypes.length > 0 && (
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
          {startLocationId && endLocationId && (
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
                              <span className="flex-1 truncate">
                                {seg.name}
                              </span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {getSegmentTypeName(seg.segmentTypeId)}
                              </span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDateStr(seg.startDateTimeUtc)}
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
