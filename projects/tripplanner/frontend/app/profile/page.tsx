"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Skeleton } from "../components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeftIcon, CheckIcon, SaveIcon } from "lucide-react"
import { TimezoneSelector } from "../components/TimeZoneSelector"
import { CurrencyDropdown } from "../components/CurrencyDropdown"
import type { User, PendingUser, CurrencyConversion, DarkModePreference } from "../types/models"
import { currencyApi, userApi } from "../utils/apiClient"
import { getDefaultCurrencyId, useCurrencies } from "../hooks/useCurrencies"
import { useThemePreference } from "../providers/ThemeProvider"
import { setCachedCurrentUser } from "../hooks/useCurrentUser"

const DARK_MODE_OPTIONS: DarkModePreference[] = ["system", "light", "dark"]

const normalizeDarkPreference = (value?: string | null): DarkModePreference =>
  DARK_MODE_OPTIONS.includes((value ?? "system") as DarkModePreference)
    ? ((value ?? "system") as DarkModePreference)
    : "system"

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isApproving, setIsApproving] = useState<Record<string, boolean>>({})
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preferredUtcOffset, setPreferredUtcOffset] = useState(0)
  const [preferredCurrencyId, setPreferredCurrencyId] = useState<number | null>(null)
  const [preferredDarkMode, setPreferredDarkMode] = useState<DarkModePreference>("system")
  const [currencyConversions, setCurrencyConversions] = useState<CurrencyConversion[]>([])
  const [isLoadingConversions, setIsLoadingConversions] = useState(false)
  const [conversionForm, setConversionForm] = useState<{ fromId: number | null; toId: number | null; rate: string }>({
    fromId: null,
    toId: null,
    rate: "",
  })
  const selectedConversion = useMemo(() => {
    if (!conversionForm.fromId || !conversionForm.toId) return null
    return (
      currencyConversions.find(
        (conversion) =>
          conversion.fromCurrencyId === conversionForm.fromId && conversion.toCurrencyId === conversionForm.toId,
      ) ?? null
    )
  }, [conversionForm.fromId, conversionForm.toId, currencyConversions])
  const [isSavingConversion, setIsSavingConversion] = useState(false)
  const conversionPairRef = useRef<{ fromId: number | null; toId: number | null }>({ fromId: null, toId: null })
  const lastAutoRateRef = useRef<string>("")
  const conversionRateRef = useRef<string>("")
  const { toast } = useToast()
  const router = useRouter()
  const { currencies, isLoading: isLoadingCurrencies } = useCurrencies()
  const { setPreference: setThemePreference } = useThemePreference()
  const defaultCurrencyId = useMemo(() => getDefaultCurrencyId(currencies), [currencies])
  const conversionKey = useCallback((fromId: number, toId: number) => `${fromId}-${toId}`, [])
  const [approvalsOpen, setApprovalsOpen] = useState(false)
  const [conversionsOpen, setConversionsOpen] = useState(false)

  const fetchCurrencyConversions = useCallback(async () => {
    if (user?.role !== "admin") return
    setIsLoadingConversions(true)
    try {
      const data = await currencyApi.getConversions()
      setCurrencyConversions(data)
    } catch (err) {
      console.error("Error fetching currency conversions:", err)
      toast({
        title: "Error",
        description: "Failed to load currency conversions",
        variant: "destructive",
      })
    } finally {
      setIsLoadingConversions(false)
    }
  }, [toast, user?.role])

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const pendingData = await userApi.getPendingApprovals()
      setPendingUsers(pendingData)
    } catch (err) {
      console.error("Error fetching pending approvals:", err)
      toast({
        title: "Error",
        description: "Failed to load pending user approvals",
        variant: "destructive",
      })
    }
  }, [toast])

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await userApi.getAccountInfo()
        setUser(userData)
        setPreferredUtcOffset(userData.userPreference?.preferredUtcOffset || 0)
        setPreferredCurrencyId(userData.userPreference?.preferredCurrencyId ?? null)
        setPreferredDarkMode(normalizeDarkPreference(userData.userPreference?.preferredDarkMode))

        if (userData.role === "admin") {
          fetchPendingApprovals()
        }
      } catch (err) {
        console.error("Error fetching user data:", err)
        setError("Failed to load user profile")
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [fetchPendingApprovals])

