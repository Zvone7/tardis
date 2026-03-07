"use client"

import React, { Suspense } from "react"
import OptionsPageContent from "../options/OptionsPageContent"

export default function OptionsPage() {

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <OptionsPageContent />
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