// components/RangeLocationPicker.tsx
"use client"

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { Label } from "./ui/label"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { ArrowLeftRight, XIcon } from "lucide-react"
import type { LocationOption } from "../types/models"
import { geocodingApi } from "../utils/apiClient"
import { matchTripLocations, tripViewbox } from "../lib/tripLocations"
import { useFloatingPosition } from "../hooks/useFloatingPosition"

export interface RangeLocationPickerValue {
  start: LocationOption | null
  end: LocationOption | null
}

export interface PickerRenderProps {
  id: string
  placeholder: string
  selected: LocationOption | null
  onSelected: (loc: LocationOption | null) => void
}

interface RangeLocationPickerProps {
  id: string
  label?: string
  value: RangeLocationPickerValue
  onChange: (next: RangeLocationPickerValue) => void
  compact?: boolean
  searchEndpoint?: string
  minChars?: number
  debounceMs?: number
  renderPicker?: (props: PickerRenderProps) => React.ReactNode
  existingLocations?: LocationOption[]
  /** When true, shows a single "Location" field with no start/end distinction */
  singleMode?: boolean
}

/* -------------------- small utilities -------------------- */

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

export function useDebounced<T>(val: T, delay: number) {
  const [d, setD] = useState(val)
  useEffect(() => {
    const t = setTimeout(() => setD(val), delay)
    return () => clearTimeout(t)
  }, [val, delay])
  return d
}

