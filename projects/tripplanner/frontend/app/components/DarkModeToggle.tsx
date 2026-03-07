"use client"

import { useEffect, useMemo, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "../components/ui/button"
import { useThemePreference } from "../providers/ThemeProvider"
import { useCurrentUser, setCachedCurrentUser } from "../hooks/useCurrentUser"
import { userApi } from "../utils/apiClient"
import type { DarkModePreference } from "../types/models"

const nextTogglePreference = (current: DarkModePreference, resolved: "light" | "dark"): DarkModePreference => {
  if (current === "dark") return "light"
  if (current === "light") return "dark"
  return resolved === "dark" ? "light" : "dark"
}

export function DarkModeToggle() {
  const { user } = useCurrentUser()
  const { preference, resolvedTheme, setPreference } = useThemePreference()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const icon = resolvedTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />

  const handleToggle = async () => {
    const next = nextTogglePreference(preference, resolvedTheme)
    setPreference(next)
    setIsUpdating(true)
    try {
      const updated = await userApi.updateDarkMode({ preferredDarkMode: next })
      setCachedCurrentUser(updated)
    } catch (error) {
      console.error("Failed to update dark mode preference:", error)
      if (user?.userPreference?.preferredDarkMode) {
        setPreference(user.userPreference.preferredDarkMode)
      }
    } finally {
      setIsUpdating(false)
    }
  }

  if (!isMounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-2 text-xs w-[72px]"
        aria-hidden
        disabled
        suppressHydrationWarning
      />
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isUpdating}
      className="flex items-center gap-2 text-xs"
      title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      {icon}
    </Button>
  )
}
