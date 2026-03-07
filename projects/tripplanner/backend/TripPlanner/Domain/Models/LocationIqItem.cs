using System.Text.Json.Serialization;


namespace Domain.Models;

public sealed class LocationIqItem
{
    [JsonPropertyName("place_id")] public string? PlaceId { get; set; }
    [JsonPropertyName("display_name")] public string? DisplayName { get; set; }
    [JsonPropertyName("lat")] public string? Lat { get; set; } 
    [JsonPropertyName("lon")] public string? Lon { get; set; }

    [JsonPropertyName("address")] public LocationIqAddress? Address { get; set; }
    
    // [JsonPropertyName("boundingbox")] public string[]? BoundingBox { get; set; }
}

public sealed class LocationIqAddress
{
    [JsonPropertyName("city")] public string? City { get; set; }
    [JsonPropertyName("town")] public string? Town { get; set; }
    [JsonPropertyName("village")] public string? Village { get; set; }
    [JsonPropertyName("municipality")] public string? Municipality { get; set; }
    [JsonPropertyName("hamlet")] public string? Hamlet { get; set; }
    [JsonPropertyName("state")] public string? State { get; set; }
    [JsonPropertyName("country")] public string? Country { get; set; }
    [JsonPropertyName("country_code")] public string? CountryCode { get; set; }
}

public sealed class LocationSearchResult
{
    /// <summary>Constant provider tag so you can support others later.</summary>
    public string Provider { get; init; } = "locationiq";

    /// <summary>Provider-level stable id (stringified place_id or fallback).</summary>
    [JsonPropertyName("providerPlaceId")]
    public string Provider_Place_Id { get; init; } = "";

    /// <summary>Short name (city/town/village/municipality/hamlet best guess).</summary>
    public string Name { get; init; } = "";

    /// <summary>Country name.</summary>
    public string? Country { get; init; }

    /// <summary>ISO 3166-1 alpha-2 (lowercase from API).</summary>
    [JsonPropertyName("countryCode")]
    public string? Country_Code { get; init; }

    public double Lat { get; init; }
    public double Lng { get; init; }

    /// <summary>Full formatted string from provider.</summary>
    public string Formatted { get; init; } = "";

    public static LocationSearchResult FromLocationIq(LocationIqItem i)
    {
        var name =
            i.Address?.City
            ?? i.Address?.Town
            ?? i.Address?.Village
            ?? i.Address?.Municipality
            ?? i.Address?.Hamlet
            ?? i.DisplayName
            ?? "";

        double.TryParse(i.Lat, System.Globalization.NumberStyles.Float,
            System.Globalization.CultureInfo.InvariantCulture, out var lat);
        double.TryParse(i.Lon, System.Globalization.NumberStyles.Float,
            System.Globalization.CultureInfo.InvariantCulture, out var lon);

        var placeId = (i.PlaceId?.ToString() ?? $"{i.Lat},{i.Lon}") ?? Guid.NewGuid().ToString();

        return new LocationSearchResult
        {
            Provider = "locationiq",
            Provider_Place_Id = placeId,
            Name = name,
            Country = i.Address?.Country,
            Country_Code = i.Address?.CountryCode,
            Lat = lat,
            Lng = lon,
            Formatted = i.DisplayName ?? name
        };
    }
}