useEffect(() => {
  if (user?.role === "admin") {
    fetchCurrencyConversions()
  }
}, [user?.role, fetchCurrencyConversions])

useEffect(() => {
  conversionRateRef.current = conversionForm.rate
}, [conversionForm.rate])

useEffect(() => {
  const { fromId, toId } = conversionForm
  const pairChanged = conversionPairRef.current.fromId !== fromId || conversionPairRef.current.toId !== toId
  const targetRate = selectedConversion ? selectedConversion.rate.toString() : ""

  if (pairChanged) {
    conversionPairRef.current = { fromId, toId }
    lastAutoRateRef.current = targetRate
    setConversionForm((prev) => ({ ...prev, rate: targetRate }))
    return
  }

  if (!fromId || !toId) {
    if (conversionRateRef.current !== "") {
      lastAutoRateRef.current = ""
      setConversionForm((prev) => ({ ...prev, rate: "" }))
    }
    return
  }

  if (conversionRateRef.current === lastAutoRateRef.current && conversionRateRef.current !== targetRate) {
    lastAutoRateRef.current = targetRate
    setConversionForm((prev) => ({ ...prev, rate: targetRate }))
  }
}, [conversionForm.fromId, conversionForm.toId, selectedConversion])

  // Handle user approval
  const handleApproveUser = async (userId: string) => {
    setIsApproving((prev) => ({ ...prev, [userId]: true }))

    try {
      await userApi.approveUser(userId)

      // Remove approved user from the list
      setPendingUsers((prev) => prev.filter((user) => user.id !== userId))

      toast({
        title: "Success",
        description: "User has been approved",
        variant: "default",
      })
    } catch (err) {
      console.error("Error approving user:", err)
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive",
      })
    } finally {
      setIsApproving((prev) => ({ ...prev, [userId]: false }))
    }
  }

  const handleConversionSelectChange = (field: "fromId" | "toId", value: string) => {
    const parsed = value ? Number.parseInt(value, 10) : null
    setConversionForm((prev) => ({ ...prev, [field]: parsed }))
  }

  const handleConversionRateChange = (value: string) => {
    setConversionForm((prev) => ({ ...prev, rate: value }))
  }

  const handleSaveConversionForm = async () => {
    const { fromId, toId, rate } = conversionForm
    if (!fromId || !toId) {
      toast({
        title: "Select currencies",
        description: "Choose both source and target currencies",
        variant: "destructive",
      })
      return
    }
    if (fromId === toId) {
      toast({
        title: "Invalid pair",
        description: "Source and target currencies must be different",
        variant: "destructive",
      })
      return
    }
    const parsedRate = Number.parseFloat(rate)
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      toast({
        title: "Invalid rate",
        description: "Enter a positive conversion rate",
        variant: "destructive",
      })
      return
    }

    setIsSavingConversion(true)
    const key = conversionKey(fromId, toId)
    const existing = currencyConversions.find(
      (conversion) => conversion.fromCurrencyId === fromId && conversion.toCurrencyId === toId,
    )
    try {
      await currencyApi.upsertConversion({ fromCurrencyId: fromId, toCurrencyId: toId, rate: parsedRate })
      setCurrencyConversions((prev) => {
        const idx = prev.findIndex((item) => item.fromCurrencyId === fromId && item.toCurrencyId === toId)
        if (idx === -1) return [...prev, { fromCurrencyId: fromId, toCurrencyId: toId, rate: parsedRate }]
        const copy = [...prev]
        copy[idx] = { ...copy[idx], rate: parsedRate }
        return copy
      })
      toast({
        title: existing ? "Conversion updated" : "Conversion added",
        description: existing ? "Rate updated successfully" : "Rate stored successfully",
      })
    } catch (err) {
      console.error("Error adding conversion:", err)
      toast({
        title: "Error",
        description: "Failed to save conversion",
        variant: "destructive",
      })
    } finally {
      setIsSavingConversion(false)
    }
  }

  useEffect(() => {
    if (preferredCurrencyId !== null) return
    const fromUser = user?.userPreference?.preferredCurrencyId
    if (typeof fromUser === "number" && fromUser > 0) {
      setPreferredCurrencyId(fromUser)
      return
    }
    if (defaultCurrencyId) {
      setPreferredCurrencyId(defaultCurrencyId)
    }
  }, [user?.userPreference?.preferredCurrencyId, defaultCurrencyId, preferredCurrencyId])

  const handleSavePreferences = async () => {
    setIsSavingPreferences(true)

    const currencyIdForSave = preferredCurrencyId ?? defaultCurrencyId
    if (!currencyIdForSave) {
      toast({
        title: "Error",
        description: "Please select a preferred currency before saving",
        variant: "destructive",
      })
      setIsSavingPreferences(false)
      return
    }

    try {
      const updatedUser = await userApi.updatePreference({
        preferredUtcOffset,
        preferredCurrencyId: currencyIdForSave,
        preferredDarkMode,
      })

      if (updatedUser) {
        setUser(updatedUser)
        setCachedCurrentUser(updatedUser)
      } else if (user) {
        const nextUser = {
          ...user,
          userPreference: {
            preferredUtcOffset,
            preferredCurrencyId: currencyIdForSave,
            preferredDarkMode,
          },
        }
        setUser(nextUser)
        setCachedCurrentUser(nextUser)
      }

      setThemePreference(preferredDarkMode)

      toast({
        title: "Success",
        description: "User preferences updated successfully",
        variant: "default",
      })
    } catch (err) {
      console.error("Error updating user preferences:", err)
      toast({
        title: "Error",
        description: "Failed to update user preferences",
        variant: "destructive",
      })
    } finally {
      setIsSavingPreferences(false)
    }
  }

  if (isLoading) {
    return <ProfileSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => router.push("/")}>Return to Home</Button>
      </div>
    )
  }

  const currentCurrencySelection = preferredCurrencyId ?? defaultCurrencyId ?? null
  const baselineCurrencyId = user?.userPreference?.preferredCurrencyId ?? defaultCurrencyId ?? null
  const baselineOffset = user?.userPreference?.preferredUtcOffset ?? 0
  const baselineDarkMode = normalizeDarkPreference(user?.userPreference?.preferredDarkMode)
  const preferenceChanged =
    preferredUtcOffset !== baselineOffset ||
    currentCurrencySelection !== baselineCurrencyId ||
    preferredDarkMode !== baselineDarkMode
  const saveDisabled = isSavingPreferences || !preferenceChanged || !currentCurrencySelection

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Button variant="outline" className="mb-6" onClick={() => router.back()}>
        <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back
      </Button>

      {/* User Profile Card */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center gap-4">
          <div>
            <CardTitle className="text-2xl">{user?.name}</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </div>
          <Badge className="ml-auto" variant={user?.role === "admin" ? "default" : "outline"}>
            {user?.role}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-medium">{user?.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium capitalize">{user?.role}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-medium">Preferences</h3>
            <TimezoneSelector
              label="Preferred Timezone"
              value={preferredUtcOffset}
              onChange={setPreferredUtcOffset}
              id="preferred-timezone"
              layout="stacked"
              selectClassName="w-full md:w-64"
            />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Preferred Currency</p>
              {isLoadingCurrencies ? (
                <Skeleton className="h-10 w-64" />
              ) : (
                <CurrencyDropdown
                  value={currentCurrencySelection}
                  onChange={setPreferredCurrencyId}
                  currencies={currencies}
                  placeholder="Select currency"
                  triggerClassName="w-full md:w-64"
                />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Theme</p>
              <Select
                value={preferredDarkMode}
                onValueChange={(value) => setPreferredDarkMode(value as DarkModePreference)}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  {DARK_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "system" ? "System" : option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">System follows your device appearance setting.</p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleSavePreferences}
            disabled={saveDisabled}
          >
            {isSavingPreferences ? (
              <span className="flex items-center">
                <Skeleton className="h-4 w-4 rounded-full mr-2 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center">
                <SaveIcon className="mr-2 h-4 w-4" />
                Save Preferences
              </span>
            )}
          </Button>
        </CardFooter>
      </Card>

      {user?.role === "admin" && (
        <>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Pending User Approvals ({pendingUsers.length})</CardTitle>
                <CardDescription>Approve new users who have registered for the platform</CardDescription>
              </div>
              <Button variant="ghost" onClick={() => setApprovalsOpen((open) => !open)}>
                {approvalsOpen ? "Collapse" : "Expand"}
              </Button>
            </CardHeader>
            {approvalsOpen && (
              <>
                <CardContent>
                  {pendingUsers.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">No pending approvals</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingUsers.map((pendingUser) => (
                          <TableRow key={pendingUser.id}>
                            <TableCell className="font-mono text-xs">{pendingUser.id}</TableCell>
                            <TableCell>{pendingUser.name}</TableCell>
                            <TableCell>{pendingUser.email}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => handleApproveUser(pendingUser.id)}
                                disabled={isApproving[pendingUser.id]}
                              >
                                {isApproving[pendingUser.id] ? (
                                  <span className="flex items-center">
                                    <Skeleton className="h-4 w-4 rounded-full mr-2 animate-spin" />
                                    Approving...
                                  </span>
                                ) : (
                                  <span className="flex items-center">
                                    <CheckIcon className="mr-2 h-4 w-4" />
                                    Approve
                                  </span>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="ml-auto" onClick={fetchPendingApprovals}>
                    Refresh List
                  </Button>
                </CardFooter>
              </>
            )}
          </Card>

          <Card className="mt-8">
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Currency Conversions ({currencyConversions.length})</CardTitle>
                <CardDescription>Update conversion rates used to normalize trip costs</CardDescription>
              </div>
              <Button variant="ghost" onClick={() => setConversionsOpen((open) => !open)}>
                {conversionsOpen ? "Collapse" : "Expand"}
              </Button>
            </CardHeader>
            {conversionsOpen && (
              <CardContent className="space-y-6">
                {isLoadingConversions ? (
                  <Skeleton className="w-full h-32" />
                ) : (
                  <>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Add or update conversion</p>
                      <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">From currency</p>
                          <Select
                            value={conversionForm.fromId?.toString() ?? ""}
                            onValueChange={(value) => handleConversionSelectChange("fromId", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent>
                              {currencies.map((currency) => (
                                <SelectItem key={currency.id} value={currency.id.toString()}>
                                  {currency.symbol} {currency.shortName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">To currency</p>
                          <Select
                            value={conversionForm.toId?.toString() ?? ""}
                            onValueChange={(value) => handleConversionSelectChange("toId", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent>
                              {currencies.map((currency) => (
                                <SelectItem key={currency.id} value={currency.id.toString()}>
                                  {currency.symbol} {currency.shortName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Rate</p>
                          <Input
                            type="number"
                            step="0.000001"
                            min="0"
                            value={conversionForm.rate}
                            onChange={(event) => handleConversionRateChange(event.target.value)}
                            placeholder="e.g. 1.05"
                          />
                        </div>
                        <Button onClick={handleSaveConversionForm} disabled={isSavingConversion}>
                          {isSavingConversion ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>

                    {currencyConversions.length > 0 && (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>From</TableHead>
                              <TableHead>To</TableHead>
                              <TableHead>Rate</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currencyConversions.map((conversion) => {
                              const key = conversionKey(conversion.fromCurrencyId, conversion.toCurrencyId)
                              const fromCurrency = currencies.find((c) => c.id === conversion.fromCurrencyId)
                              const toCurrency = currencies.find((c) => c.id === conversion.toCurrencyId)
                              return (
                                <TableRow key={key}>
                                  <TableCell>{fromCurrency ? `${fromCurrency.symbol} ${fromCurrency.shortName}` : conversion.fromCurrencyId}</TableCell>
                                  <TableCell>{toCurrency ? `${toCurrency.symbol} ${toCurrency.shortName}` : conversion.toCurrencyId}</TableCell>
                                  <TableCell>{conversion.rate}</TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Skeleton className="h-10 w-24 mb-6" />

      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
          <Skeleton className="h-6 w-20 ml-auto" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-5 w-40" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-60 mb-2" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
