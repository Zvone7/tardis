"use client"

import { useEffect, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "../components/ui/button"
import { useThemePreference } from "../providers/ThemeProvider"
import { useCurrentUser, setCachedCurrentUser } from "../hooks/useCurrentUser"
import { userApi } from "../utils/apiClient"
import type { DarkModePreference } from "../types/models"

const nextTogglePreference = (current: DarkModePreference): DarkModePreference => {
  if (current === "light") return "dark"
  if (current === "dark") return "system"
  return "light"
}

export function DarkModeToggle() {
  const { user } = useCurrentUser()
  const { preference, setPreference } = useThemePreference()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const icon =
    preference === "dark" ? <Moon className="h-4 w-4" /> : preference === "system" ? <Monitor className="h-4 w-4" /> : <Sun className="h-4 w-4" />

  const handleToggle = async () => {
    const next = nextTogglePreference(preference)
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

  const label = preference === "light" ? "Light" : preference === "dark" ? "Dark" : "System"

  if (!isMounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-1 text-xs"
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
      className="group/dm flex items-center gap-1 text-xs"
      title={`Theme: ${label}. Click to switch.`}
    >
      <span className="hidden sm:inline overflow-hidden max-w-0 group-hover/dm:max-w-[6rem] transition-all duration-300 whitespace-nowrap">{label}</span>
      {icon}
    </Button>
  )
}
