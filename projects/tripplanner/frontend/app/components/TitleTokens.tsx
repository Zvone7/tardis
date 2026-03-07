"use client"

import type { TitleToken } from "../utils/formatters"
import { cn } from "../lib/utils"

interface TitleTokensProps {
  tokens: TitleToken[]
  size?: "default" | "sm"
}

const textSizes = {
  default: "text-base",
  sm: "text-sm",
} as const

const badgeTextSizes = {
  default: "text-xs",
  sm: "text-[11px]",
} as const

const stackGap = {
  default: "gap-1",
  sm: "gap-0.5",
} as const

export function TitleTokens({ tokens, size = "default" }: TitleTokensProps) {
  if (!tokens.length) return null

  const [primary, ...rest] = tokens

  return (
    <div className={cn("flex flex-col", stackGap[size])}>
      <div className={cn("inline-flex items-center gap-1", textSizes[size])}>
        {renderIcon(primary)}
        <span
          className={cn(
            "font-medium",
            primary.emphasize ? "italic" : undefined,
          )}
        >
          {primary.text}
        </span>
      </div>

      {rest.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {rest.map((token, idx) => (
            <span
              key={`token-pill-${token.key}-${idx}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-muted-foreground",
                badgeTextSizes[size],
              )}
            >
              {renderIcon(token)}
              <span>{token.text}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function renderIcon(token: TitleToken) {
  if (!token.iconSvg) return null
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary/70 text-secondary-foreground shadow-sm ring-1 ring-black/5 dark:bg-white dark:text-black"
      aria-hidden="true"
    >
      <span
        className="h-3.5 w-3.5"
        dangerouslySetInnerHTML={{ __html: token.iconSvg }}
        suppressHydrationWarning
      />
    </span>
  )
}
