namespace Domain.Dtos;

public class LocationDto
{
    public int Id { get; set; }
    public string ProviderPlaceId { get; set; }
    public string Provider { get; set; }
    public string Name { get; set; }
    public string Country { get; set; }
    public string CountryCode { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}