import type { Currency, CurrencyConversion } from "../types/models"

export interface FormatCurrencyOptions {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  includeCode?: boolean
  fallback?: string
}

const DEFAULT_DIGITS = 2

export const formatCurrencyAmount = (
  amount: number | null | undefined,
  currencyId: number | null | undefined,
  currencies: Currency[],
  options: FormatCurrencyOptions = {},
): string => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return options.fallback ?? "—"
  }
  const currency = currencies.find((c) => c.id === currencyId) ?? null
  const minimumFractionDigits = options.minimumFractionDigits ?? DEFAULT_DIGITS
  const maximumFractionDigits = options.maximumFractionDigits ?? DEFAULT_DIGITS
  const formatter = new Intl.NumberFormat("en-US", { minimumFractionDigits, maximumFractionDigits })
  const formatted = formatter.format(Number(amount))

  if (!currency) return formatted
  const symbol = currency.symbol ?? ""
  const code = currency.shortName ?? ""
  const includeCode = options.includeCode !== false
  return includeCode ? `${symbol}${formatted} ${code}`.trim() : `${symbol}${formatted}`.trim()
}

type ConversionGraph = Map<number, Array<{ to: number; rate: number }>>

const buildGraph = (conversions: CurrencyConversion[]): ConversionGraph => {
  const graph: ConversionGraph = new Map()
  for (const conv of conversions) {
    if (!graph.has(conv.fromCurrencyId)) graph.set(conv.fromCurrencyId, [])
    graph.get(conv.fromCurrencyId)?.push({ to: conv.toCurrencyId, rate: conv.rate })
  }
  return graph
}

export const findConversionRate = (
  fromCurrencyId: number | null | undefined,
  toCurrencyId: number | null | undefined,
  conversions: CurrencyConversion[],
): number | null => {
  if (!fromCurrencyId || !toCurrencyId) return null
  if (fromCurrencyId === toCurrencyId) return 1
  if (!conversions.length) return null

  const graph = buildGraph(conversions)
  const visited = new Set<number>([fromCurrencyId])
  const queue: Array<{ id: number; rate: number }> = [{ id: fromCurrencyId, rate: 1 }]

  while (queue.length) {
    const current = queue.shift()
    if (!current) break
    const neighbors = graph.get(current.id)
    if (!neighbors) continue
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.to)) continue
      const nextRate = current.rate * neighbor.rate
      if (neighbor.to === toCurrencyId) return nextRate
      visited.add(neighbor.to)
      queue.push({ id: neighbor.to, rate: nextRate })
    }
  }
  return null
}

export const convertAmount = (
  amount: number | null | undefined,
  fromCurrencyId: number | null | undefined,
  toCurrencyId: number | null | undefined,
  conversions: CurrencyConversion[],
): number | null => {
  if (amount === null || amount === undefined) return null
  if (fromCurrencyId === null || fromCurrencyId === undefined) return null
  if (toCurrencyId === null || toCurrencyId === undefined) return null
  if (Number.isNaN(Number(amount))) return null
  if (fromCurrencyId === toCurrencyId) return Number(amount)

  const rate = findConversionRate(fromCurrencyId, toCurrencyId, conversions)
  if (rate === null) return null
  return Number(amount) * rate
}

export const formatConvertedAmount = ({
  amount,
  fromCurrencyId,
  toCurrencyId,
  currencies,
  conversions,
  options,
}: {
  amount: number | null | undefined
  fromCurrencyId: number | null | undefined
  toCurrencyId: number | null | undefined
  currencies: Currency[]
  conversions: CurrencyConversion[]
  options?: FormatCurrencyOptions
}) => {
  const converted = convertAmount(amount ?? null, fromCurrencyId, toCurrencyId, conversions)
  if (converted === null) return null
  return formatCurrencyAmount(converted, toCurrencyId, currencies, options)
}

export interface ConvertedAmountResult {
  amount: number
  currencyId: number | null
  converted: boolean
}

export const convertWithFallback = ({
  amount,
  fromCurrencyId,
  toCurrencyId,
  conversions,
}: {
  amount: number | null | undefined
  fromCurrencyId: number | null | undefined
  toCurrencyId: number | null | undefined
  conversions: CurrencyConversion[]
}): ConvertedAmountResult => {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount)) {
    return { amount: 0, currencyId: fromCurrencyId ?? toCurrencyId ?? null, converted: false }
  }
  if (!fromCurrencyId && !toCurrencyId) {
    return { amount: numericAmount, currencyId: null, converted: false }
  }
  if (!fromCurrencyId) {
    return { amount: numericAmount, currencyId: toCurrencyId ?? null, converted: false }
  }
  if (!toCurrencyId || toCurrencyId === fromCurrencyId) {
    return { amount: numericAmount, currencyId: fromCurrencyId ?? toCurrencyId ?? null, converted: false }
  }
  const converted = convertAmount(numericAmount, fromCurrencyId, toCurrencyId, conversions)
  if (converted === null) {
    return { amount: numericAmount, currencyId: fromCurrencyId, converted: false }
  }
  return { amount: converted, currencyId: toCurrencyId, converted: true }
}
