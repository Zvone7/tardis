"use client"

import type React from "react"
import type { JSX } from "react"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { ScrollArea } from "../components/ui/scroll-area"
import { Textarea } from "../components/ui/textarea"
import { toast } from "../components/ui/use-toast"
import { Checkbox } from "../components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "../components/ui/alert-dialog"
import {
  CopyIcon,
  SaveIcon,
  Trash2Icon,
  EyeOffIcon,
  EyeIcon,
  XIcon,
  AlertTriangle,
  Link2,
  Loader2,
  Calendar,
  Globe,
  Pencil,
  Plane,
} from "lucide-react"
import { toLocationDto, normalizeLocation } from "../lib/mapping"
import { Collapsible } from "../components/Collapsible"
import { cn } from "../lib/utils"
import { TitleTokens } from "../components/TitleTokens"
import { OptionFilterPanel, type OptionFilterValue } from "../components/filters/OptionFilterPanel"
import type { OptionSortValue } from "../components/sorting/optionSortTypes"

// types
import type {
  SegmentModalProps,
  OptionRef as Option,
  OptionApi,
  User,
  SegmentSave,
  LocationOption,
  SegmentType,
  SegmentApi,
  SegmentSuggestion,
} from "../types/models"

import { RangeDateTimePicker, type RangeDateTimePickerValue } from "../components/RangeDateTimePicker"

import { RangeLocationPicker, type RangeLocationPickerValue } from "../components/RangeLocationPicker"
import { useCurrencyConversions } from "../hooks/useCurrencyConversions"

import { localToUtcMs, utcMsToIso, utcIsoToLocalInput, formatLocalWithPreferredOffset, normalizeOffsetHours } from "../lib/utils"
import { buildOptionTitleTokens, buildOptionConfigFromApi, tokensToLabel } from "../utils/formatters"
import { optionsApi, segmentsApi, userApi } from "../utils/apiClient"
import { getDefaultCurrencyId, useCurrencies } from "../hooks/useCurrencies"
import { formatCurrencyAmount, formatConvertedAmount } from "../utils/currency"
import { CurrencyDropdown } from "../components/CurrencyDropdown"
import { applyOptionFilters, buildOptionMetadata } from "../services/optionFiltering"

const arraysEqual = (a: number[], b: number[]) => a.length === b.length && a.every((val, idx) => val === b[idx])

const toIsoFromLocalValue = (localValue: string | null, offset?: number | null) => {
  if (!localValue) return null
  if (typeof offset !== "number" || Number.isNaN(offset)) return null
  const ms = localToUtcMs(localValue, offset)
  if (!Number.isFinite(ms)) return null
  return utcMsToIso(ms)
}

/* ------------------------- comment preview helper ------------------------- */

const CommentDisplay: React.FC<{ text: string }> = ({ text }) => {
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  const urlRegex = /(https?:\/\/[^\s]+)/g

  let processedText = text
  const linkReplacements: { placeholder: string; element: JSX.Element }[] = []
  let replacementIndex = 0

  processedText = processedText.replace(markdownLinkRegex, (_match, linkText, url) => {
    const placeholder = `__LINK_${replacementIndex}__`
    linkReplacements.push({
      placeholder,
      element: (
        <a
          key={`md-${replacementIndex}`}
          href={String(url).trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {linkText}
        </a>
      ),
    })
    replacementIndex++
    return placeholder
  })

  processedText = processedText.replace(urlRegex, (match) => {
    const placeholder = `__LINK_${replacementIndex}__`
    linkReplacements.push({
      placeholder,
      element: (
        <a
          key={`url-${replacementIndex}`}
          href={match}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {match}
        </a>
      ),
    })
    replacementIndex++
    return placeholder
  })

  const parts = processedText.split(/(__LINK_\d+__)/g)

  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        const linkReplacement = linkReplacements.find((lr) => lr.placeholder === part)
        if (linkReplacement) return linkReplacement.element
        return <span key={index}>{part}</span>
      })}
    </div>
  )
}

const formatLocalDateTimeLabel = (value: string | null) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.replace("T", " ")
  }
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" })
  const datePart = date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const timePart = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  return `${weekday}, ${datePart} ${timePart}`
}

const formatLocationSummary = (loc: LocationOption | null) => {
  if (!loc) return ""
  if (loc.formatted) return loc.formatted
  const parts = [loc.name, loc.country].filter(Boolean)
  return parts.join(", ")
}

const isGoogleFlightsLink = (url: string) => {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname.includes("google.") &&
      parsed.pathname.toLowerCase().includes("/travel/flights")
    )
  } catch {
    return false
  }
}

/* ------------------------------- main modal ------------------------------- */

