using System.Text.Json.Serialization;

namespace Domain.Models;

public sealed class AmadeusHotelOfferResponse
{
    [JsonPropertyName("data")] public List<AmadeusHotelOffer> Data { get; set; } = new();
}

public sealed class AmadeusHotelListResponse
{
    [JsonPropertyName("data")] public List<AmadeusHotelListItem> Data { get; set; } = new();
}

public sealed class AmadeusHotelListItem
{
    [JsonPropertyName("hotelId")] public string? HotelId { get; set; }
}

public sealed class AmadeusHotelOffer
{
    [JsonPropertyName("hotel")] public AmadeusHotel? Hotel { get; set; }
    [JsonPropertyName("offers")] public List<AmadeusHotelOfferItem> Offers { get; set; } = new();
}

public sealed class AmadeusHotel
{
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("cityCode")] public string? CityCode { get; set; }
    [JsonPropertyName("rating")] public string? Rating { get; set; }
    [JsonPropertyName("address")] public AmadeusHotelAddress? Address { get; set; }
}

public sealed class AmadeusHotelAddress
{
    [JsonPropertyName("cityName")] public string? CityName { get; set; }
    [JsonPropertyName("countryCode")] public string? CountryCode { get; set; }
}

public sealed class AmadeusHotelOfferItem
{
    [JsonPropertyName("checkInDate")] public string? CheckInDate { get; set; }
    [JsonPropertyName("checkOutDate")] public string? CheckOutDate { get; set; }
    [JsonPropertyName("price")] public AmadeusHotelPrice? Price { get; set; }
}

public sealed class AmadeusHotelPrice
{
    [JsonPropertyName("currency")] public string? Currency { get; set; }
    [JsonPropertyName("total")] public string? Total { get; set; }
}
