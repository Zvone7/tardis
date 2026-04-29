"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { toast } from "../components/ui/use-toast";
import { Loader2, MapPinIcon } from "lucide-react";
import { RangeLocationPicker } from "../components/RangeLocationPicker";
import type { LocationOption } from "../types/models";
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
  const [editStart, setEditStart] = useState(false);
  const [editEnd, setEditEnd] = useState(false);
  const [startLoc, setStartLoc] = useState<LocationOption | null>(null);
  const [endLoc, setEndLoc] = useState<LocationOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canApply = (editStart && startLoc !== null) || (editEnd && endLoc !== null);

  const handleApply = async () => {
    if (!canApply) return;

    const startDto = editStart && startLoc ? toLocationDto(startLoc) : undefined;
    const endDto = editEnd && endLoc ? toLocationDto(endLoc) : undefined;

    setIsSubmitting(true);
    try {
      const count = await segmentsApi.batchUpdateLocations(tripId, {
        segmentIds: selectedSegmentIds,
        startLocation: startDto,
        endLocation: endDto,
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
    setEditStart(false);
    setEditEnd(false);
    setStartLoc(null);
    setEndLoc(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinIcon className="h-5 w-5" />
            Update locations
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Updating <strong>{selectedSegmentIds.length}</strong> segment(s). Toggle the fields you want to change.
        </p>

        <div className="space-y-5">
          {/* Start location */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                id="edit-start"
                checked={editStart}
                onCheckedChange={(v) => {
                  setEditStart(v);
                  if (!v) setStartLoc(null);
                }}
              />
              <Label htmlFor="edit-start" className="cursor-pointer">
                Update start location
              </Label>
            </div>
            {editStart && (
              <RangeLocationPicker
                id="batch-start"
                label=""
                value={{ start: startLoc, end: null }}
                onChange={(v) => setStartLoc(v.start)}
                singleMode
                compact
              />
            )}
          </div>

          {/* End location */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                id="edit-end"
                checked={editEnd}
                onCheckedChange={(v) => {
                  setEditEnd(v);
                  if (!v) setEndLoc(null);
                }}
              />
              <Label htmlFor="edit-end" className="cursor-pointer">
                Update end location
              </Label>
            </div>
            {editEnd && (
              <RangeLocationPicker
                id="batch-end"
                label=""
                value={{ start: endLoc, end: null }}
                onChange={(v) => setEndLoc(v.start)}
                singleMode
                compact
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={isSubmitting || !canApply}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
