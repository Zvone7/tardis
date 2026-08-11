"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface FloatingPosition {
  top: number
  left: number
  width: number
  openUpward: boolean
  maxHeight: number
}

/**
 * Computes a fixed-position for a floating dropdown panel based on
 * the trigger element's bounding rect. Escapes overflow:hidden containers.
 */
export function useFloatingPosition(
  triggerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  dropdownHeight = 280,
): FloatingPosition | null {
  const [pos, setPos] = useState<FloatingPosition | null>(null)

  const compute = useCallback(() => {
    const el = triggerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    // Prefer below when there's room; fall back to whichever side is larger
    const openUpward = spaceBelow >= dropdownHeight ? false : spaceAbove > spaceBelow
    const availableSpace = openUpward ? spaceAbove : spaceBelow
    const maxHeight = Math.max(120, availableSpace - 8)
    return {
      top: openUpward ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      openUpward,
      maxHeight,
    }
  }, [triggerRef, dropdownHeight])

  useEffect(() => {
    if (!isOpen) {
      setPos(null)
      return
    }
    setPos(compute())
    const update = () => setPos(compute())
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [isOpen, compute])

  return pos
}