export default function SegmentModal({
  isOpen,
  onClose,
  onSave,
  segment,
  tripId,
  segmentTypes,
  tripCurrencyId,
  displayCurrencyId,
  initialOptionFilters,
  initialOptionSort,
}: SegmentModalProps) {
  const [name, setName] = useState("")
  const [range, setRange] = useState<RangeDateTimePickerValue>({
    startLocal: "",
    endLocal: null,
    startOffsetH: 0,
    endOffsetH: null,
  })

  // Keep prefilled locations to re-attach ids later
  const [prefilledStart, setPrefilledStart] = useState<LocationOption | null>(null)
  const [prefilledEnd, setPrefilledEnd] = useState<LocationOption | null>(null)

  const [locRange, setLocRange] = useState<RangeLocationPickerValue>({
    start: null,
    end: null,
  })
  const rangeStartLocal = range.startLocal
  const rangeEndLocal = range.endLocal
  const rangeStartOffsetH = range.startOffsetH
  const rangeEndOffsetH = range.endOffsetH
  const locRangeStart = locRange.start
  const locRangeEnd = locRange.end

  const [cost, setCost] = useState("")
  const [comment, setComment] = useState("")
  const [currencyId, setCurrencyId] = useState<number | null>(null)
  const [segmentTypeId, setSegmentTypeId] = useState<number | null>(null)
  const [options, setOptions] = useState<OptionApi[]>([])
  const [tripSegments, setTripSegments] = useState<SegmentApi[]>([])
  const [selectedOptions, setSelectedOptions] = useState<number[]>([])
  const [optionsTouched, setOptionsTouched] = useState(false)
  const optionsTouchedRef = useRef(optionsTouched)
  const [isDuplicateMode, setIsDuplicateMode] = useState(false)
  const [userPreferredOffset, setUserPreferredOffset] = useState<number>(0)
  const [userPreferredCurrencyId, setUserPreferredCurrencyId] = useState<number | null>(null)
  const [isUiVisible, setIsUiVisible] = useState(true)
  const [baselineReady, setBaselineReady] = useState(!segment)
  const [bookingUrl, setBookingUrl] = useState("")
  const [isImportingBooking, setIsImportingBooking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const isCreateMode = !segment || isDuplicateMode

  // State for delete confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // collapsible toggles
  const [generalOpen, setGeneralOpen] = useState(() => !segment)
  const [timesOpen, setTimesOpen] = useState(() => !segment)
  const [locationsOpen, setLocationsOpen] = useState(() => !segment)
  const [connectedOptionsOpen, setConnectedOptionsOpen] = useState(true)
  const [optionFilterState, setOptionFilterState] = useState<OptionFilterValue>({
    locations: [],
    dateRange: { start: "", end: "" },
    showHidden: false,
  })
  const [optionSortState, setOptionSortState] = useState<OptionSortValue | null>(null)
  const [optionConnections, setOptionConnections] = useState<Record<number, SegmentApi[]>>({})
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState("")
  const [showMissingShake, setShowMissingShake] = useState(false)
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false)
  const skipClosePromptRef = useRef(false)
  const tripSegmentsById = useMemo(() => {
    const map = new Map<number, SegmentApi>()
    tripSegments.forEach((segment) => {
      if (segment?.id) {
        map.set(segment.id, segment)
      }
    })
    return map
  }, [tripSegments])
  const latestOptionFiltersRef = useRef(initialOptionFilters)
  const latestOptionSortRef = useRef(initialOptionSort)

  const selectedSegmentType = useMemo(() => {
    if (segmentTypeId === null) return null
    return segmentTypes.find((type) => type.id === segmentTypeId) ?? null
  }, [segmentTypeId, segmentTypes])

  const { currencies, isLoading: isLoadingCurrencies } = useCurrencies()
  const { conversions } = useCurrencyConversions()
  const defaultCurrencyId = useMemo(() => getDefaultCurrencyId(currencies), [currencies])
  const resolvedDisplayCurrencyId = useMemo(() => {
    if (typeof displayCurrencyId === "number") return displayCurrencyId
    if (typeof tripCurrencyId === "number") return tripCurrencyId
    if (typeof userPreferredCurrencyId === "number" && userPreferredCurrencyId > 0) return userPreferredCurrencyId
    return defaultCurrencyId ?? null
  }, [displayCurrencyId, tripCurrencyId, userPreferredCurrencyId, defaultCurrencyId])
  const parsedCost = useMemo(() => {
    const trimmed = cost.trim()
    if (!trimmed) return Number.NaN
    const normalized = trimmed.replace(",", ".")
    try {
      if (/^[0-9+\-*/().\s]+$/.test(normalized)) {
        // eslint-disable-next-line no-new-func
        const fn = new Function(`return (${normalized})`)
        const result = Number(fn())
        if (Number.isFinite(result)) return result
      }
    } catch {
      // ignore parse errors; fall back to direct parse
    }
    return Number.parseFloat(normalized)
  }, [cost])
  const hasCostValue = Number.isFinite(parsedCost)
  const formattedSegmentCost = useMemo(() => {
    if (!hasCostValue || !currencyId) return null
    return formatCurrencyAmount(parsedCost, currencyId, currencies)
  }, [hasCostValue, parsedCost, currencyId, currencies])
  const userConversionLabel = useMemo(() => {
    if (!hasCostValue) return null
    if (!currencyId || !userPreferredCurrencyId || currencyId === userPreferredCurrencyId) return null
    return (
      formatConvertedAmount({
        amount: parsedCost,
        fromCurrencyId: currencyId,
        toCurrencyId: userPreferredCurrencyId,
        currencies,
        conversions,
      }) ?? null
    )
  }, [hasCostValue, parsedCost, currencyId, userPreferredCurrencyId, currencies, conversions])
  const tripConversionLabel = useMemo(() => {
    if (!hasCostValue) return null
    if (!currencyId || !tripCurrencyId) return null
    if (!userPreferredCurrencyId || tripCurrencyId === userPreferredCurrencyId) return null
    if (!userConversionLabel) return null
    return (
      formatConvertedAmount({
        amount: parsedCost,
        fromCurrencyId: currencyId,
        toCurrencyId: tripCurrencyId,
        currencies,
        conversions,
      }) ?? null
    )
  }, [
    hasCostValue,
    parsedCost,
    currencyId,
    tripCurrencyId,
    userPreferredCurrencyId,
    userConversionLabel,
    currencies,
    conversions,
  ])
  const optionMetadata = useMemo(() => {
    const flattened = Object.values(optionConnections).flat()
    const source = flattened.length ? flattened : tripSegments
    return buildOptionMetadata(source)
  }, [optionConnections, tripSegments])
  const generalCostLabel = useMemo(() => {
    if (formattedSegmentCost) return formattedSegmentCost
    if (hasCostValue) return parsedCost.toString()
    return null
  }, [formattedSegmentCost, hasCostValue, parsedCost])

  const generalSummaryTitle = useMemo(() => {
    const displayName = (name && name.trim()) || segment?.name || "New segment"
    const conversionLabel = userConversionLabel ?? tripConversionLabel ?? null
    return (
      <span className="flex items-start gap-3 text-sm">
        {selectedSegmentType?.iconSvg ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <span
              className="h-4 w-4"
              dangerouslySetInnerHTML={{ __html: selectedSegmentType.iconSvg }}
              suppressHydrationWarning
            />
          </span>
        ) : (
          <span className="text-xs font-semibold uppercase text-muted-foreground">SEG</span>
        )}
        <span className="flex flex-col leading-tight">
          <span className="font-semibold">{displayName}</span>
          {generalCostLabel ? <span className="text-sm text-foreground">{generalCostLabel}</span> : null}
          {conversionLabel ? <span className="text-xs text-muted-foreground">{conversionLabel}</span> : null}
        </span>
      </span>
    )
  }, [
    name,
    segment?.name,
    selectedSegmentType,
    generalCostLabel,
    userConversionLabel,
    tripConversionLabel,
  ])

  const timeSummaryTitle = useMemo(() => {
    const startLabel =
      formatLocalWithPreferredOffset(range.startLocal, range.startOffsetH, range.startOffsetH) || "Start not set"
    const endLabel = formatLocalWithPreferredOffset(
      range.endLocal,
      range.endOffsetH ?? range.startOffsetH,
      range.endOffsetH ?? range.startOffsetH,
    )
    return (
      <span className="flex items-center gap-2 text-sm">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span>{startLabel}</span>
        {endLabel ? (
          <>
            <span className="text-muted-foreground">→</span>
            <span>{endLabel}</span>
          </>
        ) : null}
      </span>
    )
  }, [range.startLocal, range.endLocal, range.startOffsetH, range.endOffsetH, userPreferredOffset])

  const locationSummaryTitle = useMemo(() => {
    const startLabel = formatLocationSummary(locRange.start) || "Start not set"
    const endLabel = formatLocationSummary(locRange.end)
    return (
      <span className="flex items-center gap-2 text-sm">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span>{startLabel}</span>
        {endLabel ? (
          <>
            <span className="text-muted-foreground">→</span>
            <span>{endLabel}</span>
          </>
        ) : null}
      </span>
    )
  }, [locRange.start, locRange.end])

  const connectedSummaryTitle = useMemo(() => {
    const count = selectedOptions.length
    const suffix = count === 1 ? "" : "s"
    return `Connected with ${count} option${suffix}`
  }, [selectedOptions.length])

  // Fetch user preferences (preferred offset)
  const fetchUserPreferences = useCallback(async () => {
    try {
      const userData: User = await userApi.getAccountInfo()
      setUserPreferredOffset(userData.userPreference?.preferredUtcOffset ?? 0)
      setUserPreferredCurrencyId(userData.userPreference?.preferredCurrencyId ?? null)
    } catch {
      setUserPreferredOffset(0)
      setUserPreferredCurrencyId(null)
    }
  }, [])

  useEffect(() => {
    fetchUserPreferences()
  }, [fetchUserPreferences])

  const fetchOptions = useCallback(async () => {
    try {
      const data = await optionsApi.getByTripId(tripId)
      setOptions(data)
    } catch (error) {
      console.error("Error fetching options:", error)
      toast({ title: "Error", description: "Failed to fetch options. Please try again." })
    }
  }, [tripId, toast])

  useEffect(() => {
    let active = true
    const loadSegments = async () => {
      try {
        const data = await segmentsApi.getByTripId(tripId)
        if (active) setTripSegments(data)
      } catch (error) {
        console.error("Error fetching trip segments:", error)
      }
    }
    loadSegments()
    return () => {
      active = false
    }
  }, [tripId])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  const applyBookingSuggestion = (suggestion: SegmentSuggestion) => {
    if (suggestion.name && !name) {
      setName(suggestion.name)
    }

    setRange((prev) => ({
      ...prev,
      startLocal: suggestion.startDateLocal ?? prev.startLocal,
      endLocal: suggestion.endDateLocal ?? prev.endLocal,
    }))

    const startLocation = suggestion.startLocation ?? suggestion.location
    if (startLocation) {
      const normalized = normalizeLocation(startLocation)
      if (normalized) {
        setLocRange((prev) => ({ ...prev, start: normalized }))
        setPrefilledStart(normalized)
      }
    } else if (suggestion.startLocationName || suggestion.locationName) {
      const startName = suggestion.startLocationName ?? suggestion.locationName
      const manualLocation: LocationOption = {
        name: startName ?? "",
        provider: "manual",
        providerPlaceId: startName ?? "",
        lat: 0,
        lng: 0,
      }
      setLocRange((prev) => ({ ...prev, start: manualLocation }))
      setPrefilledStart(manualLocation)
    }

    if (suggestion.endLocation) {
      const normalizedEnd = normalizeLocation(suggestion.endLocation)
      if (normalizedEnd) {
        setLocRange((prev) => ({ ...prev, end: normalizedEnd }))
        setPrefilledEnd(normalizedEnd)
      }
    } else if (suggestion.endLocationName) {
      const manualEnd: LocationOption = {
        name: suggestion.endLocationName,
        provider: "manual",
        providerPlaceId: suggestion.endLocationName,
        lat: 0,
        lng: 0,
      }
      setLocRange((prev) => ({ ...prev, end: manualEnd }))
      setPrefilledEnd(manualEnd)
    }

    if (typeof suggestion.cost === "number" && Number.isFinite(suggestion.cost)) {
      const costValue = suggestion.cost
      setCost((prev) => {
        if (prev && prev.trim().length) return prev
        return costValue.toString()
      })
    }

    if (suggestion.currencyCode) {
      const normalizedCode = suggestion.currencyCode.toUpperCase()
      const matchingCurrency = currencies.find(
        (currency) =>
          currency.shortName?.toUpperCase() === normalizedCode || currency.symbol?.toUpperCase() === normalizedCode,
      )
      if (matchingCurrency) {
        setCurrencyId((prev) => prev ?? matchingCurrency.id)
      }
    }

    if (typeof suggestion.segmentTypeId === "number") {
      setSegmentTypeId((prev) => prev ?? suggestion.segmentTypeId ?? null)
    }

    if (suggestion.sourceUrl) {
      setComment((prev) => {
        const label = suggestion.name ?? "Imported link"
        const formatted = `Link: [${label}](${suggestion.sourceUrl})`
        if (!prev) return formatted
        if (suggestion.sourceUrl && prev.includes(suggestion.sourceUrl)) return prev
        return `${prev}\n${formatted}`
      })
    }
  }

  const handleImportBookingLink = async () => {
    const trimmed = bookingUrl.trim()
    if (!trimmed) {
      toast({ title: "Paste a link", description: "Provide a Booking.com or Google Flights link before importing." })
      return
    }
    try {
      setIsImportingBooking(true)
      const suggestion = isGoogleFlightsLink(trimmed)
        ? await segmentsApi.parseFlightsLink(trimmed)
        : await segmentsApi.parseBookingLink(trimmed)
      applyBookingSuggestion(suggestion)
      toast({ title: "Link imported", description: "Details were added to the form." })
    } catch (error) {
      console.error("Failed to import booking link:", error)
      toast({ title: "Import failed", description: "Could not extract data from the provided link." })
    } finally {
      setIsImportingBooking(false)
    }
  }

  useEffect(() => {
    if (isCreateMode) {
      setGeneralOpen(true)
      setTimesOpen(true)
      setLocationsOpen(true)
      setConnectedOptionsOpen(true)
      return
    }
    if (segment?.id) {
      setGeneralOpen(false)
      setTimesOpen(false)
      setLocationsOpen(false)
      setConnectedOptionsOpen(false)
    }
  }, [isCreateMode, segment?.id])

  useEffect(() => {
    if (showDescriptionModal) {
      setDescriptionDraft(comment ?? "")
    }
  }, [showDescriptionModal, comment])

  useEffect(() => {
    return () => {
      if (missingShakeTimeoutRef.current) {
        clearTimeout(missingShakeTimeoutRef.current)
      }
    }
  }, [])

  const initialSelectedOptionsRef = useRef<number[] | null>(null)
  const missingShakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

