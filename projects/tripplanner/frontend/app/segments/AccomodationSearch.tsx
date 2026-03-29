"use client"

import React, { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog"
import { Label } from "../components/ui/label"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { ScrollArea } from "../components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Loader2 } from "lucide-react"
import type {
  AmadeusHotelOffer,
  AmadeusHotelOfferResponse,
  AmadeusHotelSearchRequest,
  LocationOption,
} from "../types/models"
import { geocodingApi, scrapingApi, segmentsApi } from "../utils/apiClient"
import { toast } from "../components/ui/use-toast"
import { formatWeekdayDayMonth } from "../utils/dateformatters"
import { toLocationDto } from "../lib/mapping"
import { matchTripLocations, tripViewbox } from "../lib/tripLocations"

interface AccomodationSearchProps {
  isOpen: boolean
  onClose: () => void
  tripId: number
  tripCurrencyId?: number | null
  onSegmentCreated?: () => void
  existingLocations?: LocationOption[]
}

function useDebounced<T>(val: T, delay: number) {
  const [d, setD] = useState(val)
  useEffect(() => {
    const t = setTimeout(() => setD(val), delay)
    return () => clearTimeout(t)
  }, [val, delay])
  return d
}

function LocationAutocomplete({
  id,
  label,
  selected,
  onSelected,
  placeholder,
  minChars = 2,
  debounceMs = 350,
  existingLocations,
}: {
  id: string
  label: string
  selected: LocationOption | null
  onSelected: (loc: LocationOption | null) => void
  placeholder?: string
  minChars?: number
  debounceMs?: number
  existingLocations?: LocationOption[]
}) {
  const [query, setQuery] = useState(selected?.formatted || selected?.name || "")
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<LocationOption[]>([])
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
      setQuery(selected.formatted || selected.name)
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
        const vb = tripViewbox(existingLocations ?? [])
        const list = await geocodingApi.search("/api/geocode/search", q, controller.signal, vb)
        if (!controller.signal.aborted) {
          const existing = matchTripLocations(q, existingLocations ?? [])
          const existingKeys = new Set(existing.map((l) => `${l.lat},${l.lng}`))
          const merged = [...existing, ...list.filter((l) => !existingKeys.has(`${l.lat},${l.lng}`))]
          setItems(merged)
          setOpen(true)
          setFocusedIdx(merged.length ? 0 : -1)
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
  }, [debounced, minChars, existingLocations])

  const selectItem = (itm: LocationOption) => {
    onSelected(itm)
    suppressNextSearchRef.current = true
    setQuery(itm.formatted || itm.name)
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
          placeholder={placeholder ?? "Search city"}
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
                    const labelText = itm.formatted || (itm.country ? `${itm.name}, ${itm.country}` : itm.name)
                    return (
                      <li
                        key={itm.providerPlaceId ? `${itm.provider}-${itm.providerPlaceId}` : `${itm.lat},${itm.lng}`}
                        role="option"
                        aria-selected={idx === focusedIdx}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectItem(itm)
                        }}
                        onMouseEnter={() => setFocusedIdx(idx)}
                        className={`px-3 py-2 text-sm cursor-pointer ${
                          idx === focusedIdx ? "bg-accent" : "hover:bg-accent/60"
                        }`}
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

function formatOfferLabel(offer: AmadeusHotelOffer) {
  const name = offer.hotel?.name ?? "Hotel"
  const city = offer.hotel?.address?.cityName ?? offer.hotel?.cityCode ?? ""
  const country = offer.hotel?.address?.countryCode ?? ""
  const place = [city, country].filter(Boolean).join(", ")
  return place ? `${name} (${place})` : name
}

export default function AccomodationSearch({ isOpen, onClose, tripId, tripCurrencyId, onSegmentCreated, existingLocations }: AccomodationSearchProps) {
  const [location, setLocation] = useState<LocationOption | null>(null)
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [adults, setAdults] = useState(1)
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<AmadeusHotelOfferResponse | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [creatingHotelKey, setCreatingHotelKey] = useState<string | null>(null)
  const [createdHotelKeys, setCreatedHotelKeys] = useState<Set<string>>(new Set())
  const locationCacheRef = useRef<Map<string, ReturnType<typeof toLocationDto> | null>>(new Map())

  useEffect(() => {
    if (!isOpen) return
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextDay = new Date(tomorrow)
    nextDay.setDate(nextDay.getDate() + 1)
    if (!checkIn) setCheckIn(tomorrow.toISOString().slice(0, 10))
    if (!checkOut) setCheckOut(nextDay.toISOString().slice(0, 10))
  }, [isOpen, checkIn, checkOut])

  useEffect(() => {
    setPage(1)
  }, [results])

  const handleSearch = async () => {
    if (!location) {
      toast({ title: "Missing location", description: "Select a destination city." })
      return
    }
    if (!checkIn || !checkOut) {
      toast({ title: "Missing dates", description: "Select check-in and check-out dates." })
      return
    }

    const cityCode = (await scrapingApi.resolveCityCode(location.name, location.countryCode))?.trim() || null
    const payload: AmadeusHotelSearchRequest = {
      cityName: location.name,
      cityCode: cityCode ?? undefined,
      countryCode: location.countryCode,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults,
    }

    setIsLoading(true)
    setResults(null)
    try {
      const data = await scrapingApi.searchHotels(payload)
      setResults(data)
    } catch (err) {
      console.error("Hotel search failed:", err)
      toast({ title: "Search failed", description: "Unable to fetch accommodations right now." })
    } finally {
      setIsLoading(false)
    }
  }

  const resolveLocationDto = async () => {
    const city = location?.name
    const country = location?.countryCode
    if (!city) return null
    const cacheKey = `${city}-${country ?? ""}`
    if (locationCacheRef.current.has(cacheKey)) {
      return locationCacheRef.current.get(cacheKey) ?? null
    }
    try {
      const results = await geocodingApi.search("/api/geocode/search", [city, country].filter(Boolean).join(", "))
      const dto = results.length ? toLocationDto(results[0]) : null
      locationCacheRef.current.set(cacheKey, dto)
      return dto
    } catch (error) {
      console.warn("LocationIQ lookup failed for hotel city:", cacheKey, error)
      locationCacheRef.current.set(cacheKey, null)
      return null
    }
  }

  const resolveCurrencyId = (code?: string) => {
    if (!code) return tripCurrencyId ?? null
    return tripCurrencyId ?? null
  }

  const handleCreateSegment = async (offer: AmadeusHotelOffer) => {
    const hotelKey = `${offer.hotel?.name ?? "hotel"}-${offer.hotel?.address?.cityName ?? ""}`
    const firstOffer = offer.offers?.[0]
    const price = firstOffer?.price?.total ? Number(firstOffer.price.total) : 0
    const currencyId = resolveCurrencyId(firstOffer?.price?.currency)
    if (!currencyId) {
      toast({ title: "Missing currency", description: "Unable to resolve currency for this offer." })
      return
    }
    if (!checkIn || !checkOut) {
      toast({ title: "Missing dates", description: "Select check-in and check-out dates." })
      return
    }

    const cityLocation = await resolveLocationDto()
    const payload = {
      tripId,
      name: "",
      startDateTimeUtc: `${checkIn}T00:00:00`,
      endDateTimeUtc: `${checkOut}T00:00:00`,
      startDateTimeUtcOffset: 0,
      endDateTimeUtcOffset: 0,
      cost: Number.isFinite(price) ? price : 0,
      currencyId,
      segmentTypeId: 6,
      comment: "",
      startLocation: cityLocation,
      endLocation: null,
      isUiVisible: true,
    }

    setCreatingHotelKey(hotelKey)
    try {
      await segmentsApi.create(tripId, payload)
      toast({ title: "Segment created", description: "Accommodation offer added to your segments." })
      setCreatedHotelKeys((prev) => new Set(prev).add(hotelKey))
      onSegmentCreated?.()
    } catch (error) {
      console.error("Failed to create segment:", error)
      toast({ title: "Create failed", description: "Unable to create a segment from this offer." })
    } finally {
      setCreatingHotelKey((prev) => (prev === hotelKey ? null : prev))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>Search accommodations</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <LocationAutocomplete
            id="accommodation-search-location"
            label="Destination"
            selected={location}
            onSelected={setLocation}
            placeholder="Search a city"
            existingLocations={existingLocations}
          />
          <div className="text-xs text-muted-foreground">
            Stay search locations are limited to cities mapped from our airport dataset. You can always search manually on{" "}
            <a
              href="https://www.booking.com"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              Booking.com
            </a>{" "}
            and use that link when creating segments.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="accommodation-checkin" className="text-sm">
                Check-in
              </Label>
              <Input
                id="accommodation-checkin"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="text-sm dark:[color-scheme:light]"
              />
              {checkIn ? <div className="text-xs text-muted-foreground">{formatWeekdayDayMonth(checkIn, 0)}</div> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="accommodation-checkout" className="text-sm">
                Check-out
              </Label>
              <Input
                id="accommodation-checkout"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="text-sm dark:[color-scheme:light]"
              />
              {checkOut ? <div className="text-xs text-muted-foreground">{formatWeekdayDayMonth(checkOut, 0)}</div> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accommodation-adults" className="text-sm">
              Adults
            </Label>
            <Input
              id="accommodation-adults"
              type="number"
              min={1}
              max={6}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value || 1))}
              className="text-sm w-24"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="accommodation-min-price" className="text-sm">
                Min price
              </Label>
              <Input
                id="accommodation-min-price"
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accommodation-max-price" className="text-sm">
                Max price
              </Label>
              <Input
                id="accommodation-max-price"
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Search stays"
              )}
            </Button>
          </div>

          {results && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="text-sm text-muted-foreground">
                {results.data.length} option{results.data.length === 1 ? "" : "s"} found
              </div>
              {results.data.length === 0 ? (
                <div className="text-sm text-muted-foreground">No accommodations returned for this search.</div>
              ) : (
                <>
                  <ScrollArea className="h-80 pr-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hotel</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.data
                          .filter((offer) => {
                            const priceRaw = offer.offers?.[0]?.price?.total
                            if (!priceRaw) return true
                            const priceValue = Number(priceRaw)
                            if (!Number.isFinite(priceValue)) return true
                            if (minPrice && priceValue < Number(minPrice)) return false
                            if (maxPrice && priceValue > Number(maxPrice)) return false
                            return true
                          })
                          .slice((page - 1) * pageSize, page * pageSize)
                          .map((offer, idx) => {
                            const label = formatOfferLabel(offer)
                            const firstOffer = offer.offers?.[0]
                            const price = firstOffer?.price?.total
                            const currency = firstOffer?.price?.currency
                            const priceText = price && currency ? `${price} ${currency}` : "Price unavailable"
                            const hotelKey = `${offer.hotel?.name ?? "hotel"}-${offer.hotel?.address?.cityName ?? ""}`
                            const isCreating = creatingHotelKey === hotelKey
                            const isCreated = createdHotelKeys.has(hotelKey)
                            return (
                              <TableRow key={`${label}-${idx}`}>
                                <TableCell className="font-medium">{label}</TableCell>
                                <TableCell>{offer.hotel?.rating ?? "—"}</TableCell>
                                <TableCell>{priceText}</TableCell>
                                <TableCell className="text-right">
                                  {isCreated ? (
                                    <div className="inline-flex items-center gap-1 text-green-600 text-xs">
                                      <span>Created</span>
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
                                        "Create segment"
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
                      Page {page} of {Math.max(1, Math.ceil(results.data.length / pageSize))}
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
                          setPage((p) => Math.min(Math.ceil(results.data.length / pageSize), p + 1))
                        }
                        disabled={page >= Math.ceil(results.data.length / pageSize)}
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
