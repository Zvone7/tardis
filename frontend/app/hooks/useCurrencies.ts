import { useEffect, useState } from "react"

import type { Currency } from "../types/models"
import { currencyApi } from "../utils/apiClient"

export const DEFAULT_CURRENCY_SHORT_NAME = "EUR"

let cachedCurrencies: Currency[] | null = null
let inflightRequest: Promise<Currency[]> | null = null

export function useCurrencies() {
  const [currencies, setCurrencies] = useState<Currency[]>(cachedCurrencies ?? [])
  const [isLoading, setIsLoading] = useState<boolean>(!cachedCurrencies)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedCurrencies) {
      setCurrencies(cachedCurrencies)
      setIsLoading(false)
      return
    }

    let isActive = true

    if (!inflightRequest) {
      inflightRequest = currencyApi.getCurrencies()
    }

    inflightRequest
      ?.then((data) => {
        if (!isActive) return
        cachedCurrencies = data
        setCurrencies(data)
        setError(null)
      })
      .catch((err) => {
        if (!isActive) return
        console.error("Failed to load currencies:", err)
        setError("Failed to load currencies")
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

  return { currencies, isLoading, error }
}

export function getDefaultCurrencyId(
  currencies: Currency[],
  fallbackShortName: string = DEFAULT_CURRENCY_SHORT_NAME,
): number | null {
  if (!currencies.length) return null
  const upper = fallbackShortName.toUpperCase()
  const match = currencies.find((currency) => currency.shortName?.toUpperCase() === upper)
  return match?.id ?? null
}
