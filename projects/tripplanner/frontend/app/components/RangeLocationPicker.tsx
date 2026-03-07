// components/RangeLocationPicker.tsx
"use client"

import React, { useEffect, useRef, useState } from "react"
import { Label } from "./ui/label"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { ArrowLeftRight } from "lucide-react"
import type { LocationOption } from "../types/models"
import { geocodingApi } from "../utils/apiClient"

export interface RangeLocationPickerValue {
  start: LocationOption | null
  end: LocationOption | null
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
}

/* -------------------- small utilities -------------------- */

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

/* -------------------- Autocomplete input -------------------- */

function Autocomplete({
  id,
  placeholder,
  selected,
  onSelected,
  searchEndpoint = "/api/location/search",
  minChars = 2,
  debounceMs = 500,
}: {
  id: string
  placeholder?: string
  selected: LocationOption | null
  onSelected: (loc: LocationOption | null) => void
  searchEndpoint?: string
  minChars?: number
  debounceMs?: number
}) {
  const [query, setQuery] = useState(selected?.formatted || selected?.name || "")
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<LocationOption[]>([])
  const [loading, setLoading] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounced = useDebounced(query, debounceMs)

  const suppressNextSearchRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // close on outside click
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
    // keep input text aligned when parent changes selected externally
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
        const list = await geocodingApi.search(searchEndpoint, q, controller.signal)
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

    return () => {
      controller.abort()
    }
  }, [debounced, minChars, searchEndpoint])

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

    // Avoid a new fetch due to empty string; also close the list
    suppressNextSearchRef.current = true
    setQuery("")
    setItems([])
    setFocusedIdx(-1)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative w-full md:w-80">
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
          // show existing list if we already have results
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
        /* ---- block browser autofill/autocorrect/etc ---- */
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        // Some browsers still try to help: give it a throwaway name
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
              <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
            ) : items.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
            ) : (
              <ul role="listbox" aria-labelledby={id}>
                {items.map((itm, idx) => {
                  const label = itm.formatted || (itm.country ? `${itm.name}, ${itm.country}` : itm.name)
                  return (
                    <li
                      key={`${itm.provider}-${itm.providerPlaceId}`}
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
          </ScrollArea>
        </div>
      )}
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
  }) => {
    const { start, end } = value
    const grid = compact ? "grid grid-cols-4 items-center gap-2" : "grid grid-cols-4 items-center gap-3"

    const handleSwap = () => {
      if (start && end) {
        onChange({ start: end, end: start })
      }
    }

    return (
      <div className="space-y-3">
        {/* Start location */}
        <div className={grid}>
          <Label htmlFor={`${id}-start`} className="text-right text-sm">
            Start
          </Label>
          <div className="col-span-3 flex items-center gap-2">
            <Autocomplete
              id={`${id}-start`}
              placeholder="Search a start location"
              selected={start}
              onSelected={(loc) => onChange({ ...value, start: loc })}
              searchEndpoint={searchEndpoint}
              minChars={minChars}
              debounceMs={debounceMs}
            />
          </div>
        </div>

        {/* End location (optional) */}
        {end === null ? (
          <div className={grid}>
            <Label className="text-right text-sm" />
            <div className="col-span-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ ...value, end: value.start ?? null })}
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
                <Autocomplete
                  id={`${id}-end`}
                  placeholder="Search an end location"
                  selected={end}
                  onSelected={(loc) => onChange({ ...value, end: loc })}
                  searchEndpoint={searchEndpoint}
                  minChars={minChars}
                  debounceMs={debounceMs}
                />
              </div>
            </div>

            <div className={grid}>
              <Label className="text-right text-sm" />
              <div className="col-span-3 flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, end: null })}>
                  Remove destination
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  },
)

RangeLocationPicker.displayName = "RangeLocationPicker"
