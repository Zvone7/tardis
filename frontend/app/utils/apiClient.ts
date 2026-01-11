import type {
  OptionApi,
  OptionSave,
  SegmentApi,
  SegmentSave,
  SegmentType,
  OptionRef,
  Trip,
  TripSave,
  User,
  UserPreference,
  LocationOption,
  PendingUser,
  Currency,
  CurrencyConversion,
  SegmentSuggestion,
  AmadeusFlightOfferResponse,
  AmadeusFlightSearchRequest,
  AirportLookupResult,
} from "../types/models"

export type ResponseType = "json" | "text" | "void"

interface RequestOptions extends RequestInit {
  responseType?: ResponseType
}

async function request<T = void>(url: string, options: RequestOptions = {}): Promise<T> {
  const { responseType = "json", headers, ...rest } = options

  const res = await fetch(url, {
    credentials: "include",
    ...rest,
    headers,
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText)
    throw new Error(errorText || `Request failed: ${res.status}`)
  }

  if (responseType === "void") return undefined as T
  if (responseType === "text") {
    const text = await res.text()
    return text as T
  }

  const raw = await res.text()
  const trimmed = raw.trim()
  if (!trimmed) return undefined as T
  try {
    return JSON.parse(trimmed) as T
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to parse JSON response: ${message}`)
  }
}

const jsonHeaders = { "Content-Type": "application/json" }

export const homeApi = {
  getStatus: () => request<string>("/api/home/status", { responseType: "text", cache: "no-store" }),
}

export const tripsApi = {
  getAll: () => request<Trip[]>("/api/trip/getalltrips"),
  getById: (tripId: string | number) => request<Trip>(`/api/trip/gettripbyid?tripId=${tripId}`),
  create: (trip: TripSave) =>
    request<Trip>("/api/trip/createtrip", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(trip),
    }),
  update: (tripId: number, trip: TripSave) =>
    request<Trip>(`/api/trip/updatetrip?tripId=${tripId}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(trip),
    }),
  remove: (tripId: number) => request<void>(`/api/trip/deletetrip?tripId=${tripId}`, { method: "DELETE", responseType: "void" }),
}

export const segmentsApi = {
  getTypes: () => request<SegmentType[]>("/api/Segment/GetSegmentTypes"),
  getByTripId: (tripId: string | number) => request<SegmentApi[]>(`/api/Segment/GetSegmentsByTripId?tripId=${tripId}`),
  parseBookingLink: (url: string) =>
    request<SegmentSuggestion>(`/api/Segment/ParseBookingLink?url=${encodeURIComponent(url)}`),
  parseFlightsLink: (url: string) =>
    request<SegmentSuggestion>(`/api/Segment/ParseFlightsLink?url=${encodeURIComponent(url)}`),
  getConnectedOptions: (tripId: string | number, segmentId: number) =>
    request<OptionRef[]>(`/api/Segment/GetConnectedOptions?tripId=${tripId}&segmentId=${segmentId}`),
  getConnectedSegments: (tripId: string | number, optionId: number) =>
    request<SegmentApi[]>(`/api/Option/GetConnectedSegments?tripId=${tripId}&optionId=${optionId}`),
  create: (tripId: string | number, payload: SegmentSave) =>
    request<SegmentApi>(`/api/Segment/CreateSegment?tripId=${tripId}`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  update: (tripId: string | number, payload: SegmentSave & { id: number }) =>
    request<SegmentApi>(`/api/Segment/UpdateSegment?tripId=${tripId}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  remove: (tripId: string | number, segmentId: number) =>
    request<void>(`/api/Segment/DeleteSegment?tripId=${tripId}&segmentId=${segmentId}`, { method: "DELETE", responseType: "void" }),
  updateConnectedOptions: (tripId: string | number, payload: { SegmentId: number; OptionIds: number[] }) =>
    request<void>(`/api/Segment/UpdateConnectedOptions?tripId=${tripId}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
      responseType: "void",
    }),
}

export const optionsApi = {
  getByTripId: (tripId: string | number) => request<OptionApi[]>(`/api/Option/GetOptionsByTripId?tripId=${tripId}`),
  create: (tripId: string | number, payload: OptionSave) =>
    request<OptionApi>(`/api/Option/CreateOption?tripId=${tripId}`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  update: (tripId: string | number, payload: OptionSave & { id: number }) =>
    request<OptionApi>(`/api/Option/UpdateOption?tripId=${tripId}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  remove: (tripId: string | number, optionId: number) =>
    request<void>(`/api/Option/DeleteOption?tripId=${tripId}&optionId=${optionId}`, { method: "DELETE", responseType: "void" }),
  getConnectedSegments: (tripId: string | number, optionId: number) =>
    segmentsApi.getConnectedSegments(tripId, optionId),
  updateConnectedSegments: (tripId: string | number, optionId: number, segmentIds: number[]) =>
    request<void>(`/api/Option/UpdateConnectedSegments?tripId=${tripId}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ OptionId: optionId, SegmentIds: segmentIds }),
      responseType: "void",
    }),
}

export const userApi = {
  getAccountInfo: () => request<User>("/api/account/info"),
  logout: () => request<void>("/api/account/logout", { method: "POST", responseType: "void" }),
  getPendingApprovals: () => request<PendingUser[]>("/api/user/pendingapprovals"),
  approveUser: (userId: string) =>
    request<void>(`/api/user/approveuser?userIdToApprove=${userId}`, { method: "POST", responseType: "void" }),
  updatePreference: (payload: { preferredUtcOffset: number; preferredCurrencyId: number; preferredDarkMode: string }) =>
    request<User>("/api/user/UpdateUserPreference", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  updateDarkMode: (payload: { preferredDarkMode: string }) =>
    request<User>("/api/user/UpdateDarkModePreference", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
}

export const geocodingApi = {
  search: (endpoint: string, query: string, signal?: AbortSignal) =>
    request<LocationOption[]>(`${endpoint}?q=${encodeURIComponent(query)}`, { signal }),
  reverse: (lat: number, lon: number, signal?: AbortSignal) =>
    request<LocationOption | null>(`/api/geocode/reverse?lat=${lat}&lon=${lon}`, { signal }),
  airport: (code: string, signal?: AbortSignal) =>
    request<LocationOption | null>(`/api/geocode/airport?code=${encodeURIComponent(code)}`, { signal }),
}

export const locationApi = {
  search: geocodingApi.search,
}

export const currencyApi = {
  getCurrencies: () => request<Currency[]>("/api/Currency/GetCurrencies"),
  getConversions: () => request<CurrencyConversion[]>("/api/Currency/GetConversions"),
  upsertConversion: (payload: CurrencyConversion) =>
    request<void>("/api/Currency/UpsertConversion", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
      responseType: "void",
    }),
}

export const scrapingApi = {
  searchFlights: (payload: AmadeusFlightSearchRequest) =>
    request<AmadeusFlightOfferResponse>("/api/scraping/amadeus/flight-offers", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
}

export const airportsApi = {
  search: (query: string, signal?: AbortSignal) =>
    request<AirportLookupResult[]>(`/api/scraping/airports/search?q=${encodeURIComponent(query)}`, { signal }),
}
