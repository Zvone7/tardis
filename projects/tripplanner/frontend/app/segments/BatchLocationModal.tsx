"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { toast } from "../components/ui/use-toast";
import { Loader2, MapPinIcon } from "lucide-react";
import { Autocomplete } from "../components/RangeLocationPicker";
import { segmentsApi } from "../utils/apiClient";
import { toLocationDto } from "../lib/mapping";
import type { LocationOption } from "../types/models";

type UpdateTarget = "start" | "end" | "both";

interface BatchLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  selectedSegmentIds: number[];
  tripId: number;
}

export default function BatchLocationModal({
  isOpen,
  onClose,
  onComplete,
  selectedSegmentIds,
  tripId,
}: BatchLocationModalProps) {
  const [target, setTarget] = useState<UpdateTarget>("start");
  const [startLocation, setStartLocation] = useState<LocationOption | null>(null);
  const [endLocation, setEndLocation] = useState<LocationOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApply = async () => {
    const startDto = (target === "start" || target === "both") ? toLocationDto(startLocation) : null;
    const endDto = (target === "end" || target === "both") ? toLocationDto(endLocation) : null;

    if (!startDto && !endDto) return;

    setIsSubmitting(true);
    try {
      const count = await segmentsApi.batchUpdateLocations(tripId, {
        segmentIds: selectedSegmentIds,
        startLocation: startDto ?? undefined,
        endLocation: endDto ?? undefined,
      });
      toast({
        title: "Locations updated",
        description: `${count} segment(s) updated.`,
      });
      onComplete();
      handleClose();
    } catch (err) {
      console.error("Batch update locations failed:", err);
      toast({ title: "Error", description: "Failed to update locations. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStartLocation(null);
    setEndLocation(null);
    setTarget("start");
    onClose();
  };

  const hasLocation =
    (target === "start" && startLocation) ||
    (target === "end" && endLocation) ||
    (target === "both" && (startLocation || endLocation));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <MapPinIcon className="h-5 w-5" />
          Update Locations
        </DialogTitle>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Updating <strong>{selectedSegmentIds.length}</strong> segment(s)
          </p>

          {/* Target toggle */}
          <div className="space-y-1.5">
            <Label>What to update</Label>
            <div className="flex gap-2">
              {(["start", "end", "both"] as UpdateTarget[]).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={target === t ? "default" : "outline"}
                  onClick={() => setTarget(t)}
                  className="text-xs capitalize"
                >
                  {t === "both" ? "Both" : `${t} location`}
                </Button>
              ))}
            </div>
          </div>

          {/* Start location */}
          {(target === "start" || target === "both") && (
            <div className="space-y-1.5">
              <Label>Start location</Label>
              <Autocomplete
                id="batch-start-loc"
                placeholder="Search for a location..."
                selected={startLocation}
                onSelected={setStartLocation}
              />
            </div>
          )}

          {/* End location */}
          {(target === "end" || target === "both") && (
            <div className="space-y-1.5">
              <Label>End location</Label>
              <Autocomplete
                id="batch-end-loc"
                placeholder="Search for a location..."
                selected={endLocation}
                onSelected={setEndLocation}
              />
            </div>
          )}

          {/* Apply */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleApply}
              disabled={isSubmitting || !hasLocation}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
