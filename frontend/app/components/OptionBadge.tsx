import React from "react";
import { EyeOffIcon } from "lucide-react";
import { cn } from "../lib/utils";

const PALETTES = [
  { bg: "bg-blue-100 dark:bg-blue-900/30",  fg: "text-blue-800 dark:text-blue-200",  ring: "ring-blue-300/40 dark:ring-blue-800/40" },
  { bg: "bg-green-100 dark:bg-green-900/30", fg: "text-green-800 dark:text-green-200", ring: "ring-green-300/40 dark:ring-green-800/40" },
  { bg: "bg-purple-100 dark:bg-purple-900/30", fg: "text-purple-800 dark:text-purple-200", ring: "ring-purple-300/40 dark:ring-purple-800/40" },
  { bg: "bg-pink-100 dark:bg-pink-900/30",   fg: "text-pink-800 dark:text-pink-200",   ring: "ring-pink-300/40 dark:ring-pink-800/40" },
  { bg: "bg-amber-100 dark:bg-amber-900/30",  fg: "text-amber-800 dark:text-amber-200", ring: "ring-amber-300/40 dark:ring-amber-800/40" },
  { bg: "bg-red-100 dark:bg-red-900/30",     fg: "text-red-800 dark:text-red-200",     ring: "ring-red-300/40 dark:ring-red-800/40" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/30", fg: "text-indigo-800 dark:text-indigo-200", ring: "ring-indigo-300/40 dark:ring-indigo-800/40" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/30",   fg: "text-cyan-800 dark:text-cyan-200",   ring: "ring-cyan-300/40 dark:ring-cyan-800/40" },
  { bg: "bg-teal-100 dark:bg-teal-900/30",   fg: "text-teal-800 dark:text-teal-200",   ring: "ring-teal-300/40 dark:ring-teal-800/40" },
  { bg: "bg-rose-100 dark:bg-rose-900/30",   fg: "text-rose-800 dark:text-rose-200",   ring: "ring-rose-300/40 dark:ring-rose-800/40" },
];

// Simple FNV-1a string hashing
function hashString(str: string): number {
  let h = 2166136261 | 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

// Mixed hash for number or string key
function paletteForKey(key: string) {
  let h = hashString(key);

  // Same mixing function as before
  h = (h ^ 61) ^ (h >>> 16);
  h = (h + (h << 3)) | 0;
  h = h ^ (h >>> 4);
  h = Math.imul(h, 0x27d4eb2d);
  h = h ^ (h >>> 15);

  const idx = Math.abs(h) % PALETTES.length;
  return PALETTES[idx];
}

export function OptionBadge({
  id,
  name,
  className = "",
  title,
  isHidden = false,
}: {
  id?: number; // 👈 now optional
  name: string;
  className?: string;
  title?: string;
  isHidden?: boolean;
}) {
  // Prefer id if provided, otherwise use name
  const pal = paletteForKey(name + (id ?? "").toString());

  const baseClasses = [
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
    "ring-1 ring-inset",
    className,
  ];

  const paletteClasses = isHidden
    ? ["bg-muted", "text-muted-foreground", "ring-muted-foreground/40"]
    : [pal.bg, pal.fg, pal.ring];

  return (
    <span
      className={cn(...baseClasses, ...paletteClasses)}
      title={title ?? name}
      aria-label={name}
    >
      {isHidden && <EyeOffIcon className="mr-1 h-3 w-3" aria-hidden="true" />}
      {name}
    </span>
  );
}
