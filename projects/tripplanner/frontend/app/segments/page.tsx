import { redirect } from "next/navigation"

interface PageProps {
  searchParams: Promise<{ tripId?: string }>
}

export default async function SegmentsPage({ searchParams }: PageProps) {
  const { tripId } = await searchParams
  if (tripId) {
    redirect(`/trip/${tripId}?tab=segments`)
  }
  redirect("/trips")
}
