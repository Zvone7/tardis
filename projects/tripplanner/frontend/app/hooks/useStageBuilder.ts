"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import type { SegmentApi } from "../types/models"
import type { Stage, StageLocation } from "../types/stages"
import { locationKeyOf, isTransitSegment } from "../lib/tripLocations"
import { normalizeLocation } from "../lib/mapping"

export function useStageBuilder(segments: SegmentApi[], selectedSegmentIds: number[]) {
  const [startingLocationKey, setStartingLocationKey] = useState<string | null>(null)
  const [activeStageIndex, setActiveStageIndex] = useState(0)

  const segmentMap = useMemo(() => {
    const map = new Map<number, SegmentApi>()
    segments.forEach((s) => map.set(s.id, s))
    return map
  }, [segments])

  // All unique start locations derived from all trip segments.
  // Primary dedup by lat,lng; secondary dedup by name+country to catch the same
  // city stored with slightly different coordinates across different searches.
  const availableStartLocations = useMemo((): StageLocation[] => {
    const byCoord = new Map<string, StageLocation>()
    segments.forEach((seg) => {
      const loc = normalizeLocation(seg.startLocation)
      if (!loc || !loc.name) return
      const key = `${loc.lat},${loc.lng}`
      if (!byCoord.has(key)) byCoord.set(key, { key, name: loc.name, country: loc.country })
    })
    // Second pass: deduplicate by "name, country" (case-insensitive)
    const byName = new Map<string, StageLocation>()
    byCoord.forEach((loc) => {
      const nameKey = `${loc.name.toLowerCase()}|${(loc.country ?? "").toLowerCase()}`
      if (!byName.has(nameKey)) byName.set(nameKey, loc)
    })
    return Array.from(byName.values())
  }, [segments])

  // Derive stage location label from key, falling back to raw key if not found in list
  const getStageLocation = useCallback(
    (key: string): StageLocation => {
      return (
        availableStartLocations.find((l) => l.key === key) ?? {
          key,
          name: key,
          country: undefined,
        }
      )
    },
    [availableStartLocations],
  )

  // Build the ordered stage chain from startingLocationKey + selectedSegmentIds
  const stages = useMemo((): Stage[] => {
    if (!startingLocationKey) return []

    const result: Stage[] = []
    let currentKey: string | null = startingLocationKey
    const visitedKeys = new Set<string>()

    while (currentKey && !visitedKeys.has(currentKey)) {
      visitedKeys.add(currentKey)

      const stageSelectedIds = selectedSegmentIds.filter((id) => {
        const seg = segmentMap.get(id)
        return seg !== undefined && locationKeyOf(seg.startLocation) === currentKey
      })

      result.push({
        index: result.length,
        location: getStageLocation(currentKey),
        selectedSegmentIds: stageSelectedIds,
      })

      // One transit per stage: find the first selected segment that moves to a new location
      const transitSeg = stageSelectedIds
        .map((id) => segmentMap.get(id))
        .filter((s): s is SegmentApi => s !== undefined)
        .find((s) => isTransitSegment(s, currentKey!))

      if (transitSeg) {
        currentKey = locationKeyOf(transitSeg.endLocation)
      } else {
        break
      }
    }

    return result
  }, [startingLocationKey, selectedSegmentIds, segmentMap, getStageLocation])

  // Auto-detect starting location when connected segments load for the first time
  useEffect(() => {
    if (startingLocationKey !== null || selectedSegmentIds.length === 0 || segments.length === 0) return
    const selected = selectedSegmentIds
      .map((id) => segmentMap.get(id))
      .filter((s): s is SegmentApi => s !== undefined)
      .filter((s) => Boolean(s.startDateTimeUtc))
      .sort((a, b) => new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime())
    if (selected.length > 0) {
      const key = locationKeyOf(selected[0].startLocation)
      if (key) setStartingLocationKey(key)
    }
  }, [selectedSegmentIds, segments, segmentMap, startingLocationKey])

  // Reset stage state when the option being edited changes (selectedSegmentIds cleared)
  const prevLengthRef = { current: selectedSegmentIds.length }
  useEffect(() => {
    if (selectedSegmentIds.length === 0 && prevLengthRef.current > 0) {
      setStartingLocationKey(null)
      setActiveStageIndex(0)
    }
    prevLengthRef.current = selectedSegmentIds.length
  })

  // All trip segments available for a given stage (by start location match)
  const getStageSegments = useCallback(
    (stageIndex: number): SegmentApi[] => {
      const stage = stages[stageIndex]
      if (!stage) return []
      return segments.filter((s) => locationKeyOf(s.startLocation) === stage.location.key)
    },
    [stages, segments],
  )

  // Latest end time of any selected segment in stages before stageIndex
  const getEarliestAllowedDeparture = useCallback(
    (stageIndex: number): Date | null => {
      if (stageIndex === 0) return null
      let latestArrival: Date | null = null
      for (let i = 0; i < stageIndex; i++) {
        const stage = stages[i]
        if (!stage) continue
        stage.selectedSegmentIds.forEach((id) => {
          const seg = segmentMap.get(id)
          if (seg?.endDateTimeUtc) {
            const dt = new Date(seg.endDateTimeUtc)
            if (!latestArrival || dt > latestArrival) latestArrival = dt
          }
        })
      }
      return latestArrival
    },
    [stages, segmentMap],
  )

  // Returns updated selectedSegmentIds after toggling a segment within a stage.
  // Enforces one-transit-per-stage: selecting a new transit replaces the old one
  // and clears all selections from later stages.
  const toggleSegment = useCallback(
    (segmentId: number, checked: boolean, stageIndex: number): number[] => {
      const stage = stages[stageIndex]
      const seg = segmentMap.get(segmentId)
      if (!stage || !seg) return selectedSegmentIds

      if (checked) {
        if (isTransitSegment(seg, stage.location.key)) {
          // Find any existing transit in this stage
          const existingTransit = stage.selectedSegmentIds
            .map((id) => segmentMap.get(id))
            .filter((s): s is SegmentApi => s !== undefined)
            .find((s) => isTransitSegment(s, stage.location.key))

          if (existingTransit) {
            // Remove existing transit + all subsequent stage selections, then add new transit
            const toRemove = new Set<number>([existingTransit.id])
            for (let i = stageIndex + 1; i < stages.length; i++) {
              stages[i].selectedSegmentIds.forEach((id) => toRemove.add(id))
            }
            return [...selectedSegmentIds.filter((id) => !toRemove.has(id)), segmentId]
          }
        }
        return selectedSegmentIds.includes(segmentId) ? selectedSegmentIds : [...selectedSegmentIds, segmentId]
      } else {
        if (isTransitSegment(seg, stage.location.key)) {
          // Remove this transit + all subsequent stage selections
          const toRemove = new Set<number>([segmentId])
          for (let i = stageIndex + 1; i < stages.length; i++) {
            stages[i].selectedSegmentIds.forEach((id) => toRemove.add(id))
          }
          return selectedSegmentIds.filter((id) => !toRemove.has(id))
        }
        return selectedSegmentIds.filter((id) => id !== segmentId)
      }
    },
    [stages, segmentMap, selectedSegmentIds],
  )

  return {
    stages,
    startingLocationKey,
    setStartingLocationKey,
    activeStageIndex,
    setActiveStageIndex,
    availableStartLocations,
    getStageSegments,
    getEarliestAllowedDeparture,
    toggleSegment,
  }
}
