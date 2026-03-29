import type { ToolCall } from "./types"
import type { SegmentType, Currency, SegmentApi, OptionApi, SegmentSave, OptionSave } from "../types/models"
import { segmentsApi, optionsApi, geocodingApi, currencyApi } from "../utils/apiClient"
import { toLocationDto, normalizeLocation } from "../lib/mapping"

export interface ToolContext {
  tripId: number
  segmentTypes: SegmentType[]
  currencies: Currency[]
  segments: SegmentApi[]
  options: OptionApi[]
  preferredUtcOffset: number
}

interface ToolResult {
  success: boolean
  result: string
  mutated: boolean
}

export async function executeToolCall(
  toolCall: ToolCall,
  context: ToolContext
): Promise<ToolResult> {
  const { name, arguments: argsJson } = toolCall.function
  let args: Record<string, unknown>
  try {
    args = JSON.parse(argsJson)
  } catch {
    return { success: false, result: "Failed to parse tool arguments", mutated: false }
  }

  try {
    switch (name) {
      case "create_segment":
        return await createSegment(args, context)
      case "update_segment":
        return await updateSegment(args, context)
      case "delete_segment":
        return await deleteSegment(args, context)
      case "create_option":
        return await createOption(args, context)
      case "update_option":
        return await updateOption(args, context)
      case "delete_option":
        return await deleteOption(args, context)
      case "connect_segments_to_option":
        return await connectSegmentsToOption(args, context)
      case "list_segments":
        return listSegments(context)
      case "list_options":
        return listOptions(context)
      default:
        return { success: false, result: `Unknown tool: ${name}`, mutated: false }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, result: `Error: ${msg}`, mutated: false }
  }
}

const TYPE_ALIASES: Record<string, string> = {
  flight: "plane",
  accommodation: "hotel",
  apartment: "airbnb",
  rental: "car",
  coach: "bus",
}

function resolveSegmentTypeId(typeName: string, types: SegmentType[]): number | null {
  const lower = typeName.toLowerCase()
  const resolved = TYPE_ALIASES[lower] ?? lower
  const match = types.find((t) => t.name.toLowerCase() === resolved || t.shortName?.toLowerCase() === resolved || t.name.toLowerCase() === lower)
  return match?.id ?? null
}

function resolveCurrencyId(shortName: string, currencies: Currency[]): number | null {
  const lower = shortName.toLowerCase()
  const match = currencies.find((c) => c.shortName.toLowerCase() === lower)
  return match?.id ?? null
}

// Simple geocode cache to avoid duplicate calls for the same location name
const geocodeCache = new Map<string, ReturnType<typeof resolveLocationUncached>>()

async function resolveLocation(locationName: string) {
  if (!locationName) return null
  const key = locationName.toLowerCase().trim()
  if (!geocodeCache.has(key)) {
    geocodeCache.set(key, resolveLocationUncached(locationName))
  }
  return geocodeCache.get(key)!
}

async function resolveLocationUncached(locationName: string) {
  const results = await geocodingApi.search("/api/geocode/search", locationName)
  if (!results || results.length === 0) return null
  return toLocationDto(normalizeLocation(results[0]))
}

function toLocalIso(dateStr: string, utcOffset: number): string {
  // If the string already has timezone info, parse and convert
  // Otherwise treat as local time and create UTC from it
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr

  // Create a UTC time by subtracting the offset
  const utcMs = date.getTime() - utcOffset * 60 * 60 * 1000
  return new Date(utcMs).toISOString()
}

