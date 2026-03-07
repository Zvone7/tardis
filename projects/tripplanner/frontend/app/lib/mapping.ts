import type { LocationOption, LocationDto, SegmentSave } from "../types/models";

export function toLocationDto(loc: LocationOption | null): LocationDto | null {
  if (!loc) return null;
  return {
    id: loc.id ?? 0,
    providerPlaceId: loc.providerPlaceId,
    provider: loc.provider,
    name: loc.name,
    countryCode: loc.countryCode,
    country: loc.country ?? "",
    latitude: loc.lat,
    longitude: loc.lng,
  };
}

export function normalizeLocation(x: any): LocationOption | null {
  if (!x) return null;
  return {
    id: x.id ?? x.Id ?? undefined,
    provider: x.provider ?? x.Provider ?? "locationiq",
    providerPlaceId: x.providerPlaceId ?? x.ProviderPlaceId ?? "",
    name: x.name ?? x.Name ?? "",
    country: x.country ?? x.Country ?? undefined,
    countryCode: x.countryCode ?? x.CountryCode ?? undefined,
    formatted: x.formatted ?? x.Formatted ?? undefined,
    lat: x.lat ?? x.latitude ?? x.Latitude ?? 0,
    lng: x.lng ?? x.longitude ?? x.Longitude ?? 0,
  };
}
