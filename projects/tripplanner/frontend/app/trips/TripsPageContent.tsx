"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Skeleton } from "../components/ui/skeleton"
import { Button } from "../components/ui/button"
import { PlusIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, EditIcon, EyeIcon } from "lucide-react"
import TripModal from "./TripModal"
import { formatDateStr, formatWeekday } from "../utils/dateformatters"
import type { Trip, TripSave, Currency } from "../types/models"
import { tripsApi } from "../utils/apiClient"
import { useCurrencies } from "../hooks/useCurrencies"
import { useCurrentUser } from "../hooks/useCurrentUser"

const formatTripDateWithWeekday = (iso: string | null) => {
  if (!iso) return "N/A"
  const weekday = formatWeekday(iso)
  return `${weekday}, ${formatDateStr(iso)}`
}

// Reusable Trip Card (used on all breakpoints)
function TripCard({
  trip,
  onEdit,
  onDelete,
  onViewOptions,
  onViewSegments,
  currencies,
}: {
  trip: Trip
  onEdit: (trip: Trip) => void
  onDelete: (tripId: number) => void
  onViewOptions: (tripId: number) => void
  onViewSegments: (tripId: number) => void
  currencies: Currency[]
}) {
  const tripCurrency = currencies.find((currency) => currency.id === trip.currencyId)
  const currencyLabel = tripCurrency ? `${tripCurrency.symbol} ${tripCurrency.shortName}` : "—"

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-sm border"
      onClick={() => onViewOptions(trip.id)}
      role="button"
      aria-label={`Open ${trip.name}`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold tracking-tight">
              {trip.name}
            </CardTitle>
            <div className="mt-1 text-sm text-muted-foreground space-y-1">
              {trip.description && <div className="line-clamp-2">{trip.description}</div>}
              <div>
                <span className="font-medium">Start:</span> {formatTripDateWithWeekday(trip.startTime)}
              </div>
              <div>
                <span className="font-medium">End:</span> {formatTripDateWithWeekday(trip.endTime)}
              </div>
              <div>
                <span className="font-tiny"></span> {currencyLabel}
              </div>
            </div>
          </div>

          {/* Actions (don’t trigger card click) */}
          <div className="flex flex-col space-y-1 ml-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onEdit(trip) }}
              aria-label="Edit trip"
              title="Edit trip"
            >
              <EditIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onViewSegments(trip.id) }}
              aria-label="View segments"
              title="View segments"
            >
              <EyeIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onDelete(trip.id) }}
              aria-label="Delete trip"
              title="Delete trip"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

// Section wrapper with collapsible header
function TripSection({
  title,
  trips,
  isOpen,
  onToggle,
  onEdit,
  onDelete,
  onViewOptions,
  onViewSegments,
  currencies,
}: {
  title: string
  trips: Trip[]
  isOpen: boolean
  onToggle: () => void
  onEdit: (trip: Trip) => void
  onDelete: (tripId: number) => void
  onViewOptions: (tripId: number) => void
  onViewSegments: (tripId: number) => void
  currencies: Currency[]
}) {
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between mb-2 p-2 rounded-md border bg-card text-card-foreground hover:bg-muted/60 transition-colors"
        aria-expanded={isOpen}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewOptions={onViewOptions}
              onViewSegments={onViewSegments}
              currencies={currencies}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TripList() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [currentTrips, setCurrentTrips] = useState<Trip[]>([])
  const [oldTrips, setOldTrips] = useState<Trip[]>([])
  const [showOldTrips, setShowOldTrips] = useState(false)
  const [showCurrentTrips, setShowCurrentTrips] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const router = useRouter()
  const { currencies } = useCurrencies()
  const { user } = useCurrentUser()
  const preferredCurrencyId = user?.userPreference?.preferredCurrencyId ?? null

  const fetchTrips = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await tripsApi.getAll()
      setTrips(data)
    } catch (err) {
      setError("An error occurred while fetching trips")
      console.error("Error fetching trips:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchTrips() }, [fetchTrips])

  useEffect(() => {
    if (!trips.length) return
    const now = new Date()

    const current: Trip[] = []
    const old: Trip[] = []

    for (const trip of trips) {
      if (!trip.startTime || !trip.endTime) {
        current.push(trip)
        continue
      }
      const endTime = new Date(trip.endTime)
      const startTime = new Date(trip.startTime)
      if (endTime < now && startTime < now) old.push(trip)
      else current.push(trip)
    }

    current.sort((a, b) => {
      if (!a.startTime) return 1
      if (!b.startTime) return -1
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    })
    old.sort((a, b) => {
      if (!a.startTime) return 1
      if (!b.startTime) return -1
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    })

    setCurrentTrips(current)
    setOldTrips(old)
  }, [trips])

  const handleEditTrip = (trip: Trip) => {
    setEditingTrip(trip)
    setIsModalOpen(true)
  }
  const handleCreateTrip = () => {
    setEditingTrip(null)
    setIsModalOpen(true)
  }
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingTrip(null)
  }

  const handleSaveTrip = async (tripData: TripSave) => {
    try {
      if (editingTrip) {
        await tripsApi.update(editingTrip.id, tripData)
      } else {
        await tripsApi.create(tripData)
      }
      handleCloseModal()
      await fetchTrips()
    } catch (err) {
      console.error("Error saving trip:", err)
      setError("An error occurred while saving the trip")
    }
  }

  const handleDeleteTrip = async (tripId: number) => {
    if (!window.confirm("Are you sure you want to delete this trip?")) return
    try {
      await tripsApi.remove(tripId)
      await fetchTrips()
    } catch (err) {
      console.error("Error deleting trip:", err)
      setError("An error occurred while deleting the trip")
    }
  }

  const handleViewOptions = (tripId: number) => router.push(`/options?tripId=${tripId}`)
  const handleViewSegments = (tripId: number) => router.push(`/segments?tripId=${tripId}`)

  return (
    <div>
      <TripModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveTrip}
        trip={editingTrip}
        defaultCurrencyId={preferredCurrencyId}
      />

      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Trips</CardTitle>
          </div>
          <Button onClick={handleCreateTrip}>
            <PlusIcon className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <LoadingSkeleton />
          ) : error ? (
            <p className="text-center text-red-500">{error}</p>
          ) : (
            <>
              <TripSection
                title="Current trips"
                trips={currentTrips}
                isOpen={showCurrentTrips}
                onToggle={() => setShowCurrentTrips(!showCurrentTrips)}
                onEdit={handleEditTrip}
                onDelete={handleDeleteTrip}
                onViewOptions={handleViewOptions}
                onViewSegments={handleViewSegments}
                currencies={currencies}
              />

              {oldTrips.length > 0 && (
                <TripSection
                  title="Past trips"
                  trips={oldTrips}
                  isOpen={showOldTrips}
                  onToggle={() => setShowOldTrips(!showOldTrips)}
                  onEdit={handleEditTrip}
                  onDelete={handleDeleteTrip}
                  onViewOptions={handleViewOptions}
                  onViewSegments={handleViewSegments}
                  currencies={currencies}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="w-full h-20" />
      ))}
    </div>
  )
}
