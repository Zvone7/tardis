"use client"

import { useEffect, useState } from "react"
import { LoginButton } from "./components/LoginButton"
import { homeApi } from "./utils/apiClient"

export default function HomePage() {
  const [statusLine, setStatusLine] = useState<string>("Waking backend...")

  useEffect(() => {
    let isMounted = true
    const fetchStatus = async () => {
      try {
        const text = await homeApi.getStatus()
        const firstLine = text.split(/\r?\n/)[0]?.trim() ?? ""
        if (isMounted) setStatusLine(firstLine || "Backend responded")
      } catch {
        if (isMounted) setStatusLine("Unable to reach backend")
      }
    }

    void fetchStatus()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">ApartmentPicker</h1>
      <p className="text-xl mb-8 text-muted-foreground">
        Rank and compare apartments with weighted scoring criteria.
      </p>
      <p className="mb-4 text-sm text-muted-foreground">
        After signing in with Google, admin will be notified of your application and will approve your account.
      </p>

      <LoginButton />

      <a href="/ranking-cases" className="text-blue-500 hover:underline mt-4">
        View Ranking Cases
      </a>

      {statusLine && (
        <p className="mt-6 text-sm text-muted-foreground">
          Backend status: {statusLine}
        </p>
      )}
    </div>
  )
}
