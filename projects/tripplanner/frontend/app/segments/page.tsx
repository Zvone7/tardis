"use client"

import React, { Suspense } from "react"
import { Skeleton } from "../components/ui/skeleton"
import SegmentsPageContent from "../segments/SegmentsPageContent"


export default function SegmentsPage() {

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SegmentsPageContent />
      
    </Suspense>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="w-full h-12 bg-gray-200 rounded-md" />
      ))}
    </div>
  )
}