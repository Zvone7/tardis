import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// === Time helpers (same logic as in the picker; no libs) ===
export function pad(n: number) { return String(n).padStart(2, "0"); }

export function localToUtcMs(local: string, offsetH: number): number {
  if (!local) return Number.NaN;
  const [datePart, timePart] = local.split("T");
  const [y, m, d] = datePart.split("-").map((s) => parseInt(s, 10));
  const [hh, mm] = (timePart || "00:00").split(":").map((s) => parseInt(s, 10));
  const asUtc = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return asUtc - offsetH * 60 * 60 * 1000;
}

export function utcMsToIso(utcMs: number): string {
  return new Date(utcMs).toISOString(); // e.g. 2025-09-04T10:00:00.000Z
}

export function utcIsoToLocalInput(utcIso: string, offsetH: number): string {
  if (!utcIso) return "";
  const normalizedIso = utcIso.endsWith("Z") ? utcIso : `${utcIso}Z`;
  const utcMs = Date.parse(normalizedIso);
  if (!Number.isFinite(utcMs)) return "";
  const localMs = utcMs + offsetH * 60 * 60 * 1000;
  const d = new Date(localMs);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Some offsets are persisted in minutes; normalize to hours for UI math. */
export function normalizeOffsetHours(raw: number | null | undefined): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  // if it looks like minutes (e.g., 60, 120), convert
  if (Math.abs(raw) > 14 && raw % 1 === 0) {
    const divided = raw / 60;
    if (Math.abs(divided) <= 14) return divided;
  }
  return raw;
}

export function formatLocalWithPreferredOffset(
  localValue: string | null,
  originalOffsetH: number | null | undefined,
  preferredOffsetH: number | null | undefined,
): string {
  if (!localValue) return "";
  const baseOffset = normalizeOffsetHours(originalOffsetH);
  const targetOffset = normalizeOffsetHours(preferredOffsetH ?? baseOffset);
  const utcMs = localToUtcMs(localValue, baseOffset);
  if (!Number.isFinite(utcMs)) return localValue.replace("T", " ");
  const shiftedMs = utcMs + targetOffset * 60 * 60 * 1000;
  const date = new Date(shiftedMs);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
  const datePart = date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  const timePart = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${weekday}, ${datePart} ${timePart}`;
}