async function createSegment(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const typeName = args.segmentTypeName as string | undefined
  const segmentTypeId = typeName ? resolveSegmentTypeId(typeName, ctx.segmentTypes) : ctx.segmentTypes[0]?.id
  if (!segmentTypeId) {
    const available = ctx.segmentTypes.map((t) => t.name).join(", ") || "(none loaded)"
    return { success: false, result: `Unknown segment type: ${typeName}. Available types: ${available}`, mutated: false }
  }

  const currencyName = args.currencyShortName as string | undefined
  const currencyId = currencyName ? resolveCurrencyId(currencyName, ctx.currencies) : ctx.currencies[0]?.id
  if (currencyName && !currencyId) return { success: false, result: `Unknown currency: ${currencyName}`, mutated: false }

  const startOffset = (args.startUtcOffset as number) ?? ctx.preferredUtcOffset
  const endOffset = (args.endUtcOffset as number) ?? ctx.preferredUtcOffset

  const startLocation = args.startLocationName ? await resolveLocation(args.startLocationName as string) : null
  const endLocation = args.endLocationName ? await resolveLocation(args.endLocationName as string) : null

  const segmentName = (args.name as string) || "New Segment"
  const payload: SegmentSave = {
    tripId: ctx.tripId,
    name: segmentName,
    segmentTypeId: segmentTypeId,
    startDateTimeUtc: args.startDateTime ? toLocalIso(args.startDateTime as string, startOffset) : new Date().toISOString(),
    startDateTimeUtcOffset: startOffset,
    endDateTimeUtc: args.endDateTime ? toLocalIso(args.endDateTime as string, endOffset) : new Date().toISOString(),
    endDateTimeUtcOffset: endOffset,
    cost: (args.cost as number) ?? 0,
    currencyId: currencyId ?? 1,
    comment: (args.comment as string) ?? "",
    isUiVisible: true,
    startLocation: startLocation,
    endLocation: endLocation,
  }

  const result = await segmentsApi.create(ctx.tripId, payload)
  return {
    success: true,
    result: JSON.stringify({ message: `Created segment "${result?.name ?? segmentName}"${result?.id ? ` (ID: ${result.id})` : ""}` }),
    mutated: true,
  }
}

async function updateSegment(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const segmentId = args.segmentId as number
  const existing = ctx.segments.find((s) => s.id === segmentId)
  if (!existing) return { success: false, result: `Segment ${segmentId} not found`, mutated: false }

  let segmentTypeId = existing.segmentTypeId
  if (args.segmentTypeName) {
    const resolved = resolveSegmentTypeId(args.segmentTypeName as string, ctx.segmentTypes)
    if (!resolved) return { success: false, result: `Unknown segment type: ${args.segmentTypeName}`, mutated: false }
    segmentTypeId = resolved
  }

  let currencyId = existing.currencyId
  if (args.currencyShortName) {
    const resolved = resolveCurrencyId(args.currencyShortName as string, ctx.currencies)
    if (!resolved) return { success: false, result: `Unknown currency: ${args.currencyShortName}`, mutated: false }
    currencyId = resolved
  }

  const startOffset = (args.startUtcOffset as number) ?? existing.startDateTimeUtcOffset
  const endOffset = (args.endUtcOffset as number) ?? existing.endDateTimeUtcOffset

  const startLocation = args.startLocationName
    ? await resolveLocation(args.startLocationName as string)
    : existing.startLocation ? toLocationDto(normalizeLocation(existing.startLocation)) : null
  const endLocation = args.endLocationName
    ? await resolveLocation(args.endLocationName as string)
    : existing.endLocation ? toLocationDto(normalizeLocation(existing.endLocation)) : null

  const payload = {
    id: segmentId,
    tripId: ctx.tripId,
    name: (args.name as string) ?? existing.name,
    segmentTypeId,
    startDateTimeUtc: args.startDateTime ? toLocalIso(args.startDateTime as string, startOffset) : existing.startDateTimeUtc,
    startDateTimeUtcOffset: startOffset,
    endDateTimeUtc: args.endDateTime ? toLocalIso(args.endDateTime as string, endOffset) : existing.endDateTimeUtc,
    endDateTimeUtcOffset: endOffset,
    cost: (args.cost as number) ?? existing.cost,
    currencyId,
    comment: (args.comment as string) ?? existing.comment ?? "",
    isUiVisible: existing.isUiVisible,
    startLocation,
    endLocation,
  }

  const updatedName = (args.name as string) ?? existing.name
  await segmentsApi.update(ctx.tripId, payload)
  return {
    success: true,
    result: JSON.stringify({ message: `Updated segment "${updatedName}" (ID: ${segmentId})` }),
    mutated: true,
  }
}

