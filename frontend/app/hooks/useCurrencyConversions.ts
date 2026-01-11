import { useEffect, useState } from "react"

import type { CurrencyConversion } from "../types/models"
import { currencyApi } from "../utils/apiClient"

let cachedConversions: CurrencyConversion[] | null = null
let inflightRequest: Promise<CurrencyConversion[]> | null = null

export function useCurrencyConversions() {
  const [conversions, setConversions] = useState<CurrencyConversion[]>(cachedConversions ?? [])
  const [isLoading, setIsLoading] = useState<boolean>(!cachedConversions)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedConversions) {
      setConversions(cachedConversions)
      setIsLoading(false)
      return
    }

    let isActive = true
    if (!inflightRequest) {
      inflightRequest = currencyApi.getConversions()
    }

    inflightRequest
      ?.then((data) => {
        if (!isActive) return
        cachedConversions = data
        setConversions(data)
        setError(null)
      })
      .catch((err) => {
        if (!isActive) return
        console.error("Failed to load currency conversions:", err)
        setError("Failed to load currency conversions")
      })
      .finally(() => {
        if (!isActive) return
        setIsLoading(false)
        inflightRequest = null
      })

    return () => {
      isActive = false
    }
  }, [])

  return { conversions, isLoading, error }
}
