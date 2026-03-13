"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { toast } from "../components/ui/use-toast";
import { Loader2, LinkIcon, UnlinkIcon } from "lucide-react";
import { optionsApi } from "../utils/apiClient";
import type { SegmentApi, SegmentType } from "../types/models";
import { cn } from "../lib/utils";

interface BatchConnectSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  selectedOptionIds: number[];
  tripId: number;
  segments: SegmentApi[];
  segmentTypes: SegmentType[];
}

export default function BatchConnectSegmentModal({
  isOpen,
  onClose,
  onComplete,
  selectedOptionIds,
  tripId,
  segments,
  segmentTypes,
}: BatchConnectSegmentModalProps) {
  const [connect, setConnect] = useState(true);
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const segmentTypeMap = useMemo(() => {
    const map = new Map<number, SegmentType>();
    segmentTypes.forEach((st) => map.set(st.id, st));
    return map;
  }, [segmentTypes]);

  const filteredSegments = useMemo(() => {
    const q = search.toLowerCase();
    return segments.filter((s) => {
      if (!q) return true;
      const name = (s.name ?? "").toLowerCase();
      const type = segmentTypeMap.get(s.segmentTypeId)?.shortName?.toLowerCase() ?? "";
      const startLoc = ((s as any).startLocation?.name ?? "").toLowerCase();
      const endLoc = ((s as any).endLocation?.name ?? "").toLowerCase();
      return name.includes(q) || type.includes(q) || startLoc.includes(q) || endLoc.includes(q);
    });
  }, [segments, search, segmentTypeMap]);

  const handleApply = async () => {
    if (selectedSegmentId == null) return;

    setIsSubmitting(true);
    try {
      const count = await optionsApi.batchConnectSegment(tripId, {
        optionIds: selectedOptionIds,
        segmentId: selectedSegmentId,
        connect,
      });
      toast({
        title: connect ? "Segment connected" : "Segment disconnected",
        description: `${count} option(s) updated.`,
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
    setSelectedSegmentId(null);
    setSearch("");
    setConnect(true);
    onClose();
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2">
          {connect ? <LinkIcon className="h-5 w-5" /> : <UnlinkIcon className="h-5 w-5" />}
          {connect ? "Connect" : "Disconnect"} Segment
        </DialogTitle>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Updating <strong>{selectedOptionIds.length}</strong> option(s)
          </p>

          {/* Connect / Disconnect toggle */}
          <div className="space-y-1.5">
            <Label>Action</Label>
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
          </div>

          {/* Segment picker */}
          <div className="space-y-1.5">
            <Label>Select a segment</Label>
            <input
              type="text"
              placeholder="Search segments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="max-h-60 overflow-y-auto rounded-md border">
              {filteredSegments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No segments found.</p>
              ) : (
                filteredSegments.map((segment) => {
                  const st = segmentTypeMap.get(segment.segmentTypeId);
                  const startLoc = (segment as any).startLocation;
                  const endLoc = (segment as any).endLocation;
                  const isSelected = selectedSegmentId === segment.id;
                  return (
                    <button
                      key={segment.id}
                      type="button"
                      onClick={() => setSelectedSegmentId(isSelected ? null : segment.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-b-0",
                        isSelected && "bg-accent ring-1 ring-primary"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{segment.name}</span>
                        {st && (
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">
                            {st.shortName}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(segment.startDateTimeUtc)}
                        {startLoc?.name && endLoc?.name && (
                          <span className="ml-2">{startLoc.name} → {endLoc.name}</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Apply */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleApply}
              disabled={isSubmitting || selectedSegmentId == null}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {connect ? "Connect" : "Disconnect"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
