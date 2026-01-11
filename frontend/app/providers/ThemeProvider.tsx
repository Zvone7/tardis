"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { DarkModePreference } from "../types/models"
import { useCurrentUser } from "../hooks/useCurrentUser"

type ThemeContextValue = {
  preference: DarkModePreference
  resolvedTheme: "light" | "dark"
  setPreference: (value: DarkModePreference) => void
}

const VALID_PREFERENCES: DarkModePreference[] = ["system", "light", "dark"]

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const normalizePreference = (value?: string | null): DarkModePreference => {
  if (!value) return "system"
  const lowered = value.toLowerCase()
  return VALID_PREFERENCES.includes(lowered as DarkModePreference) ? (lowered as DarkModePreference) : "system"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser()
  const [preference, setPreference] = useState<DarkModePreference>("system")
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  })

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => setSystemPrefersDark(media.matches)
    handler()
    media.addEventListener("change", handler)
    return () => media.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    const userPref = normalizePreference(user?.userPreference?.preferredDarkMode ?? null)
    setPreference((prev) => (prev === userPref ? prev : userPref))
  }, [user?.userPreference?.preferredDarkMode])

  const resolvedTheme: "light" | "dark" = preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
  }, [resolvedTheme])

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      setPreference: (value: DarkModePreference) => setPreference(normalizePreference(value)),
    }),
    [preference, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemePreference() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useThemePreference must be used within ThemeProvider")
  return ctx
}
