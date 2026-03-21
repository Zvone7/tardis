"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { toast } from "../components/ui/use-toast";
import { Loader2, MapPinIcon } from "lucide-react";
import { RangeLocationPicker, type RangeLocationPickerValue } from "../components/RangeLocationPicker";
import { segmentsApi } from "../utils/apiClient";
import { toLocationDto } from "../lib/mapping";

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
  const [locRange, setLocRange] = useState<RangeLocationPickerValue>({
    start: null,
    end: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApply = async () => {
    const startDto = locRange.start ? toLocationDto(locRange.start) : null;
    const endDto = locRange.end ? toLocationDto(locRange.end) : null;

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
    setLocRange({ start: null, end: null });
    onClose();
  };

  const hasLocation = locRange.start || locRange.end;

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

          <RangeLocationPicker
            id="batch-loc"
            label=""
            value={locRange}
            onChange={setLocRange}
            compact
          />

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
