using System.Text.Json.Serialization;

namespace Domain.Models;

public sealed class AmadeusFlightOfferResponse
{
    [JsonPropertyName("data")] public List<AmadeusFlightOffer> Data { get; set; } = new();
    [JsonPropertyName("dictionaries")] public AmadeusDictionaries? Dictionaries { get; set; }
}

public sealed class AmadeusFlightOffer
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("price")] public AmadeusPrice? Price { get; set; }
    [JsonPropertyName("itineraries")] public List<AmadeusItinerary> Itineraries { get; set; } = new();
}

public sealed class AmadeusPrice
{
    [JsonPropertyName("currency")] public string? Currency { get; set; }
    [JsonPropertyName("total")] public string? Total { get; set; }
}

public sealed class AmadeusItinerary
{
    [JsonPropertyName("duration")] public string? Duration { get; set; }
    [JsonPropertyName("segments")] public List<AmadeusSegment> Segments { get; set; } = new();
}

public sealed class AmadeusSegment
{
    [JsonPropertyName("departure")] public AmadeusFlightPoint? Departure { get; set; }
    [JsonPropertyName("arrival")] public AmadeusFlightPoint? Arrival { get; set; }
    [JsonPropertyName("carrierCode")] public string? CarrierCode { get; set; }
    [JsonPropertyName("number")] public string? Number { get; set; }
    [JsonPropertyName("duration")] public string? Duration { get; set; }
    [JsonPropertyName("numberOfStops")] public int? NumberOfStops { get; set; }
}

public sealed class AmadeusFlightPoint
{
    [JsonPropertyName("iataCode")] public string? IataCode { get; set; }
    [JsonPropertyName("terminal")] public string? Terminal { get; set; }
    [JsonPropertyName("at")] public DateTime? At { get; set; }
}

public sealed class AmadeusDictionaries
{
    [JsonPropertyName("carriers")] public Dictionary<string, string> Carriers { get; set; } = new();
}
