using System.Text.Json.Serialization;

namespace Domain.Models;

public sealed class AmadeusLocationResponse
{
    [JsonPropertyName("meta")] public AmadeusResponseMeta? Meta { get; set; }
    [JsonPropertyName("data")] public List<AmadeusLocationData> Data { get; set; } = new();
}

public sealed class AmadeusLocationData
{
    [JsonPropertyName("iataCode")] public string? IataCode { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("subType")] public string? SubType { get; set; }
    [JsonPropertyName("geoCode")] public AmadeusGeoCode? GeoCode { get; set; }
    [JsonPropertyName("address")] public AmadeusAddress? Address { get; set; }
}

public sealed class AmadeusGeoCode
{
    [JsonPropertyName("latitude")] public double Latitude { get; set; }
    [JsonPropertyName("longitude")] public double Longitude { get; set; }
}

public sealed class AmadeusAddress
{
    [JsonPropertyName("cityName")] public string? CityName { get; set; }
    [JsonPropertyName("countryName")] public string? CountryName { get; set; }
    [JsonPropertyName("countryCode")] public string? CountryCode { get; set; }
}

public sealed class AmadeusResponseMeta
{
    [JsonPropertyName("count")] public int Count { get; set; }
    [JsonPropertyName("links")] public AmadeusResponseLinks? Links { get; set; }
}

public sealed class AmadeusResponseLinks
{
    [JsonPropertyName("self")] public string? Self { get; set; }
}