type SegmentBaseline = {
    name: string
    startLocal: string
    endLocal: string | null
    startOffsetH: number
    endOffsetH: number | null
    cost: string
    comment: string
    segmentTypeId: number | null
    isUiVisible: boolean
    startLocation: LocationOption | null
    endLocation: LocationOption | null
    currencyId: number | null
  }

  const segmentBaselineRef = useRef<SegmentBaseline | null>(null)

  const buildSegmentBaseline = (
    segmentData: SegmentApi,
    displayOffsets?: { startOffsetH: number; endOffsetH: number | null },
  ): SegmentBaseline => {
    const rawSOff = normalizeOffsetHours(segmentData.startDateTimeUtcOffset ?? 0)
    const rawEOff = normalizeOffsetHours(segmentData.endDateTimeUtcOffset ?? rawSOff)
    const sOff = displayOffsets?.startOffsetH ?? rawSOff
    const eOff = displayOffsets?.endOffsetH ?? rawEOff
    const startLocalVal = utcIsoToLocalInput(segmentData.startDateTimeUtc, sOff)
    const endLocalRaw = utcIsoToLocalInput(segmentData.endDateTimeUtc, eOff)
    const endIsSame = segmentData.endDateTimeUtc === segmentData.startDateTimeUtc && eOff === sOff

    const startLocRaw = (segmentData as any)?.startLocation ?? (segmentData as any)?.startLocation
    const endLocRaw = (segmentData as any)?.endLocation ?? (segmentData as any)?.endLocation

    const startNorm = normalizeLocation(startLocRaw)
    const endNorm = normalizeLocation(endLocRaw)

    return {
      name: segmentData.name ?? "",
      startLocal: startLocalVal,
      endLocal: endIsSame ? null : endLocalRaw,
      startOffsetH: sOff,
      endOffsetH: endIsSame ? null : eOff,
      cost: String(segmentData.cost ?? ""),
      comment: segmentData.comment ?? "",
      segmentTypeId: segmentData.segmentTypeId ?? null,
      isUiVisible: (segmentData as any)?.isUiVisible ?? true,
      startLocation: startNorm ?? null,
      endLocation: endNorm ?? null,
      currencyId: segmentData.currencyId ?? null,
    }
  }

  const formatOptionCostForDisplay = useCallback(
    (option: OptionApi) => {
      if (option.totalCost === null || option.totalCost === undefined) return null
      return (
        formatConvertedAmount({
          amount: option.totalCost,
          fromCurrencyId: tripCurrencyId ?? null,
          toCurrencyId: resolvedDisplayCurrencyId,
          currencies,
          conversions,
        }) ?? formatCurrencyAmount(option.totalCost, tripCurrencyId ?? null, currencies)
      )
    },
    [tripCurrencyId, resolvedDisplayCurrencyId, currencies, conversions],
  )

  useEffect(() => {
    optionsTouchedRef.current = optionsTouched
  }, [optionsTouched])

  useEffect(() => {
    if (!tripId || options.length === 0) {
      setOptionConnections({})
      return
    }
    let cancelled = false
    const hydrateSegment = (segment: SegmentApi) => {
      const fallback = tripSegmentsById.get(segment.id)
      return {
        ...segment,
        startLocation: segment.startLocation ?? fallback?.startLocation ?? null,
        endLocation: segment.endLocation ?? fallback?.endLocation ?? null,
      }
    }
    const loadConnections = async () => {
      try {
        const entries = await Promise.all(
          options.map(async (option) => {
            try {
              const connected = await segmentsApi.getConnectedSegments(tripId, option.id)
              return [option.id, connected.map(hydrateSegment)] as const
            } catch (error) {
              console.error("Failed to fetch segments for option", option.id, error)
              return [option.id, []] as const
            }
          }),
        )
        if (!cancelled) {
          setOptionConnections(Object.fromEntries(entries))
        }
      } catch (error) {
        if (!cancelled) console.error("Failed to preload option connections", error)
      }
    }
    void loadConnections()
    return () => {
      cancelled = true
    }
  }, [tripId, options, tripSegmentsById])

  const fetchConnectedOptions = useCallback(
    async (segmentId: number) => {
      try {
        const data = await segmentsApi.getConnectedOptions(tripId, segmentId)
        const ids = data.map((o) => Number(o.id))

        if (!optionsTouchedRef.current) {
          setSelectedOptions(ids)
          initialSelectedOptionsRef.current = [...ids].sort((a, b) => a - b)
        }
        setBaselineReady(true)
      } catch (error) {
        console.error("Error fetching connected options:", error)
        toast({ title: "Error", description: "Failed to fetch connected options. Please try again." })
        setBaselineReady(true)
      }
    },
    [tripId, toast],
  )

  const resetToBlank = useCallback(() => {
    segmentBaselineRef.current = null
    initialSelectedOptionsRef.current = null
    setBaselineReady(true)
    setName("")
    const normalizedPreferred = normalizeOffsetHours(userPreferredOffset ?? 0)
    setRange({
      startLocal: "",
      endLocal: null,
      startOffsetH: normalizedPreferred,
      endOffsetH: null,
    })
    setPrefilledStart(null)
    setPrefilledEnd(null)
    setLocRange({ start: null, end: null })
    setCost("")
    setComment("")
    setSegmentTypeId(null)
    setSelectedOptions([])
    setIsUiVisible(true)
    setCurrencyId(null)
    setTimesOpen(true)
    setLocationsOpen(true)
    setOptionsTouched(false)
    setIsDuplicateMode(false)
    setBookingUrl("")
    setIsImportingBooking(false)
  }, [userPreferredOffset])

  useEffect(() => {
    if (!segment) return
    setIsDuplicateMode(false)
    setOptionsTouched(false)
    const sOffRaw = normalizeOffsetHours(segment.startDateTimeUtcOffset ?? 0)
    const eOffRaw = normalizeOffsetHours(segment.endDateTimeUtcOffset ?? sOffRaw)
    const displayStartOffset = sOffRaw
    const displayEndOffset = eOffRaw

    segmentBaselineRef.current = buildSegmentBaseline(segment, {
      startOffsetH: displayStartOffset,
      endOffsetH: displayEndOffset,
    })
    setBaselineReady(false)
    initialSelectedOptionsRef.current = null
    setName(segment.name)

    const startLocal = utcIsoToLocalInput(segment.startDateTimeUtc, displayStartOffset)
    const endLocalRaw = utcIsoToLocalInput(segment.endDateTimeUtc, displayEndOffset)

    const endIsSame = segment.endDateTimeUtc === segment.startDateTimeUtc && eOffRaw === sOffRaw

    setRange({
      startLocal,
      endLocal: endIsSame ? null : endLocalRaw,
      startOffsetH: displayStartOffset,
      endOffsetH: endIsSame ? null : displayEndOffset,
    })

    setCost(String(segment.cost))
    setComment(segment.comment || "")
    setSegmentTypeId(segment.segmentTypeId)
    setIsUiVisible((segment as any)?.isUiVisible ?? true)
    setCurrencyId(segment.currencyId ?? null)

    const startLocRaw = (segment as any)?.startLocation ?? (segment as any)?.startLocation
    const endLocRaw = (segment as any)?.endLocation ?? (segment as any)?.endLocation

    const startNorm = normalizeLocation(startLocRaw)
    const endNorm = normalizeLocation(endLocRaw)

    setPrefilledStart(startNorm ?? null)
    setPrefilledEnd(endNorm ?? null)

    setLocRange({
      start: startNorm ?? null,
      end: endNorm ?? null,
    })

    fetchConnectedOptions(segment.id)
  }, [segment, fetchConnectedOptions])

  useEffect(() => {
    if (segment) return
    if (!isOpen) return
    resetToBlank()
  }, [segment, isOpen, resetToBlank])

  const prevOpenRef = useRef<boolean>(isOpen)
  const prevSegmentIdRef = useRef<number | null>(segment?.id ?? null)
  useEffect(() => {
    const prevOpen = prevOpenRef.current
    const prevSegmentId = prevSegmentIdRef.current
    prevOpenRef.current = isOpen
    prevSegmentIdRef.current = segment?.id ?? null
    const justOpened = isOpen && !prevOpen
    const segmentChanged = isOpen && prevSegmentId !== (segment?.id ?? null)
    if (!justOpened && !segmentChanged) return
    const presetFilters = latestOptionFiltersRef.current
    if (presetFilters) {
      setOptionFilterState({
        locations: [...presetFilters.locations],
        dateRange: { ...presetFilters.dateRange },
        showHidden: presetFilters.showHidden,
      })
    } else {
      setOptionFilterState({
        locations: [],
        dateRange: { start: "", end: "" },
        showHidden: false,
      })
    }
    const presetSort = latestOptionSortRef.current
    if (presetSort === null) {
      setOptionSortState(null)
    } else if (presetSort) {
      setOptionSortState({ field: presetSort.field, direction: presetSort.direction })
    }
  }, [isOpen, segment?.id])

  useEffect(() => {
    if (!isDuplicateMode) return
    setOptionFilterState({
      locations: [],
      dateRange: { start: "", end: "" },
      showHidden: false,
    })
    setOptionSortState(null)
  }, [isDuplicateMode])

  useEffect(() => {
    if (segment) return
    if (currencyId !== null) return
    if (typeof userPreferredCurrencyId === "number" && userPreferredCurrencyId > 0) {
      setCurrencyId(userPreferredCurrencyId)
      return
    }
    if (typeof tripCurrencyId === "number" && tripCurrencyId > 0) {
      setCurrencyId(tripCurrencyId)
      return
    }
    if (defaultCurrencyId) {
      setCurrencyId(defaultCurrencyId)
    }
  }, [segment, currencyId, userPreferredCurrencyId, tripCurrencyId, defaultCurrencyId])

  const handleOptionChange = (optionId: number, checkedState: boolean | "indeterminate") => {
    const checked = checkedState === true
    setOptionsTouched(true)
    setSelectedOptions((prev) => {
      if (checked) return prev.includes(optionId) ? prev : [...prev, optionId]
      return prev.includes(optionId) ? prev.filter((id) => id !== optionId) : prev
    })
  }

  const handleUpdateConnectedOptions = useCallback(
    async (optionIds: number[]) => {
      if (!segment) return

      try {
        await segmentsApi.updateConnectedOptions(tripId, { SegmentId: segment.id, OptionIds: optionIds })
        toast({ title: "Success", description: "Connected options updated successfully" })
      } catch (error) {
        console.error("Error updating connected options:", error)
        toast({ title: "Error", description: "Failed to update connected options. Please try again." })
      }
    },
    [segment, tripId, toast],
  )

  const handleDuplicateSegment = () => {
    setName((n) => `DUPLICATE ${n}`)
    setIsDuplicateMode(true)
    setSelectedOptions([])
  }

  const handleDelete = async () => {
    if (!segment) return

    try {
      await segmentsApi.remove(tripId, segment.id)

      toast({
        title: "Success",
        description: "Segment deleted successfully",
      })

      setShowDeleteConfirm(false)
      closeModal()
      // Trigger a refresh if needed - you may need to add a callback prop
      window.location.reload()
    } catch (error) {
      console.error("Error deleting segment:", error)
      toast({
        title: "Error",
        description: "Failed to delete segment. Please try again.",
      })
    }
  }
  
  const filteredOptionsForDisplay = useMemo(() => {
    if (!segment || isDuplicateMode) return []
    return applyOptionFilters(options, optionFilterState, optionSortState, optionConnections)
  }, [segment, isDuplicateMode, options, optionFilterState, optionSortState, optionConnections])

  const hasChanges = useMemo(() => {
    if (isCreateMode) return true
    if (!segment || !baselineReady) return false

    const baseline = segmentBaselineRef.current
    const baselineOptions = initialSelectedOptionsRef.current
    if (!baseline || baselineOptions === null) return false

    if (baseline.name !== name) return true
    if (baseline.cost !== cost) return true
    if ((baseline.comment ?? "") !== (comment ?? "")) return true
    if ((baseline.segmentTypeId ?? null) !== (segmentTypeId ?? null)) return true
    if (baseline.isUiVisible !== isUiVisible) return true
    if ((baseline.currencyId ?? null) !== (currencyId ?? null)) return true

    if (baseline.startLocal !== rangeStartLocal) return true
    if ((baseline.endLocal ?? null) !== (rangeEndLocal ?? null)) return true
    if (baseline.startOffsetH !== rangeStartOffsetH) return true
    if ((baseline.endOffsetH ?? null) !== (rangeEndOffsetH ?? null)) return true

    const currentStartSig = JSON.stringify(locRangeStart ?? null)
    const baselineStartSig = JSON.stringify(baseline.startLocation ?? null)
    if (currentStartSig !== baselineStartSig) return true

    const currentEndSig = JSON.stringify(locRangeEnd ?? null)
    const baselineEndSig = JSON.stringify(baseline.endLocation ?? null)
    if (currentEndSig !== baselineEndSig) return true

    const sortedCurrentOptions = [...selectedOptions].sort((a, b) => a - b)
    if (!arraysEqual(sortedCurrentOptions, baselineOptions)) return true

    return false
  }, [
    isCreateMode,
    segment,
    baselineReady,
    name,
    cost,
    comment,
    segmentTypeId,
    isUiVisible,
    rangeStartLocal,
    rangeEndLocal,
    rangeStartOffsetH,
    rangeEndOffsetH,
    locRangeStart,
    locRangeEnd,
    selectedOptions,
    currencyId,
  ])
  const isSaveDisabled = isCreateMode ? false : (!baselineReady || !hasChanges)

  const createFormTouched = useMemo(() => {
    if (!isCreateMode) return false
    return Boolean(
      (name && name.trim()) ||
        (cost && cost.trim()) ||
        (comment && comment.trim()) ||
        segmentTypeId !== null ||
        rangeStartLocal ||
        rangeEndLocal ||
        locRangeStart ||
        locRangeEnd ||
        selectedOptions.length > 0 ||
        (bookingUrl && bookingUrl.trim()) ||
        isUiVisible === false ||
        currencyId !== null,
    )
  }, [
    isCreateMode,
    name,
    cost,
    comment,
    segmentTypeId,
    rangeStartLocal,
    rangeEndLocal,
    locRangeStart,
    locRangeEnd,
    selectedOptions.length,
    bookingUrl,
    isUiVisible,
    currencyId,
  ])

  const missingFieldMessages = useMemo(() => {
    const messages: string[] = []
    if (segmentTypeId === null) messages.push("Select a segment type")
    if (!rangeStartLocal) messages.push("Choose a start date and time")
    const parsedCost = Number.parseFloat(cost)
    if (!cost || Number.isNaN(parsedCost)) messages.push("Enter a valid cost amount")
    if (!currencyId && !isLoadingCurrencies) messages.push("Select a currency")
    return messages
  }, [segmentTypeId, rangeStartLocal, cost, currencyId, isLoadingCurrencies])

  const hasMissingFields = missingFieldMessages.length > 0
  const triggerMissingFieldsHint = useCallback(() => {
    if (missingShakeTimeoutRef.current) {
      clearTimeout(missingShakeTimeoutRef.current)
    }
    setShowMissingShake(true)
    missingShakeTimeoutRef.current = setTimeout(() => {
      setShowMissingShake(false)
      missingShakeTimeoutRef.current = null
    }, 450)
  }, [])
  useEffect(() => {
    latestOptionFiltersRef.current = initialOptionFilters
  }, [initialOptionFilters])
  useEffect(() => {
    latestOptionSortRef.current = initialOptionSort
  }, [initialOptionSort])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (isSaveDisabled || isSaving) return

      if (segmentTypeId === null) {
        triggerMissingFieldsHint()
        toast({ title: "Error", description: "Please select a segment type." })
        return
      }
      if (!rangeStartLocal) {
        triggerMissingFieldsHint()
        toast({ title: "Error", description: "Please choose a start date and time." })
        return
      }
      if (!cost || Number.isNaN(parsedCost)) {
        triggerMissingFieldsHint()
        toast({ title: "Error", description: "Please enter a valid cost amount." })
        return
      }

      const startUtcMs = localToUtcMs(rangeStartLocal, rangeStartOffsetH)
      if (!Number.isFinite(startUtcMs)) {
        toast({ title: "Error", description: "Invalid start date/time." })
        return
      }
      const localStartIso = `${rangeStartLocal}:00`

      const effEndOffset = rangeEndOffsetH ?? rangeStartOffsetH
      const endLocalUsed = rangeEndLocal ?? rangeStartLocal
      const endUtcMs = localToUtcMs(endLocalUsed, effEndOffset)
      if (!Number.isFinite(endUtcMs)) {
        toast({ title: "Error", description: "Invalid end date/time." })
        return
      }
      if (endUtcMs < startUtcMs) {
        toast({ title: "Error", description: "End must be at or after start." })
        return
      }

      const localEndIso = `${endLocalUsed}:00`

      const startForSave = locRangeStart ? { ...locRangeStart, id: prefilledStart?.id } : null
      const endForSave = locRangeEnd ? { ...locRangeEnd, id: prefilledEnd?.id } : null

      const currencyIdForSave = currencyId ?? userPreferredCurrencyId ?? tripCurrencyId ?? defaultCurrencyId
      if (!currencyIdForSave) {
        triggerMissingFieldsHint()
        toast({ title: "Error", description: "Select a currency before saving." })
        return
      }

      const payload: SegmentSave = {
        tripId,
        name,
        startDateTimeUtc: localStartIso,
        endDateTimeUtc: localEndIso,
        startDateTimeUtcOffset: rangeStartOffsetH,
        endDateTimeUtcOffset: effEndOffset,
        cost: parsedCost,
        currencyId: currencyIdForSave,
        segmentTypeId,
        comment,
        startLocation: toLocationDto(startForSave),
        endLocation: toLocationDto(endForSave),
        isUiVisible,
      }

      const isUpdate = !!segment && !isDuplicateMode
      const optionIds = selectedOptions.map(Number)

      setIsSaving(true)
      try {
        if (isUpdate && segment) await handleUpdateConnectedOptions(optionIds)
        await onSave(payload, isUpdate, segment?.id)
      } catch (err) {
        console.error("Save flow failed:", err)
        toast({ title: "Error", description: "Failed to save segment." })
      } finally {
        setIsSaving(false)
      }
    },
    [
      segmentTypeId,
      range.startLocal,
      range.endLocal,
      range.startOffsetH,
      range.endOffsetH,
      tripId,
      name,
      cost,
      comment,
      segment,
      isDuplicateMode,
      onSave,
      selectedOptions,
      locRangeStart,
      locRangeEnd,
      prefilledStart,
      prefilledEnd,
      isUiVisible,
      isSaveDisabled,
      isSaving,
      handleUpdateConnectedOptions,
      currencyId,
      userPreferredCurrencyId,
      tripCurrencyId,
      defaultCurrencyId,
      toast,
      triggerMissingFieldsHint,
      parsedCost,
    ],
  )

  const headerName = (name && name.trim()) || segment?.name || (isCreateMode ? "New segment" : "Segment")
  const headerSubtitle = isCreateMode ? "Creating new segment" : "Editing existing segment"
  const headerIcon = selectedSegmentType?.iconSvg ? (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
      <span
        className="h-5 w-5"
        dangerouslySetInnerHTML={{ __html: selectedSegmentType.iconSvg }}
        suppressHydrationWarning
      />
    </span>
  ) : (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-semibold uppercase">
      SEG
    </span>
  )



  const shouldPromptOnClose = isCreateMode ? createFormTouched : hasChanges

  const closeModal = useCallback(() => {
    skipClosePromptRef.current = true
    onClose()
  }, [onClose])

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) return
      if (skipClosePromptRef.current) {
        skipClosePromptRef.current = false
        return
      }
      if (shouldPromptOnClose) {
        setShowUnsavedConfirm(true)
      } else {
        closeModal()
      }
    },
    [shouldPromptOnClose, closeModal],
  )

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl w-full h-[85vh] p-0 flex flex-col overflow-hidden" style={{ display: "flex" }}>
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="sticky top-0 bg-background border-b px-4 py-3 z-10">
              <DialogTitle className="sr-only">{headerName}</DialogTitle>
              <div className="mb-3 space-y-1">
                <div className="flex items-center gap-3 text-lg font-semibold leading-snug">
                  {headerIcon}
                  <span>{headerName}</span>
                </div>
                <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {segment && !isDuplicateMode ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="h-9 w-9" aria-hidden />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isCreateMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="text-muted-foreground"
                      onClick={() =>
                        setIsUiVisible((prev) => {
                          const next = !prev
                          toast({
                            title: next ? "Will be shown in list view" : "Won't be shown in list view",
                          })
                          return next
                        })
                      }
                      aria-pressed={isUiVisible}
                    >
                      {isUiVisible ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
                    </Button>
                  )}
                  {segment && !isDuplicateMode && (
                    <Button type="button" variant="outline" size="sm" onClick={handleDuplicateSegment}>
                      <CopyIcon className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-primary hover:bg-primary/90"
                    disabled={isSaveDisabled || isSaving}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 relative min-h-0">
            {hasMissingFields && (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 sticky top-0 mt-0 z-10",
                  showMissingShake && "shake-once",
                )}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                <div>
                  <p className="font-medium">Missing required details</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {missingFieldMessages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <div className="rounded-lg border px-2 py-2 bg-muted/30">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 uppercase tracking-wide">
                    <span className="leading-none">Booking.com</span>
                  </div>
                  <div className="flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">
                    <Plane className="h-3 w-3" aria-hidden="true" />
                    <span className="leading-none">Google Flights</span>
                  </div>
                </div>
                <Input
                  id="booking-link"
                  value={bookingUrl}
                  onChange={(e) => setBookingUrl(e.target.value)}
                  placeholder="booking or flights link…"
                  autoComplete="off"
                  className="w-64 text-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleImportBookingLink}
                  disabled={isImportingBooking}
                  className="h-8 px-2 text-xs"
                >
                  {isImportingBooking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
                  Import
                </Button>
              </div>
            </div>
            <Collapsible
              title={generalSummaryTitle}
              open={generalOpen}
              onToggle={() => setGeneralOpen((open) => !open)}
            >
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-4 items-center gap-3">
                  <Label htmlFor="segmentType" className="text-right text-sm">
                    Type
                  </Label>
                  <Select
                    value={segmentTypeId?.toString() || ""}
                    onValueChange={(value) => setSegmentTypeId(Number.parseInt(value))}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {segmentTypes.map((type: SegmentType) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          <div className="flex items-center gap-2">
                            {type.iconSvg ? (
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/60 text-secondary-foreground shadow-sm ring-1 ring-black/5 dark:bg-white dark:text-black">
                                <span
                                  dangerouslySetInnerHTML={{ __html: type.iconSvg as string }}
                                  className="w-4 h-4"
                                  suppressHydrationWarning
                                />
                              </span>
                            ) : null}
                            <span>{type.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-start gap-3">
                  <Label htmlFor="cost" className="text-right text-sm pt-2 sm:pt-0">
                    Cost
                  </Label>
                  <div className="col-span-3 flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="cost"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      className="w-full sm:flex-1 font-mono"
                      required
                      placeholder="e.g. 2600/4 or 150+150"
                      inputMode="decimal"
                    />
                    <CurrencyDropdown
                      value={currencyId}
                      onChange={setCurrencyId}
                      currencies={currencies}
                      placeholder={isLoadingCurrencies ? "Loading..." : "Currency"}
                      disabled={isLoadingCurrencies}
                      className="w-full sm:w-[220px]"
                      triggerClassName="w-full"
                    />
                  </div>
                  {(userConversionLabel || tripConversionLabel) && (
                    <div className="col-span-3 col-start-2 text-xs text-muted-foreground">
                      {userConversionLabel ? <>≈ {userConversionLabel}</> : null}
                      {tripConversionLabel ? <span className="ml-1">({tripConversionLabel})</span> : null}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 items-start gap-3">
                  <Label className="text-right text-sm pt-2">Description & Links</Label>
                  <div className="col-span-3 space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowDescriptionModal(true)}
                      className="inline-flex items-center gap-2"
                    >
                      <Pencil className="h-4 w-4" />
                      {comment ? "Edit description" : "Add description"}
                    </Button>
                    {comment ? (
                      <div className="rounded-md border bg-muted/40 p-2 text-sm">
                        <CommentDisplay text={comment} />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No description added yet.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-3">
                  <Label htmlFor="name" className="text-right text-sm">
                    Nickname
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="col-span-3"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </Collapsible>

            <Collapsible title={timeSummaryTitle} open={timesOpen} onToggle={() => setTimesOpen((o) => !o)}>
              <div className="pt-4">
                <RangeDateTimePicker
                  id="segment-when"
                  label=""
                  value={range}
                  onChange={setRange}
                  allowDifferentOffsets
                  compact
                />
              </div>
            </Collapsible>

            <Collapsible title={locationSummaryTitle} open={locationsOpen} onToggle={() => setLocationsOpen((o) => !o)}>
              <div className="pt-4">
                <RangeLocationPicker id="segment-where" label="" value={locRange} onChange={setLocRange} compact />
              </div>
            </Collapsible>

            {segment && !isDuplicateMode && (
              <Collapsible
                title={connectedSummaryTitle}
                open={connectedOptionsOpen}
                onToggle={() => setConnectedOptionsOpen((o) => !o)}
              >
                <div className="pt-4">
                  <OptionFilterPanel
                    value={optionFilterState}
                    onChange={setOptionFilterState}
                    sort={optionSortState}
                    onSortChange={setOptionSortState}
                    availableLocations={optionMetadata.locations}
                    minDate={optionMetadata.dateBounds.min}
                    maxDate={optionMetadata.dateBounds.max}
                    className="mb-3"
                  />
                  <ScrollArea className="h-[150px] border rounded-md p-3">
                    {filteredOptionsForDisplay.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No options available.</p>
                    ) : (
                      filteredOptionsForDisplay.map((option) => {
                        const optionHidden = option.isUiVisible === false
                        const dimmed = optionFilterState.showHidden && optionHidden
                        const optionCostLabel = formatOptionCostForDisplay(option)
                        const optionConfig = buildOptionConfigFromApi(option)
                        const tokens = buildOptionTitleTokens({
                          ...optionConfig,
                          totalCost: optionCostLabel ?? optionConfig.totalCost,
                        })
                        const summaryLabel = tokensToLabel(tokens) || option.name

                        return (
                          <div
                            key={option.id}
                            className={cn(
                              "flex items-center justify-between rounded-md px-2 py-1 mb-2 last:mb-0",
                              dimmed && "bg-muted text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-3 w-full">
                              <Checkbox
                                id={`option-${option.id}`}
                                checked={selectedOptions.includes(Number(option.id))}
                                onCheckedChange={(checked) => handleOptionChange(Number(option.id), checked)}
                                aria-label={`Select ${summaryLabel}`}
                              />
                              <div className="flex flex-col flex-1 min-w-0" aria-label={summaryLabel}>
                                <TitleTokens tokens={tokens} size="sm" />
                                {optionCostLabel ? (
                                  <span className="text-xs text-muted-foreground">{optionCostLabel}</span>
                                ) : null}
                              </div>
                            </div>
                            {dimmed && <EyeOffIcon className="h-4 w-4" aria-hidden="true" />}
                          </div>
                        )
                      })
                    )}
                  </ScrollArea>
                </div>
              </Collapsible>
            )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDescriptionModal} onOpenChange={setShowDescriptionModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Description & links</DialogTitle>
            <DialogDescription>Add helpful context and link out to external resources.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="segment-description-editor">Description</Label>
              <Textarea
                id="segment-description-editor"
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                rows={8}
                placeholder="Write notes here. Use [Title](https://example.com) to add a link."
              />
              <p className="text-xs text-muted-foreground">
                Markdown links are supported. Pasting a raw URL will also render as a clickable link.
              </p>
            </div>
            <div className="space-y-2 rounded-md border bg-muted/40 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Preview</p>
              {descriptionDraft.trim() ? (
                <CommentDisplay text={descriptionDraft} />
              ) : (
                <p className="text-sm text-muted-foreground">Start typing to see how your notes will appear.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setShowDescriptionModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const normalized = descriptionDraft.trim()
                setComment(normalized)
                setShowDescriptionModal(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showUnsavedConfirm} onOpenChange={setShowUnsavedConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>If you close now, your unsaved edits will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedConfirm(false)}>Continue editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowUnsavedConfirm(false)
                closeModal()
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Segment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-700 hover:bg-red-800 text-white">
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
