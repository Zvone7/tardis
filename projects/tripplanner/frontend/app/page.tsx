"use client"

import { useEffect, useState } from "react"
import { LoginButton } from "./components/LoginButton"
import { Toaster } from "./components/ui/toaster"
import { homeApi } from "./utils/apiClient"
import Link from "next/link"

const envCode = process.env.NEXT_PUBLIC_ENV_CODE?.toLowerCase()
const isLocalOrDev = !envCode
  ? process.env.NODE_ENV !== "production"
  : envCode === "local" || envCode === "dev"

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
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Trip Planner</h1>
      <p className="text-xl mb-8">Page used for trip planning.</p>
      <p className="mb-4 text-sm text-muted-foreground">This site is using cookies. Site in development. Use at own responsibility.</p>
      <p className="mb-4 text-sm text-muted-foreground">After signing in with google, admin will be notified of your application and will approve your account.</p>

      <LoginButton />

      <a href="/trips" className="text-primary hover:underline mt-4">
        View my trips
      </a>

      {statusLine && (
        <p className="mt-6 text-sm text-muted-foreground" data-testid="home-backend-status">
          Backend status: {statusLine}
        </p>
      )}

      {isLocalOrDev && (
        <Link href="/status" className="mt-4 text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors">
          Status
        </Link>
      )}

      <Toaster />
    </div>
  )
}
