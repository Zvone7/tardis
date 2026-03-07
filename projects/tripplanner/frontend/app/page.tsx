"use client"

import { useEffect, useState } from "react"
import { LoginButton } from "./components/LoginButton"
import { Toaster } from "./components/ui/toaster"
import { homeApi } from "./utils/apiClient"

export default function Home() {
  const [statusLine, setStatusLine] = useState<string>("Waking backend...")

  useEffect(() => {
    let isMounted = true
    const fetchStatus = async () => {
      try {
        const text = await homeApi.getStatus()
        const firstLine = text.split(/\r?\n/)[0]?.trim() ?? ""
        if (isMounted) setStatusLine(firstLine || "Backend responded")
      } catch (error) {
        console.error("Failed to fetch backend status", error)
        if (isMounted) setStatusLine("Unable to reach backend")
      }
    }

    void fetchStatus()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-100">
      <h1 className="text-4xl font-bold mb-4">Trip Planner</h1>
      <p className="text-xl mb-8">Page used for trip planning.</p>
      <p className="mb-4 text-sm text-gray-600">This site is using cookies. Site in development. Use at own responsibility.</p>
      <p className="mb-4 text-sm text-gray-600">After signing in with google, admin will be notified of your application and will approve your account.</p>

      <LoginButton />

      <a href="/trips" className="text-blue-500 hover:underline mt-4">
        View my trips
      </a>

      {statusLine && (
        <p className="mt-6 text-sm text-gray-600" data-testid="home-backend-status">
          Backend status: {statusLine}
        </p>
      )}

      <Toaster />
    </div>
  )
}
