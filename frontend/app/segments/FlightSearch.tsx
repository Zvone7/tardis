"use client"

import React, { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog"
import { Label } from "../components/ui/label"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { ScrollArea } from "../components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Checkbox } from "../components/ui/checkbox"
import { Check, Loader2, Plane, ArrowLeftRight } from "lucide-react"
import type {
  AmadeusFlightOffer,
  AmadeusFlightOfferResponse,
  AmadeusFlightSearchRequest,
  AirportLookupResult,
  Segment,
  SegmentType,
} from "../types/models"
import { airportsApi, geocodingApi, scrapingApi, segmentsApi } from "../utils/apiClient"
import { toast } from "../components/ui/use-toast"
import { formatDateWithUserOffset, formatWeekdayDayMonth } from "../utils/dateformatters"
import { useCurrencies } from "../hooks/useCurrencies"
import { toLocationDto } from "../lib/mapping"

interface FlightSearchProps {
  isOpen: boolean
  onClose: () => void
  tripId: number
  tripCurrencyId?: number | null
  onSegmentCreated?: () => void
  segments?: Segment[]
  onViewSegment?: (segment: Segment) => void
  planeIconSvg?: string | null
}

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

function useDebounced<T>(val: T, delay: number) {
  const [d, setD] = useState(val)
  useEffect(() => {
    const t = setTimeout(() => setD(val), delay)
    return () => clearTimeout(t)
  }, [val, delay])
  return d
}

function formatAirportLabel(airport: AirportLookupResult) {
  const name = airport.name ? ` - ${airport.name}` : ""
  const city = airport.city ? airport.city : ""
  const country = airport.countryCode ? airport.countryCode : ""
  const place = [city, country].filter(Boolean).join(", ")
  const suffix = place ? ` (${place})` : ""
  return `${airport.code}${name}${suffix}`.trim()
}

function AirportAutocomplete({
  id,
  label,
  selected,
  onSelected,
  placeholder,
  minChars = 2,
  debounceMs = 350,
}: {
  id: string
  label: string
  selected: AirportLookupResult | null
  onSelected: (loc: AirportLookupResult | null) => void
  placeholder?: string
  minChars?: number
  debounceMs?: number
}) {
  const [query, setQuery] = useState(selected ? formatAirportLabel(selected) : "")
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AirportLookupResult[]>([])
  const [loading, setLoading] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const debounced = useDebounced(query, debounceMs)
  const suppressNextSearchRef = useRef(false)

  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      if (!root.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown)
    return () => document.removeEventListener("pointerdown", onDocPointerDown)
  }, [])

  useEffect(() => {
    if (selected) {
      setQuery(formatAirportLabel(selected))
    } else {
      setQuery("")
    }
  }, [selected])

  useEffect(() => {
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false
      return
    }

    const controller = new AbortController()
    const q = debounced.trim()
    if (q.length < minChars) {
      setItems([])
      setOpen(false)
      return
    }

    setLoading(true)
    ;(async () => {
      try {
        const list = await airportsApi.search(q, controller.signal)
        if (!controller.signal.aborted) {
          setItems(list)
          setOpen(true)
          setFocusedIdx(list.length ? 0 : -1)
        }
      } catch {
        if (!controller.signal.aborted) {
          setItems([])
          setOpen(false)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [debounced, minChars])

  const selectItem = (itm: AirportLookupResult) => {
    onSelected(itm)
    suppressNextSearchRef.current = true
    setQuery(formatAirportLabel(itm))
    setItems([])
    setFocusedIdx(-1)
    setOpen(false)
    inputRef.current?.blur()
  }

  const clearSelection = () => {
    onSelected(null)
    suppressNextSearchRef.current = true
    setQuery("")
    setItems([])
    setFocusedIdx(-1)
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <div ref={rootRef} className="relative">
        <Input
          id={id}
          ref={inputRef}
          placeholder={placeholder ?? "Search city, country"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (items.length) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setFocusedIdx((i) => Math.min(i + 1, items.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setFocusedIdx((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter") {
              if (focusedIdx >= 0 && items[focusedIdx]) {
                e.preventDefault()
                selectItem(items[focusedIdx])
              }
            } else if (e.key === "Escape") {
              setOpen(false)
            }
          }}
          className="text-sm"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          name={`${id}-search-${Math.random().toString(36).slice(2)}`}
        />

        {selected && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            title="Clear selection"
            aria-label="Clear location"
          >
            ×
          </button>
        )}

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow">
            <ScrollArea className="max-h-64">
              {loading ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
              ) : items.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
              ) : (
                <ul role="listbox" aria-labelledby={id}>
                  {items.map((itm, idx) => {
                    const labelText = formatAirportLabel(itm)
                    return (
                      <li
                        key={`${itm.code}-${itm.name}`}
                        role="option"
                        aria-selected={idx === focusedIdx}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectItem(itm)
                        }}
                        onMouseEnter={() => setFocusedIdx(idx)}
                        className={clsx(
                          "px-3 py-2 text-sm cursor-pointer",
                          idx === focusedIdx ? "bg-accent" : "hover:bg-accent/60",
                        )}
                        title={labelText || undefined}
                      >
                        {labelText}
                      </li>
                    )
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}

function formatOfferSummary(offer: AmadeusFlightOffer) {
  const itinerary = offer.itineraries?.[0]
  const segments = itinerary?.segments ?? []
  const first = segments[0]
  const last = segments.length ? segments[segments.length - 1] : undefined
  const route =
    first?.departure?.iataCode && last?.arrival?.iataCode
      ? `${first.departure.iataCode} → ${last.arrival.iataCode}`
      : "Route unavailable"
  const timeText = first?.departure?.at ? first.departure.at : "Time unavailable"
  const price = offer.price?.total
  const currency = offer.price?.currency
  const priceText = price && currency ? `${price} ${currency}` : "Price unavailable"
  const stops = segments.length > 1 ? `${segments.length - 1} stop${segments.length > 2 ? "s" : ""}` : "Direct"
  const carrierCode = first?.carrierCode ?? ""
  const flightNumber = first?.number ? ` ${first.number}` : ""
  return { route, timeText, priceText, stops, carrierCode, flightNumber }
}

export default function FlightSearch({
  isOpen,
  onClose,
  tripId,
  tripCurrencyId,
  onSegmentCreated,
  segments,
  onViewSegment,
  planeIconSvg,
}: FlightSearchProps) {
  const [startLocation, setStartLocation] = useState<AirportLookupResult | null>(null)
  const [endLocation, setEndLocation] = useState<AirportLookupResult | null>(null)
  const [startTime, setStartTime] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<AmadeusFlightOfferResponse | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [sortBy, setSortBy] = useState<"price" | "time">("price")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [directOnly, setDirectOnly] = useState(true)
  const { currencies } = useCurrencies()
  const [creatingOfferId, setCreatingOfferId] = useState<string | null>(null)
  const [createdOfferIds, setCreatedOfferIds] = useState<Set<string>>(new Set())
  const [updatingSegmentId, setUpdatingSegmentId] = useState<number | null>(null)
  const [updatedSegmentIds, setUpdatedSegmentIds] = useState<Set<number>>(new Set())
  const locationCacheRef = useRef<Map<string, ReturnType<typeof toLocationDto> | null>>(new Map())

  useEffect(() => {
    if (!isOpen) return
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const iso = tomorrow.toISOString().slice(0, 10)
    setStartTime((prev) => (prev ? prev : iso))
  }, [isOpen])

  const extractErrorMessage = (err: unknown) => {
    if (!(err instanceof Error)) return null
    const raw = err.message?.trim()
    if (!raw) return null
    if (raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw) as { error?: string }
        return parsed.error ?? raw
      } catch {
        return raw
      }
    }
    return raw
  }

  const handleSearch = async (overrideDate?: string) => {
    if (!startLocation || !endLocation) {
      toast({ title: "Missing locations", description: "Select both start and end locations." })
      return
    }
    const dateValue = overrideDate ?? startTime
    if (!dateValue) {
      toast({ title: "Missing start date", description: "Select a start date." })
      return
    }

    const payload: AmadeusFlightSearchRequest = {
      startLocation: {
        iataCode: startLocation.code,
      },
      endLocation: {
        iataCode: endLocation.code,
      },
      startDateTime: dateValue,
      adults: 1,
    }

    setIsLoading(true)
    setResults(null)
    try {
      const data = await scrapingApi.searchFlights(payload)
      setResults(data)
      setPage(1)
    } catch (err) {
      console.error("Flight search failed:", err)
      const message = extractErrorMessage(err)
      if (message && message.toLowerCase().includes("no airports found")) {
        toast({ title: "No locations found", description: "No nearby airports were found for the selected locations." })
        return
      }
      toast({ title: "Search failed", description: "Unable to fetch flight offers right now." })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [directOnly, sortBy, sortDir])

  const toLocalIso = (value?: string) => {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toISOString().slice(0, 16)
  }

  const toDateKey = (value?: string) => {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toISOString().slice(0, 10)
  }

  const extractIata = (value?: string | null) => {
    if (!value) return ""
    const match = value.match(/\b[A-Z]{3}\b/)
    return match ? match[0].toUpperCase() : ""
  }

  const getSegmentIatas = (segment: Segment) => {
    const fromName = extractIata((segment.startLocation as any)?.name)
    const toName = extractIata((segment.endLocation as any)?.name)
    if (fromName && toName) return { from: fromName, to: toName }

    const nameMatches = segment.name?.match(/\b[A-Z]{3}\b/g) ?? []
    return {
      from: nameMatches[0]?.toUpperCase() ?? "",
      to: nameMatches[1]?.toUpperCase() ?? "",
    }
  }

  const findMatchingSegment = (offer: AmadeusFlightOffer) => {
    if (!segments?.length) return null
    const offerSegments = offer.itineraries?.[0]?.segments ?? []
    const first = offerSegments[0]
    const last = offerSegments.length ? offerSegments[offerSegments.length - 1] : undefined
    const from = first?.departure?.iataCode?.toUpperCase() ?? ""
    const to = last?.arrival?.iataCode?.toUpperCase() ?? ""
    const offerStart = toDateKey(first?.departure?.at)
    const offerEnd = toDateKey(last?.arrival?.at)
    if (!from || !to || !offerStart) return null

    return (
      segments.find((segment) => {
        const codes = getSegmentIatas(segment)
        if (!codes.from || !codes.to) return false
        if (codes.from !== from || codes.to !== to) return false
        const segStart = toDateKey(segment.startDateTimeUtc)
        const segEnd = toDateKey(segment.endDateTimeUtc)
        if (segStart !== offerStart) return false
        if (offerEnd && segEnd && segEnd !== offerEnd) return false
        return true
      }) ?? null
    )
  }

  const getPriceDiffDisplay = (segment: Segment, offer: AmadeusFlightOffer) => {
    if (!offer.price?.total || !offer.price.currency) return null
    const offerPrice = Number(offer.price.total)
    if (!Number.isFinite(offerPrice) || offerPrice <= 0) return null
    const segmentCurrency = currencies.find((c) => c.id === segment.currencyId)?.shortName
    if (!segmentCurrency || segmentCurrency.toUpperCase() !== offer.price.currency.toUpperCase()) return null
    const diffPct = Math.abs((segment.cost - offerPrice) / offerPrice) * 100
    if (diffPct <= 3) return null
    return {
      oldPrice: segment.cost,
      newPrice: offerPrice,
      currency: offer.price.currency,
      isIncrease: offerPrice > segment.cost,
    }
  }

  const shiftDate = async (deltaDays: number) => {
    if (!startTime) return
    const base = new Date(startTime)
    if (Number.isNaN(base.getTime())) return
    base.setDate(base.getDate() + deltaDays)
    const next = base.toISOString().slice(0, 10)
    setStartTime(next)
    await handleSearch(next)
  }

  const swapLocations = () => {
    setStartLocation(endLocation)
    setEndLocation(startLocation)
  }

  const resolveCurrencyId = (code?: string) => {
    if (!code) return tripCurrencyId ?? null
    const match = currencies.find((c) => c.shortName?.toUpperCase() === code.toUpperCase())
    return match?.id ?? tripCurrencyId ?? null
  }

  const resolveLocationDto = async (airport: AirportLookupResult | null) => {
    if (!airport) return null
    const cacheKey = airport.code
    if (locationCacheRef.current.has(cacheKey)) {
      return locationCacheRef.current.get(cacheKey) ?? null
    }
    try {
      const airportResult = await geocodingApi.airport(airport.code)
      if (airportResult) {
        const dto = toLocationDto(airportResult)
        locationCacheRef.current.set(cacheKey, dto)
        return dto
      }

      const cityQuery = [airport.city, airport.countryCode].filter(Boolean).join(", ")
      const nameQuery = [airport.name, airport.countryCode].filter(Boolean).join(", ")
      const query = cityQuery || nameQuery
      if (!query) {
        locationCacheRef.current.set(cacheKey, null)
        return null
      }

      const results = await geocodingApi.search("/api/geocode/search", query)
      const dto = results.length ? toLocationDto(results[0]) : null
      locationCacheRef.current.set(cacheKey, dto)
      return dto
    } catch (error) {
      console.warn("LocationIQ lookup failed for airport:", airport.code, error)
      locationCacheRef.current.set(cacheKey, null)
      return null
    }
  }

  const handleCreateSegment = async (offer: AmadeusFlightOffer) => {
    const offerKey = offer.id ?? `${offer.price?.total ?? "price"}-${offer.itineraries?.[0]?.segments?.[0]?.departure?.at ?? "time"}`
    const segments = offer.itineraries?.[0]?.segments ?? []
    const first = segments[0]
    const last = segments.length ? segments[segments.length - 1] : undefined
    const start = toLocalIso(first?.departure?.at)
    const end = toLocalIso(last?.arrival?.at)
    if (!start || !end) {
      toast({ title: "Missing times", description: "This offer is missing departure/arrival times." })
      return
    }

    const currencyId = resolveCurrencyId(offer.price?.currency)
    if (!currencyId) {
      toast({ title: "Missing currency", description: "Unable to resolve currency for this offer." })
      return
    }

    const cost = offer.price?.total ? Number(offer.price.total) : 0
    const [startLoc, endLoc] = await Promise.all([
      resolveLocationDto(startLocation),
      resolveLocationDto(endLocation),
    ])

    const payload = {
      tripId,
      name: `${first?.departure?.iataCode ?? "?"} → ${last?.arrival?.iataCode ?? "?"}`,
      startDateTimeUtc: `${start}:00`,
      endDateTimeUtc: `${end}:00`,
      startDateTimeUtcOffset: 0,
      endDateTimeUtcOffset: 0,
      cost: Number.isFinite(cost) ? cost : 0,
      currencyId,
      segmentTypeId: 1,
      comment: "",
      startLocation: startLoc,
      endLocation: endLoc,
      isUiVisible: true,
    }

    setCreatingOfferId(offerKey)
    try {
      await segmentsApi.create(tripId, payload)
      toast({ title: "Segment created", description: "Flight offer added to your segments." })
      setCreatedOfferIds((prev) => new Set(prev).add(offerKey))
      onSegmentCreated?.()
    } catch (error) {
      console.error("Failed to create segment:", error)
      toast({ title: "Create failed", description: "Unable to create a segment from this offer." })
    } finally {
      setCreatingOfferId((prev) => (prev === offerKey ? null : prev))
    }
  }

  const handleUpdateSegment = async (segment: Segment, offer: AmadeusFlightOffer) => {
    const segments = offer.itineraries?.[0]?.segments ?? []
    const first = segments[0]
    const last = segments.length ? segments[segments.length - 1] : undefined
    const start = toLocalIso(first?.departure?.at)
    const end = toLocalIso(last?.arrival?.at)
    if (!start || !end) {
      toast({ title: "Missing times", description: "This offer is missing departure/arrival times." })
      return
    }

    const currencyId = resolveCurrencyId(offer.price?.currency) ?? segment.currencyId
    if (!currencyId) {
      toast({ title: "Missing currency", description: "Unable to resolve currency for this offer." })
      return
    }

    const cost = offer.price?.total ? Number(offer.price.total) : segment.cost
    const [startLoc, endLoc] = await Promise.all([
      resolveLocationDto(startLocation),
      resolveLocationDto(endLocation),
    ])

    const payload = {
      tripId,
      name: segment.name,
      startDateTimeUtc: `${start}:00`,
      endDateTimeUtc: `${end}:00`,
      startDateTimeUtcOffset: segment.startDateTimeUtcOffset ?? 0,
      endDateTimeUtcOffset: segment.endDateTimeUtcOffset ?? 0,
      cost: Number.isFinite(cost) ? cost : segment.cost,
      currencyId,
      segmentTypeId: segment.segmentTypeId ?? 1,
      comment: segment.comment ?? "",
      startLocation: startLoc ?? segment.startLocation ?? null,
      endLocation: endLoc ?? segment.endLocation ?? null,
      isUiVisible: segment.isUiVisible !== false,
    }

    setUpdatingSegmentId(segment.id)
    try {
      await segmentsApi.update(tripId, { ...payload, id: segment.id })
      toast({ title: "Segment updated", description: "Segment updated with latest offer data." })
      setUpdatedSegmentIds((prev) => new Set(prev).add(segment.id))
      onSegmentCreated?.()
    } catch (error) {
      console.error("Failed to update segment:", error)
      toast({ title: "Update failed", description: "Unable to update the segment from this offer." })
    } finally {
      setUpdatingSegmentId((prev) => (prev === segment.id ? null : prev))
    }
  }

  const formatFlightTimeRange = (departure?: string, arrival?: string) => {
    if (!departure) return "Time unavailable"
    const depDate = toDateKey(departure)
    const arrDate = arrival ? toDateKey(arrival) : ""
    const depDay = formatWeekdayDayMonth(departure, 0)
    const depTime = formatDateWithUserOffset(departure, 0, false).split(" ").pop() ?? ""
    const arrDay = arrival ? formatWeekdayDayMonth(arrival, 0) : ""
    const arrTime = arrival ? formatDateWithUserOffset(arrival, 0, false).split(" ").pop() ?? "" : ""
    if (!arrival || depDate === arrDate) {
      return `${depDay} ${depTime} → ${arrTime}`
    }
    return `${depDay} ${depTime} → ${arrDay} ${arrTime}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>Search flights</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <AirportAutocomplete
              id="flight-search-start"
              label="Start location"
              selected={startLocation}
              onSelected={setStartLocation}
              placeholder="Search an airport or city"
            />
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={swapLocations}
                disabled={!startLocation && !endLocation}
                aria-label="Swap locations"
                title="Swap locations"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            </div>
            <AirportAutocomplete
              id="flight-search-end"
              label="End location"
              selected={endLocation}
              onSelected={setEndLocation}
              placeholder="Search an airport or city"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flight-search-start-time" className="text-sm">
              Start date
            </Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => shiftDate(-1)} disabled={isLoading}>
                {"<"}
              </Button>
              <Input
                id="flight-search-start-time"
                type="date"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-40 text-sm dark:[color-scheme:light]"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => shiftDate(1)} disabled={isLoading}>
                {">"}
              </Button>
            </div>
            {startTime ? (
              <div className="text-xs text-muted-foreground">{formatWeekdayDayMonth(startTime, 0)}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="flight-search-direct-only"
              checked={directOnly}
              onCheckedChange={(value) => setDirectOnly(Boolean(value))}
            />
            <Label htmlFor="flight-search-direct-only" className="text-sm">
              Direct flights only
            </Label>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={() => handleSearch()} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Search flights"
              )}
            </Button>
          </div>

          {results && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="text-sm text-muted-foreground">
                {directOnly
                  ? `${results.data.filter((offer) => {
                      const segments = offer.itineraries?.[0]?.segments ?? []
                      return segments.length <= 1
                    }).length} (direct) option${
                      results.data.filter((offer) => {
                        const segments = offer.itineraries?.[0]?.segments ?? []
                        return segments.length <= 1
                      }).length === 1
                        ? ""
                        : "s"
                    } found`
                  : `${results.data.length} option${results.data.length === 1 ? "" : "s"} found`}
              </div>
              {results.data.length === 0 ? (
                <div className="text-sm text-muted-foreground">No offers returned for this search.</div>
              ) : (
                <>
                  <ScrollArea className="h-80 pr-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Route</TableHead>
                          <TableHead>Airline</TableHead>
                          <TableHead>
                            <button
                              type="button"
                              className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                              onClick={() => {
                                setSortBy("time")
                                setSortDir((d) => (sortBy === "time" && d === "asc" ? "desc" : "asc"))
                              }}
                            >
                              Time
                            </button>
                          </TableHead>
                          {!directOnly && <TableHead>Stops</TableHead>}
                          <TableHead>
                            <button
                              type="button"
                              className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                              onClick={() => {
                                setSortBy("price")
                                setSortDir((d) => (sortBy === "price" && d === "asc" ? "desc" : "asc"))
                              }}
                            >
                              Price
                            </button>
                          </TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.data
                          .filter((offer) => {
                            if (!directOnly) return true
                            const segments = offer.itineraries?.[0]?.segments ?? []
                            return segments.length <= 1
                          })
                          .map((offer) => {
                            const summary = formatOfferSummary(offer)
                            const numericPrice = offer.price?.total ? Number(offer.price.total) : Number.NaN
                            const departureTime = offer.itineraries?.[0]?.segments?.[0]?.departure?.at ?? ""
                            return { offer, summary, numericPrice, departureTime }
                          })
                          .sort((a, b) => {
                            if (sortBy === "price") {
                              const av = Number.isNaN(a.numericPrice) ? Number.MAX_VALUE : a.numericPrice
                              const bv = Number.isNaN(b.numericPrice) ? Number.MAX_VALUE : b.numericPrice
                              return sortDir === "asc" ? av - bv : bv - av
                            }
                            const at = a.departureTime ? new Date(a.departureTime).getTime() : 0
                            const bt = b.departureTime ? new Date(b.departureTime).getTime() : 0
                            return sortDir === "asc" ? at - bt : bt - at
                          })
                          .slice((page - 1) * pageSize, page * pageSize)
                          .map(({ offer, summary, departureTime }, idx) => {
                            const offerKey = offer.id ?? `${offer.price?.total ?? "price"}-${offer.itineraries?.[0]?.segments?.[0]?.departure?.at ?? "time"}`
                            const isCreating = creatingOfferId === offerKey
                            const isCreated = createdOfferIds.has(offerKey)
                            const matchedSegment = findMatchingSegment(offer)
                            const priceDiff = matchedSegment ? getPriceDiffDisplay(matchedSegment, offer) : null
                            const arrivalTime = offer.itineraries?.[0]?.segments?.slice(-1)[0]?.arrival?.at ?? ""
                            const isUpdating = matchedSegment ? updatingSegmentId === matchedSegment.id : false
                            const isUpdated = matchedSegment ? updatedSegmentIds.has(matchedSegment.id) : false
                            return (
                            <TableRow key={offer.id ?? `${offer.price?.total}-${idx}`}>
                              <TableCell className="font-medium">{summary.route}</TableCell>
                              <TableCell>
                                {summary.carrierCode ? (
                                  <div className="space-y-0.5">
                                    <div>
                                      {results.dictionaries?.carriers?.[summary.carrierCode] ?? summary.carrierCode}
                                    </div>
                                    {summary.flightNumber ? (
                                      <div className="text-xs text-muted-foreground">
                                        {summary.carrierCode}
                                        {summary.flightNumber}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  "Unknown"
                                )}
                              </TableCell>
                              <TableCell>
                                {departureTime ? formatFlightTimeRange(departureTime, arrivalTime) : summary.timeText}
                              </TableCell>
                              {!directOnly && <TableCell>{summary.stops}</TableCell>}
                              <TableCell>{summary.priceText}</TableCell>
                              <TableCell className="text-right">
                                {matchedSegment && priceDiff ? (
                                  <div className="mb-2 flex items-center justify-end gap-2 text-xs">
                                    <span className="text-muted-foreground line-through">
                                      {priceDiff.oldPrice} {priceDiff.currency}
                                    </span>
                                    <span className={priceDiff.isIncrease ? "text-red-600" : "text-green-600"}>
                                      {priceDiff.newPrice} {priceDiff.currency}
                                    </span>
                                  </div>
                                ) : null}
                                {matchedSegment ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      priceDiff
                                        ? handleUpdateSegment(matchedSegment, offer)
                                        : onViewSegment?.(matchedSegment)
                                    }
                                    disabled={isUpdating || isUpdated}
                                  >
                                    {priceDiff ? (
                                      isUpdated ? (
                                        <>
                                          <Check className="mr-2 h-4 w-4 text-green-600" />
                                          Updated
                                        </>
                                      ) : isUpdating ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Updating...
                                        </>
                                      ) : (
                                        "Update segment"
                                      )
                                    ) : (
                                      "Go to segment"
                                    )}
                                  </Button>
                                ) : isCreated ? (
                                  <div className="inline-flex items-center gap-1 text-green-600">
                                    <Check className="h-4 w-4" />
                                    <span className="text-xs">Created</span>
                                  </div>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCreateSegment(offer)}
                                    disabled={isCreating}
                                  >
                                    {isCreating ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                      </>
                                    ) : (
                                      <>
                                        Create{" "}
                                        {planeIconSvg ? (
                                          <span
                                            className="ml-2 h-3 w-3"
                                            dangerouslySetInnerHTML={{ __html: planeIconSvg }}
                                          />
                                        ) : (
                                          <Plane className="ml-2 h-3 w-3" />
                                        )}{" "}
                                        segment
                                      </>
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Page {page} of{" "}
                      {Math.max(
                        1,
                        Math.ceil(
                          results.data.filter((offer) => {
                            if (!directOnly) return true
                            const segments = offer.itineraries?.[0]?.segments ?? []
                            return segments.length <= 1
                          }).length / pageSize,
                        ),
                      )}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        Prev
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPage((p) =>
                            Math.min(
                              Math.ceil(
                                results.data.filter((offer) => {
                                  if (!directOnly) return true
                                  const segments = offer.itineraries?.[0]?.segments ?? []
                                  return segments.length <= 1
                                }).length / pageSize,
                              ),
                              p + 1,
                            ),
                          )
                        }
                        disabled={
                          page >=
                          Math.ceil(
                            results.data.filter((offer) => {
                              if (!directOnly) return true
                              const segments = offer.itineraries?.[0]?.segments ?? []
                              return segments.length <= 1
                            }).length / pageSize,
                          )
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
