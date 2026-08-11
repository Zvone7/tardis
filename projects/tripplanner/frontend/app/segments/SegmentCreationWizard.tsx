// SegmentCreationWizard.tsx
// Step-by-step segment creation flow for NEW segments only.
"use client"

import React, { useState, useMemo, useCallback, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { toast } from "../components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog"
import { Loader2, ChevronLeftIcon, ChevronRightIcon, SaveIcon, XIcon } from "lucide-react"
import type { SegmentModalProps, SegmentSave, SegmentType, LocationOption } from "../types/models"
import type { RangeDateTimePickerValue } from "../components/RangeDateTimePicker"
import type { RangeLocationPickerValue } from "../components/RangeLocationPicker"
import { RangeDateTimePicker } from "../components/RangeDateTimePicker"
import { RangeLocationPicker } from "../components/RangeLocationPicker"
import { CurrencyDropdown } from "../components/CurrencyDropdown"
import { useCurrencies, getDefaultCurrencyId } from "../hooks/useCurrencies"
import { useCurrencyConversions } from "../hooks/useCurrencyConversions"
import { toLocationDto } from "../lib/mapping"
import { localToUtcMs, normalizeOffsetHours } from "../lib/utils"
import { isTransportType, isAccommodationType } from "../utils/segmentVisuals"
import { formatCurrencyAmount, formatConvertedAmount } from "../utils/currency"
import { cn } from "../lib/utils"

const STEP_LABELS = ["Type", "Price", "Times", "Locations"]

// Parse math expression or number string
function parseCost(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return Number.NaN
  const normalized = trimmed.replace(",", ".")
  try {
    if (/^[0-9+\-*/().\s]+$/.test(normalized)) {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return (${normalized})`)
      const result = Number(fn())
      if (Number.isFinite(result)) return result
    }
  } catch { /* fallthrough */ }
  return Number.parseFloat(normalized)
}

interface WizardProps {
  tripId: number
  segmentTypes: SegmentType[]
  existingLocations?: LocationOption[]
  tripCurrencyId?: number | null
  displayCurrencyId?: number | null
  userPreferredOffset: number
  userPreferredCurrencyId: number | null
  onSave: SegmentModalProps["onSave"]
  onCancel: () => void
}

export function SegmentCreationWizard({
  tripId,
  segmentTypes,
  existingLocations,
  tripCurrencyId,
  displayCurrencyId,
  userPreferredOffset,
  userPreferredCurrencyId,
  onSave,
  onCancel,
}: WizardProps) {
  const [step, setStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // --- Step 1: Type ---
  const [segmentTypeId, setSegmentTypeId] = useState<number | null>(null)

  // --- Step 2: Price ---
  const [cost, setCost] = useState("")
  const [currencyId, setCurrencyId] = useState<number | null>(null)

  // --- Step 3: Times ---
  const normalizedOffset = normalizeOffsetHours(userPreferredOffset)
  const [range, setRange] = useState<RangeDateTimePickerValue>({
    startLocal: "",
    endLocal: null,
    startOffsetH: normalizedOffset,
    endOffsetH: null,
  })

  // --- Step 4: Locations ---
  const [locRange, setLocRange] = useState<RangeLocationPickerValue>({ start: null, end: null })

  const { currencies, isLoading: isLoadingCurrencies } = useCurrencies()
  const { conversions } = useCurrencyConversions()
  const defaultCurrencyId = useMemo(() => getDefaultCurrencyId(currencies), [currencies])

  // Auto-select user's preferred currency on load
  useEffect(() => {
    if (!currencyId && (userPreferredCurrencyId || tripCurrencyId || defaultCurrencyId)) {
      setCurrencyId(userPreferredCurrencyId ?? tripCurrencyId ?? defaultCurrencyId ?? null)
    }
  }, [userPreferredCurrencyId, tripCurrencyId, defaultCurrencyId, currencyId])

  // Update offset when userPreferredOffset changes
  useEffect(() => {
    const off = normalizeOffsetHours(userPreferredOffset)
    setRange((prev) => ({ ...prev, startOffsetH: off, endOffsetH: null }))
  }, [userPreferredOffset])

  const selectedType = useMemo(
    () => (segmentTypeId !== null ? segmentTypes.find((t) => t.id === segmentTypeId) ?? null : null),
    [segmentTypeId, segmentTypes],
  )
  const isTransport = selectedType ? isTransportType(selectedType) : false
  const isAccommodation = selectedType ? isAccommodationType(selectedType) : false

  const parsedCost = useMemo(() => parseCost(cost), [cost])

  const effectiveCurrencyId = currencyId ?? userPreferredCurrencyId ?? tripCurrencyId ?? defaultCurrencyId ?? null

  const costLabel = useMemo(() => {
    if (!Number.isFinite(parsedCost) || !effectiveCurrencyId) return null
    return formatCurrencyAmount(parsedCost, effectiveCurrencyId, currencies)
  }, [parsedCost, effectiveCurrencyId, currencies])

  const conversionLabel = useMemo(() => {
    if (!Number.isFinite(parsedCost) || !effectiveCurrencyId) return null
    if (!userPreferredCurrencyId || effectiveCurrencyId === userPreferredCurrencyId) return null
    return formatConvertedAmount({ amount: parsedCost, fromCurrencyId: effectiveCurrencyId, toCurrencyId: userPreferredCurrencyId, currencies, conversions }) ?? null
  }, [parsedCost, effectiveCurrencyId, userPreferredCurrencyId, currencies, conversions])

  // Validate current step
  const validateStep = useCallback((): string | null => {
    if (step === 0) {
      if (segmentTypeId === null) return "Please select a segment type"
    }
    if (step === 1) {
      if (!cost || !Number.isFinite(parsedCost)) return "Please enter a valid cost amount"
      if (!effectiveCurrencyId) return "Please select a currency"
    }
    if (step === 2) {
      if (!range.startLocal) return "Please choose a start date and time"
      const startUtcMs = localToUtcMs(range.startLocal, range.startOffsetH)
      if (!Number.isFinite(startUtcMs)) return "Invalid start date/time"
      if (isTransport || isAccommodation) {
        if (!range.endLocal) return "Please choose an end date and time"
        const endOffset = range.endOffsetH ?? range.startOffsetH
        const endUtcMs = localToUtcMs(range.endLocal, endOffset)
        if (!Number.isFinite(endUtcMs)) return "Invalid end date/time"
        if (endUtcMs < startUtcMs + 5 * 60 * 1000) return "End must be at least 5 minutes after start"
      }
    }
    if (step === 3) {
      if (isTransport) {
        if (!locRange.start) return "Please select a start location"
        if (!locRange.end) return "Please select a destination"
      }
      if (isAccommodation) {
        if (!locRange.start) return "Please select a location"
      }
    }
    return null
  }, [step, segmentTypeId, cost, parsedCost, effectiveCurrencyId, range, isTransport, isAccommodation, locRange])

  const handleNext = () => {
    const err = validateStep()
    if (err) {
      setStepError(err)
      return
    }
    setStepError(null)
    // Skip locations step if type doesn't need locations
    if (step === 2 && !isTransport && !isAccommodation) {
      handleSave()
      return
    }
    setStep((s) => s + 1)
  }

  const handleBack = () => {
    setStepError(null)
    setStep((s) => Math.max(0, s - 1))
  }

  const handleSave = async () => {
    const err = validateStep()
    if (err) {
      setStepError(err)
      return
    }
    setStepError(null)

    const startLocal = range.startLocal
    const startOffset = range.startOffsetH
    const startUtcMs = localToUtcMs(startLocal, startOffset)
    if (!Number.isFinite(startUtcMs)) {
      toast({ title: "Error", description: "Invalid start date/time." })
      return
    }

    const endOffset = range.endOffsetH ?? range.startOffsetH
    const endLocal = range.endLocal ?? range.startLocal
    const endUtcMs = localToUtcMs(endLocal, endOffset)

    const safeCurrencyId = effectiveCurrencyId
    if (!safeCurrencyId) {
      toast({ title: "Error", description: "Select a currency before saving." })
      return
    }

    const payload: SegmentSave = {
      tripId,
      name: "",
      startDateTimeUtc: `${startLocal}:00`,
      endDateTimeUtc: `${endLocal}:00`,
      startDateTimeUtcOffset: startOffset,
      endDateTimeUtcOffset: endOffset,
      cost: parsedCost,
      currencyId: safeCurrencyId,
      segmentTypeId: segmentTypeId!,
      comment: "",
      startLocation: toLocationDto(locRange.start ? { ...locRange.start, id: undefined } : null),
      endLocation: toLocationDto(locRange.end ? { ...locRange.end, id: undefined } : null),
      isUiVisible: true,
    }

    setIsSaving(true)
    try {
      await onSave(payload, false, undefined)
    } catch {
      toast({ title: "Error", description: "Failed to save segment." })
    } finally {
      setIsSaving(false)
    }
  }

  const isLastStep = step === 3 || (step === 2 && !isTransport && !isAccommodation)
  const totalSteps = isTransport || isAccommodation ? 4 : 3
  const hasInput = segmentTypeId !== null || cost.trim() !== "" || range.startLocal !== "" || locRange.start !== null || locRange.end !== null

  const requestClose = () => {
    if (hasInput) {
      setShowDiscardConfirm(true)
    } else {
      onCancel()
    }
  }

  return (
    <>
    <div className="flex flex-col h-full">
      {/* Step progress */}
      <div className="relative bg-background px-4 pt-3 pb-2 pr-10">
        <button
          type="button"
          onClick={requestClose}
          className="absolute right-3 top-3 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close"
        >
          <XIcon className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5">
          {STEP_LABELS.slice(0, totalSteps).map((label, i) => (
            <React.Fragment key={label}>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                  i < step ? "bg-primary/10 text-primary font-medium" : i === step ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground",
                )}
              >
                <span>{i + 1}</span>
                <span>{label}</span>
              </div>
              {i < totalSteps - 1 && <div className="h-px flex-1 bg-border" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {/* Step 0: Type */}
        {step === 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">What kind of segment is this?</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {segmentTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => { setSegmentTypeId(type.id); setStepError(null) }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors hover:bg-muted/60",
                    segmentTypeId === type.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border",
                  )}
                >
                  {type.iconSvg ? (
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/60 text-secondary-foreground shadow-sm ring-1 ring-black/5 dark:bg-white dark:text-black"
                    >
                      <span
                        dangerouslySetInnerHTML={{ __html: type.iconSvg as string }}
                        className="w-5 h-5"
                        suppressHydrationWarning
                      />
                    </span>
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">
                      {type.name.charAt(0)}
                    </span>
                  )}
                  <span className="text-xs font-medium leading-tight">{type.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Price */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">How much does this cost?</p>
            <div className="space-y-2">
              <Label htmlFor="wizard-cost">Amount</Label>
              <Input
                id="wizard-cost"
                value={cost}
                onChange={(e) => { setCost(e.target.value.replace(/[^0-9+\-*/().,\s]/g, "")); setStepError(null) }}
                placeholder="e.g. 150 or 2600/4"
                inputMode="decimal"
                className="font-mono"
                autoFocus
              />
              {Number.isFinite(parsedCost) && parsedCost !== Number.parseFloat(cost) && (
                <p className="text-xs text-muted-foreground">= {parsedCost.toFixed(2)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <CurrencyDropdown
                value={currencyId}
                onChange={setCurrencyId}
                currencies={currencies}
                placeholder={isLoadingCurrencies ? "Loading..." : "Currency"}
                disabled={isLoadingCurrencies}
                className="w-full"
                triggerClassName="w-full"
              />
            </div>
            {(costLabel || conversionLabel) && (
              <p className="text-xs text-muted-foreground">
                {costLabel}{conversionLabel && <span className="ml-1">≈ {conversionLabel}</span>}
              </p>
            )}
          </div>
        )}

        {/* Step 2: Times */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">When does it start{isTransport || isAccommodation ? " and end" : ""}?</p>
            <RangeDateTimePicker
              id="wizard-when"
              value={range}
              onChange={(next) => { setRange(next); setStepError(null) }}
              allowDifferentOffsets
              requireEnd={isTransport || isAccommodation}
              showNights={isAccommodation}
            />
          </div>
        )}

        {/* Step 3: Locations */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isTransport ? "Where does it go from and to?" : "Where is it located?"}
            </p>
            <RangeLocationPicker
              id="wizard-where"
              value={locRange}
              onChange={(next) => { setLocRange(next); setStepError(null) }}
              existingLocations={existingLocations}
              singleMode={isAccommodation}
            />
          </div>
        )}

        {/* Step error */}
        {stepError && (
          <p className="mt-3 text-sm text-destructive">{stepError}</p>
        )}
      </div>

      {/* Navigation footer */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={step === 0 ? requestClose : handleBack}
        >
          {step === 0 ? "Cancel" : <><ChevronLeftIcon className="h-4 w-4 mr-1" />Back</>}
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={isLastStep ? handleSave : handleNext}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isLastStep ? (
            <><SaveIcon className="h-4 w-4 mr-1" />Save</>
          ) : (
            <>Next<ChevronRightIcon className="h-4 w-4 ml-1" /></>
          )}
        </Button>
      </div>
    </div>
    <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard segment?</AlertDialogTitle>
          <AlertDialogDescription>
            Closing now will discard the information entered for this segment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continue editing</AlertDialogCancel>
          <AlertDialogAction onClick={onCancel}>Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
