namespace Domain.Models;

public sealed class AmadeusHotelSearchRequest
{
    public string CityName { get; set; } = string.Empty;
    public string? CityCode { get; set; }
    public string? CountryCode { get; set; }
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public int Adults { get; set; } = 1;
}
