import { Suspense } from "react"
import { TripPageContent } from "./TripPageContent"
import type { ActiveTab } from "./TripLayoutContext"

interface PageProps {
  params: Promise<{ tripId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function TripPage({ params, searchParams }: PageProps) {
  const { tripId: tripIdStr } = await params
  const { tab } = await searchParams
  const tripId = parseInt(tripIdStr, 10)
  const initialTab: ActiveTab = tab === "segments" ? "segments" : "options"

  return (
    <div className="h-[calc(100dvh-73px)]">
      <Suspense fallback={<div className="flex-1 animate-pulse bg-muted h-full" />}>
        <TripPageContent tripId={tripId} initialTab={initialTab} />
      </Suspense>
    </div>
  )
}
