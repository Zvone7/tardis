export type SegmentLocationCarrier = {
  startLocation?: any | null
  StartLocation?: any | null
  endLocation?: any | null
  EndLocation?: any | null
}

export const getStartLocation = (segment?: SegmentLocationCarrier | null) => {
  if (!segment) return null
  return segment.startLocation ?? segment.StartLocation ?? null
}

export const getEndLocation = (segment?: SegmentLocationCarrier | null) => {
  if (!segment) return null
  return segment.endLocation ?? segment.EndLocation ?? null
}

export const normalizeSegmentLocations = <T extends SegmentLocationCarrier>(
  segment: T,
  fallback?: SegmentLocationCarrier | null,
): T & Required<Pick<SegmentLocationCarrier, "startLocation" | "StartLocation" | "endLocation" | "EndLocation">> => {
  const start = getStartLocation(segment) ?? getStartLocation(fallback)
  const end = getEndLocation(segment) ?? getEndLocation(fallback)

  return {
    ...segment,
    startLocation: start ?? null,
    StartLocation: start ?? null,
    endLocation: end ?? null,
    EndLocation: end ?? null,
  }
}