async function deleteSegment(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const segmentId = args.segmentId as number
  const existing = ctx.segments.find((s) => s.id === segmentId)
  if (!existing) return { success: false, result: `Segment ${segmentId} not found in this trip`, mutated: false }
  await segmentsApi.remove(ctx.tripId, segmentId)
  return { success: true, result: `Deleted segment ${segmentId}`, mutated: true }
}

async function createOption(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const payload: OptionSave = {
    name: (args.name as string) || "New Option",
    tripId: ctx.tripId,
    isUiVisible: true,
    startDateTimeUtc: null,
    endDateTimeUtc: null,
    costPerDay: 0,
    costPerType: {},
  }

  const optionName = (args.name as string) || "New Option"
  const result = await optionsApi.create(ctx.tripId, payload)
  return {
    success: true,
    result: JSON.stringify({ message: `Created option "${result?.name ?? optionName}"${result?.id ? ` (ID: ${result.id})` : ""}` }),
    mutated: true,
  }
}

async function updateOption(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const optionId = args.optionId as number
  const existing = ctx.options.find((o) => o.id === optionId)
  if (!existing) return { success: false, result: `Option ${optionId} not found`, mutated: false }

  const payload = {
    id: optionId,
    name: (args.name as string) ?? existing.name,
    tripId: ctx.tripId,
    isUiVisible: existing.isUiVisible,
    startDateTimeUtc: existing.startDateTimeUtc,
    endDateTimeUtc: existing.endDateTimeUtc,
    costPerDay: existing.costPerDay,
    costPerType: existing.costPerType,
  }

  const updatedOptionName = (args.name as string) ?? existing.name
  await optionsApi.update(ctx.tripId, payload)
  return {
    success: true,
    result: JSON.stringify({ message: `Updated option "${updatedOptionName}" (ID: ${optionId})` }),
    mutated: true,
  }
}

async function deleteOption(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const optionId = args.optionId as number
  const existing = ctx.options.find((o) => o.id === optionId)
  if (!existing) return { success: false, result: `Option ${optionId} not found in this trip`, mutated: false }
  await optionsApi.remove(ctx.tripId, optionId)
  return { success: true, result: `Deleted option ${optionId}`, mutated: true }
}

async function connectSegmentsToOption(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const optionId = args.optionId as number
  const segmentIds = args.segmentIds as number[]

  if (!ctx.options.find((o) => o.id === optionId))
    return { success: false, result: `Option ${optionId} not found in this trip`, mutated: false }

  const unknownSegment = segmentIds.find((id) => !ctx.segments.some((s) => s.id === id))
  if (unknownSegment !== undefined)
    return { success: false, result: `Segment ${unknownSegment} not found in this trip`, mutated: false }

  await optionsApi.updateConnectedSegments(ctx.tripId, optionId, segmentIds)
  return {
    success: true,
    result: `Connected ${segmentIds.length} segment(s) to option ${optionId}`,
    mutated: true,
  }
}

function listSegments(ctx: ToolContext): ToolResult {
  const summary = ctx.segments.map((s) => ({
    id: s.id,
    name: s.name,
    segmentTypeId: s.segmentTypeId,
    typeName: ctx.segmentTypes.find((t) => t.id === s.segmentTypeId)?.name ?? "Unknown",
    startDateTimeUtc: s.startDateTimeUtc,
    endDateTimeUtc: s.endDateTimeUtc,
    cost: s.cost,
    currencyShortName: ctx.currencies.find((c) => c.id === s.currencyId)?.shortName ?? "?",
    startLocation: s.startLocation ? normalizeLocation(s.startLocation)?.name : null,
    endLocation: s.endLocation ? normalizeLocation(s.endLocation)?.name : null,
  }))
  return { success: true, result: JSON.stringify(summary), mutated: false }
}

function listOptions(ctx: ToolContext): ToolResult {
  const summary = ctx.options.map((o) => ({
    id: o.id,
    name: o.name,
    totalCost: o.totalCost,
    totalDays: o.totalDays,
  }))
  return { success: true, result: JSON.stringify(summary), mutated: false }
}
