"use client"

import { useState } from "react"
import { MoreVertical } from "lucide-react"
import { Button } from "./ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import Link from "next/link"

const envCode = process.env.NEXT_PUBLIC_ENV_CODE?.toLowerCase()
const isLocalOrDev = !envCode
  ? process.env.NODE_ENV !== "production"
  : envCode === "local" || envCode === "dev"

const menuItems = [
  ...(isLocalOrDev ? [{ href: "/status", label: "Status" }] : []),
]

export function DevMenu() {
  const [open, setOpen] = useState(false)

  if (menuItems.length === 0) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-36 p-1">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  )
}
