// types/models.ts

/* -----------------------------------------------------------------------------
 * Location
 * ---------------------------------------------------------------------------*/
export interface LocationOption {
  id?: number;

  provider: string;        // e.g. "locationiq"
  providerPlaceId: string; // e.g. "156188258"

  name: string;            // e.g. "Oslo"
  country?: string;        // e.g. "Norway"
  countryCode?: string;    // e.g. "no"
  formatted?: string;      // e.g. "Oslo, Norway"

  lat: number;
  lng: number;
}

export interface LocationDto {
  id: number;                 // use 0 for “new” if no DB id
  providerPlaceId: string;
  provider: string;
  name: string;
  countryCode?: string;
  country: string;
  latitude: number;
  longitude: number;
}

/* -----------------------------------------------------------------------------
 * Segment types
 * ---------------------------------------------------------------------------*/
export interface SegmentType {
  id: number;
  name: string;
  shortName?: string;
  description?: string;
  iconSvg?: string;
  color?: string;
}

export interface OptionRef {
  id: number;
  name: string;
}

export interface SegmentSuggestion {
  name?: string;
  startDateLocal?: string;
  endDateLocal?: string;
  locationName?: string;
  startLocationName?: string;
  endLocationName?: string;
  sourceUrl?: string;
  cost?: number;
  currencyCode?: string;
  location?: LocationOption | LocationDto | null;
  startLocation?: LocationOption | LocationDto | null;
  endLocation?: LocationOption | LocationDto | null;
  segmentTypeId?: number | null;
}

/* -----------------------------------------------------------------------------
 * Flight search (Amadeus)
 * ---------------------------------------------------------------------------*/
export interface FlightLocationInput {
  iataCode?: string;
}

export interface AmadeusFlightSearchRequest {
  startLocation: FlightLocationInput;
  endLocation: FlightLocationInput;
  startDateTime: string;
  endDateTime?: string;
  adults?: number;
}

export interface AmadeusFlightOfferResponse {
  data: AmadeusFlightOffer[];
  dictionaries?: AmadeusDictionaries;
}

export interface AmadeusFlightOffer {
  id?: string;
  price?: {
    currency?: string;
    total?: string;
  };
  itineraries?: AmadeusItinerary[];
}

export interface AmadeusItinerary {
  duration?: string;
  segments?: AmadeusSegment[];
}

export interface AmadeusSegment {
  departure?: AmadeusFlightPoint;
  arrival?: AmadeusFlightPoint;
  carrierCode?: string;
  number?: string;
  duration?: string;
  numberOfStops?: number;
}

export interface AmadeusFlightPoint {
  iataCode?: string;
  terminal?: string;
  at?: string;
}

export interface AmadeusDictionaries {
  carriers?: Record<string, string>;
}

/* -----------------------------------------------------------------------------
 * Accommodations (Amadeus)
 * ---------------------------------------------------------------------------*/
export interface AmadeusHotelSearchRequest {
  cityName: string;
  cityCode?: string;
  countryCode?: string;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
}

export interface AmadeusHotelOfferResponse {
  data: AmadeusHotelOffer[];
}

export interface AmadeusHotelOffer {
  hotel?: AmadeusHotel;
  offers?: AmadeusHotelOfferItem[];
}

export interface AmadeusHotel {
  name?: string;
  cityCode?: string;
  rating?: string;
  address?: AmadeusHotelAddress;
}

export interface AmadeusHotelAddress {
  cityName?: string;
  countryCode?: string;
}

export interface AmadeusHotelOfferItem {
  checkInDate?: string;
  checkOutDate?: string;
  price?: AmadeusHotelPrice;
}

export interface AmadeusHotelPrice {
  currency?: string;
  total?: string;
}

/* -----------------------------------------------------------------------------
 * Airports catalog
 * ---------------------------------------------------------------------------*/
export interface AirportLookupResult {
  code: string;
  name: string;
  city: string;
  cityCode?: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timeZone?: string;
}

export interface SegmentApi {
  id: number;
  tripId?: number; // optional if not always returned
  name: string;

  // Timing
  startDateTimeUtc: string;
  startDateTimeUtcOffset: number;
  endDateTimeUtc: string;
  endDateTimeUtcOffset: number;

  segmentTypeId: number;
  cost: number;
  currencyId: number;

  comment?: string;
  color?: string;
  isUiVisible: boolean;

  startLocation?: LocationOption | LocationDto | null;
  endLocation?: LocationOption | LocationDto | null;
}

export interface Segment extends SegmentApi {
  connectedOptions?: OptionRef[]; // optional UI add-on
}

export type SegmentSave = Omit<SegmentApi, "id">;

export interface SegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (segment: SegmentSave, isUpdate: boolean, originalSegmentId?: number) => Promise<void>;
  segment?: Segment | null;
  tripId: number;
  tripName?: string;
  segmentTypes: SegmentType[];
  options?: OptionApi[];
  tripSegments?: SegmentApi[];
  tripCurrencyId?: number | null;
  displayCurrencyId?: number | null;
  initialOptionFilters?: OptionFilterPreset;
  initialOptionSort?: SimpleOptionSortValue | null;
  existingLocations?: LocationOption[];
}

export interface OptionFilterPreset {
  locations: string[];
  dateRange: { start: string; end: string };
  costMin?: number | null;
  costMax?: number | null;
  showHidden: boolean;
}

export type SimpleOptionSortValue = {
  field: "startDate" | "endDate" | "totalCost" | "totalDays";
  direction: "asc" | "desc";
};

/* -----------------------------------------------------------------------------
 * Trip types
 * ---------------------------------------------------------------------------*/
export interface Trip {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  startTime: string | null;
  endTime: string | null;
  currencyId: number;
}

export type TripSave = Omit<Trip, "id">;


/* -----------------------------------------------------------------------------
 * Option types
 * ---------------------------------------------------------------------------*/
export interface OptionApi {
  id: number;
  name: string;
  startDateTimeUtc: string | null;
  endDateTimeUtc: string | null;
  tripId: number;
  isUiVisible: boolean;

  totalCost: number;
  totalDays: number;
  costPerDay: number;
  costPerType: Record<string | number, number>;
}

export type OptionSave = Omit<OptionApi, "id" | "totalCost" | "totalDays">;

/* -----------------------------------------------------------------------------
 * Currency
 * ---------------------------------------------------------------------------*/
export interface Currency {
  id: number;
  symbol: string;
  shortName: string;
  name: string;
}

export interface CurrencyConversion {
  fromCurrencyId: number;
  toCurrencyId: number;
  rate: number;
}

/* -----------------------------------------------------------------------------
 * User
 * ---------------------------------------------------------------------------*/
export type DarkModePreference = "system" | "light" | "dark"

export interface UserPreference {
  preferredUtcOffset: number;
  preferredCurrencyId: number;
  preferredDarkMode?: DarkModePreference;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  imageUrl?: string;
  userPreference?: UserPreference | null;
}

export interface PendingUser {
  id: string;
  name: string;
  email: string;
}
