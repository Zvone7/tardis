"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface FloatingPosition {
  top: number
  left: number
  width: number
  openUpward: boolean
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
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight
    return {
      top: openUpward ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      openUpward,
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