/** Deduplicate existing locations by ~111m proximity key */
function dedupeLocations(locs: LocationOption[]): LocationOption[] {
  const seen = new Set<string>()
  return locs.filter((l) => {
    const key = `${Math.round(l.lat * 100) / 100},${Math.round(l.lng * 100) / 100}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/* -------------------- Autocomplete input -------------------- */

export function Autocomplete({
  id,
  placeholder,
  selected,
  onSelected,
  searchEndpoint = "/api/location/search",
  minChars = 2,
  debounceMs = 500,
  existingLocations,
}: {
  id: string
  placeholder?: string
  selected: LocationOption | null
  onSelected: (loc: LocationOption | null) => void
  searchEndpoint?: string
  minChars?: number
  debounceMs?: number
  existingLocations?: LocationOption[]
}) {
  const [query, setQuery] = useState(selected?.formatted || selected?.name || "")
  const [open, setOpen] = useState(false)
  const [searchItems, setSearchItems] = useState<LocationOption[]>([])
  const [loading, setLoading] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounced = useDebounced(query, debounceMs)

  const suppressNextSearchRef = useRef(false)

  const pos = useFloatingPosition(triggerRef, open, 220)

  // Deduplicated existing locations for chips
  const uniqueExisting = useMemo(
    () => dedupeLocations(existingLocations ?? []),
    [existingLocations],
  )

  // close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", handler)
    return () => document.removeEventListener("pointerdown", handler)
  }, [open])

  useEffect(() => {
    if (selected) {
      setQuery(selected.formatted || selected.name)
    } else {
      setQuery("")
    }
  }, [selected])

  // Search API when query meets minChars threshold
  useEffect(() => {
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false
      return
    }

    const controller = new AbortController()
    const q = debounced.trim()
    if (q.length < minChars) {
      setSearchItems([])
      setOpen(false)
      return
    }

    setLoading(true)
    ;(async () => {
      try {
        const vb = tripViewbox(existingLocations ?? [])
        const list = await geocodingApi.search(searchEndpoint, q, controller.signal, vb)
        if (!controller.signal.aborted) {
          setSearchItems(list)
          setOpen(list.length > 0)
          setFocusedIdx(list.length ? 0 : -1)
        }
      } catch {
        if (!controller.signal.aborted) {
          setSearchItems([])
          setOpen(false)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [debounced, minChars, searchEndpoint, existingLocations])

  const selectItem = (itm: LocationOption) => {
    // Select without preserving existing DB id — backend creates new location rows
    onSelected({ ...itm, id: undefined })

    suppressNextSearchRef.current = true
    setQuery(itm.formatted || itm.name)
    setSearchItems([])
    setFocusedIdx(-1)
    setOpen(false)

    inputRef.current?.blur()
  }

  const clearSelection = () => {
    suppressNextSearchRef.current = false
    setQuery("")
    setSearchItems([])
    setOpen(false)
    setFocusedIdx(-1)
    inputRef.current?.focus()
  }

  const dropdown = open && pos ? (
    <div
      ref={dropdownRef}
      data-floating-portal="location-picker"
      className="z-[200] rounded-md border bg-popover shadow"
      style={{
        position: "fixed",
        pointerEvents: "auto",
        top: pos.openUpward ? undefined : pos.top + 4,
        bottom: pos.openUpward ? window.innerHeight - pos.top + 4 : undefined,
        left: pos.left,
        width: Math.max(pos.width, 280),
      }}
    >
      <div style={{ maxHeight: pos.maxHeight, overflowY: "auto" }}>
        {loading ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
        ) : searchItems.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
        ) : (
          <ul role="listbox" aria-labelledby={id}>
            {searchItems.map((itm, idx) => {
              const label = itm.formatted || (itm.country ? `${itm.name}, ${itm.country}` : itm.name)
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
                  className={clsx(
                    "px-3 py-2 text-sm cursor-pointer",
                    idx === focusedIdx ? "bg-accent" : "hover:bg-accent/60",
                  )}
                  title={label || undefined}
                >
                  {label}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  ) : null

  return (
    <div className="w-full md:w-80">
      {/* Input row */}
      <div ref={triggerRef} className="relative w-full">
        <Input
          id={id}
          ref={inputRef}
          placeholder={placeholder ?? "Search city, country"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (e.target.value.trim().length >= minChars) setOpen(true)
          }}
          onFocus={() => {
            if (searchItems.length > 0) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setFocusedIdx((i) => Math.min(i + 1, searchItems.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setFocusedIdx((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter") {
              if (focusedIdx >= 0 && searchItems[focusedIdx]) {
                e.preventDefault()
                selectItem(searchItems[focusedIdx])
              }
            } else if (e.key === "Escape") {
              setOpen(false)
            }
          }}
          className="text-sm pr-8"
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
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
            title="Clear selection"
            aria-label="Clear location"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Existing location chips */}
      {uniqueExisting.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {uniqueExisting.map((loc) => {
            const label = loc.country ? `${loc.name}, ${loc.country}` : loc.name
            const isActive = selected && Math.round(selected.lat * 100) === Math.round(loc.lat * 100) && Math.round(selected.lng * 100) === Math.round(loc.lng * 100)
            return (
              <button
                type="button"
                key={`${loc.lat},${loc.lng}`}
                onClick={() => selectItem(loc)}
                className={clsx(
                  "rounded-full border px-2 py-0.5 text-xs transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                title={label}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  )
}

/* -------------------- RangeLocationPicker -------------------- */

export const RangeLocationPicker: React.FC<RangeLocationPickerProps> = React.memo(
  ({
    id,
    label = "Where",
    value,
    onChange,
    compact = false,
    searchEndpoint = "/api/geocode/search",
    minChars = 2,
    debounceMs = 250,
    renderPicker,
    existingLocations,
    singleMode = false,
  }) => {
    const { start, end } = value
    const grid = compact ? "grid grid-cols-4 items-center gap-2" : "grid grid-cols-4 items-center gap-3"

    const [endVisible, setEndVisible] = useState(end !== null)
    useEffect(() => { if (end !== null) setEndVisible(true) }, [end])

    const handleSwap = useCallback(() => {
      if (start && end) onChange({ start: end, end: start })
    }, [start, end, onChange])

    return (
      <div className="space-y-3">
        {/* Start / single location */}
        <div className={grid}>
          <Label htmlFor={`${id}-start`} className="text-right text-sm">
            {singleMode ? "Location" : "Start"}
          </Label>
          <div className="col-span-3 flex items-center gap-2">
            {renderPicker
              ? renderPicker({ id: `${id}-start`, placeholder: singleMode ? "Select location..." : "Select start...", selected: start, onSelected: (loc) => onChange({ ...value, start: loc }) })
              : <Autocomplete
                  id={`${id}-start`}
                  placeholder={singleMode ? "Search location" : "Search a start location"}
                  selected={start}
                  onSelected={(loc) => onChange({ ...value, start: loc })}
                  searchEndpoint={searchEndpoint}
                  minChars={minChars}
                  debounceMs={debounceMs}
                  existingLocations={existingLocations}
                />
            }
          </div>
        </div>

        {/* End location (hidden in singleMode) */}
        {!singleMode && (
          !endVisible ? (
            <div className={grid}>
              <Label className="text-right text-sm" />
              <div className="col-span-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setEndVisible(true); onChange({ ...value, end: value.start ?? null }) }}
                >
                  + Add destination
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {start && end && (
                <div className={grid}>
                  <Label className="text-right text-sm" />
                  <div className="col-span-3 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleSwap}
                      title="Swap start and destination"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      <span className="sr-only">Swap start and destination</span>
                    </Button>
                  </div>
                </div>
              )}

              <div className={grid}>
                <Label htmlFor={`${id}-end`} className="text-right text-sm">
                  Destination
                </Label>
                <div className="col-span-3 flex items-center gap-2">
                  {renderPicker
                    ? renderPicker({ id: `${id}-end`, placeholder: "Select destination...", selected: end, onSelected: (loc) => onChange({ ...value, end: loc }) })
                    : <Autocomplete
                        id={`${id}-end`}
                        placeholder="Search an end location"
                        selected={end}
                        onSelected={(loc) => onChange({ ...value, end: loc })}
                        searchEndpoint={searchEndpoint}
                        minChars={minChars}
                        debounceMs={debounceMs}
                        existingLocations={existingLocations}
                      />
                  }
                </div>
              </div>

              <div className={grid}>
                <Label className="text-right text-sm" />
                <div className="col-span-3 flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEndVisible(false); onChange({ ...value, end: null }) }}>
                    Remove destination
                  </Button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    )
  },
)

RangeLocationPicker.displayName = "RangeLocationPicker"
