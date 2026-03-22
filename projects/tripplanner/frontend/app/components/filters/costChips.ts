function pickEvenly(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr
  const step = (arr.length - 1) / (n - 1)
  return Array.from({ length: n }, (_, i) => arr[Math.round(i * step)])
}

export function computeCostChips(costs: number[]): { minChips: number[]; maxChips: number[]; allSameCost: boolean } {
  const valid = costs.filter((c) => c > 0)
  if (valid.length === 0) return { minChips: [], maxChips: [], allSameCost: false }

  const sorted = [...valid].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const range = max - min

  if (range === 0) return { minChips: [], maxChips: [], allSameCost: true }

  const step = range > 10000 ? 2000 : range > 5000 ? 1000 : range > 1000 ? 500 : range > 500 ? 100 : 50
  const chips: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    chips.push(v)
  }
  if (chips.length === 0) chips.push(Math.round(min), Math.round(max))

  const deduped = Array.from(new Set(chips)).sort((a, b) => a - b)
  return {
    minChips: pickEvenly(deduped, 5),
    maxChips: pickEvenly(deduped, 5),
    allSameCost: false,
  }
}
