export interface LocationChip {
  key: string
  label: string
}

export function getLocationKey(loc: any | null): string {
  if (!loc) return ""
  const name = (loc.name ?? "").toLowerCase().trim()
  const country = (loc.country ?? "").toLowerCase().trim()
  if (name || country) return `${name}|${country}`
  const provider = loc.provider ?? ""
  const id = loc.providerPlaceId ?? ""
  return `${provider}:${id}`
}

export function getLocationLabel(loc: any | null): string {
  if (!loc) return ""
  if (loc.formatted) return loc.formatted
  const name = loc.name ?? ""
  const country = loc.country ?? ""
  return country ? `${name}, ${country}` : name
}

export function sortLocationChips(chips: LocationChip[]): LocationChip[] {
  return chips.slice().sort((a, b) => {
    const commaA = a.label.indexOf(", ")
    const commaB = b.label.indexOf(", ")
    const cityA = commaA >= 0 ? a.label.slice(0, commaA) : a.label
    const cityB = commaB >= 0 ? b.label.slice(0, commaB) : b.label
    const countryA = commaA >= 0 ? a.label.slice(commaA + 2) : ""
    const countryB = commaB >= 0 ? b.label.slice(commaB + 2) : ""
    const cmp = countryA.localeCompare(countryB)
    if (cmp !== 0) return cmp
    return cityA.localeCompare(cityB)
  })
}

export function collectLocationIntoMap(map: Map<string, string>, loc: any | null): void {
  if (!loc) return
  const key = getLocationKey(loc)
  if (!key) return
  const label = getLocationLabel(loc)
  if (!label) return
  const existing = map.get(key)
  if (!existing || (!existing.includes(", ") && label.includes(", "))) {
    map.set(key, label)
  }
}
