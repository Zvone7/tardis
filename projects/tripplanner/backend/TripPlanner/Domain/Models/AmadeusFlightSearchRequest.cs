namespace Domain.Models;

public sealed class AmadeusFlightSearchRequest
{
    public FlightLocationInput StartLocation { get; set; } = new();
    public FlightLocationInput EndLocation { get; set; } = new();
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
    public int Adults { get; set; } = 1;
}

public sealed class FlightLocationInput
{
    public string? IataCode { get; set; }
}
