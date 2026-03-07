namespace Domain.Dtos;

public class SegmentDto
{
    public int Id { get; set; }
    public int TripId { get; set; }
    public DateTime StartDateTimeUtc { get; set; }
    public int StartDateTimeUtcOffset { get; set; }
    public DateTime EndDateTimeUtc { get; set; }
    public int EndDateTimeUtcOffset { get; set; }
    public string Name { get; set; }
    public decimal Cost { get; set; }
    public int CurrencyId { get; set; } = 1;
    public int SegmentTypeId { get; set; }
    public string Comment { get; set; }
    public int? StartLocationId { get; set; }
    public int? EndLocationId { get; set; }
    public LocationDto? StartLocation { get; set; }
    public LocationDto? EndLocation { get; set; }
    public bool IsUiVisible { get; set; }
}
