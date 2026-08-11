"use client"

import { LoginButton } from "./components/LoginButton"
import { Toaster } from "./components/ui/toaster"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Trip Planner</h1>
      <p className="text-xl mb-8">Page used for trip planning.</p>
      <p className="mb-4 text-sm text-muted-foreground">This site is using cookies. Site in development. Use at own responsibility.</p>
      <p className="mb-4 text-sm text-muted-foreground">After signing in with google, admin will be notified of your application and will approve your account.</p>

      <LoginButton />

      <Toaster />
    </div>
  )
}
