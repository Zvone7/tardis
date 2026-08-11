import { CircleDollarSign } from "lucide-react"
import { Button } from "../ui/button"
import { FilterDualSection } from "./FilterDualSection"

interface CostDualFilterProps {
  costMin: number | null
  costMax: number | null
  onCostMinChange: (costMin: number | null) => void
  onCostMaxChange: (costMax: number | null) => void
  costMinChips?: number[]
  costMaxChips?: number[]
  allSameCost?: boolean
  currencyLabel?: string
  expanded: boolean
  onToggle: () => void
  shakeKey?: number
}

export function CostDualFilter({
  costMin,
  costMax,
  onCostMinChange,
  onCostMaxChange,
  costMinChips,
  costMaxChips,
  allSameCost,
  currencyLabel,
  expanded,
  onToggle,
  shakeKey = 0,
}: CostDualFilterProps) {
  const minArr = costMinChips ?? []
  const maxArr = costMaxChips ?? []

  return (
    <FilterDualSection
      icon={<CircleDollarSign className="h-6 w-6" />}
      expanded={expanded}
      onToggle={onToggle}
      shakeKey={shakeKey}
      left={{
        label: `Min${currencyLabel ? ` (${currencyLabel})` : ""}`,
        selectedCount: costMin != null ? minArr.filter((c) => c >= costMin).length : undefined,
        totalCount: costMin != null ? minArr.length : undefined,
        showCountWhenAll: false,
        showCountWhenNone: false,
        hideCount: true,
        onReset: () => onCostMinChange(null),
        children: allSameCost ? (
          <span className="text-xs text-muted-foreground">All same cost</span>
        ) : (
          <>
            {minArr.map((amount, idx, arr) => {
              const isSelected = costMin == null || amount >= costMin
              return (
                <Button
                  key={amount}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isSelected) {
                      const nextIdx = idx + 1
                      onCostMinChange(nextIdx < arr.length ? arr[nextIdx] : null)
                    } else {
                      // If selecting the first chip, reset to null (all selected)
                      onCostMinChange(idx === 0 ? null : amount)
                    }
                  }}
                >
                  ≥ {amount.toLocaleString()}
                </Button>
              )
            })}
            {minArr.length === 0 && <span className="text-xs text-muted-foreground">No data</span>}
          </>
        ),
      }}
      right={{
        label: `Max${currencyLabel ? ` (${currencyLabel})` : ""}`,
        selectedCount: costMax != null ? maxArr.filter((c) => c <= costMax).length : undefined,
        totalCount: costMax != null ? maxArr.length : undefined,
        showCountWhenAll: false,
        showCountWhenNone: false,
        hideCount: true,
        onReset: () => onCostMaxChange(null),
        children: allSameCost ? (
          <span className="text-xs text-muted-foreground">All same cost</span>
        ) : (
          <>
            {maxArr.map((amount, idx, arr) => {
              const isSelected = costMax == null || amount <= costMax
              return (
                <Button
                  key={amount}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isSelected) {
                      const prevIdx = idx - 1
                      onCostMaxChange(prevIdx >= 0 ? arr[prevIdx] : null)
                    } else {
                      // If selecting the last chip, reset to null (all selected)
                      onCostMaxChange(idx === arr.length - 1 ? null : amount)
                    }
                  }}
                >
                  ≤ {amount.toLocaleString()}
                </Button>
              )
            })}
            {maxArr.length === 0 && <span className="text-xs text-muted-foreground">No data</span>}
          </>
        ),
      }}
    />
  )
}
