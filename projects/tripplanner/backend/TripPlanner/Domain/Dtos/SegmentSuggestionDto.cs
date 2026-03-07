namespace Domain.Dtos;

public class SegmentSuggestionDto
{
    public string? Name { get; set; }
    public string? StartDateLocal { get; set; }
    public string? EndDateLocal { get; set; }
    public string? LocationName { get; set; }
    public string? StartLocationName { get; set; }
    public string? EndLocationName { get; set; }
    public string? SourceUrl { get; set; }
    public decimal? Cost { get; set; }
    public string? CurrencyCode { get; set; }
    public LocationDto? Location { get; set; }
    public LocationDto? StartLocation { get; set; }
    public LocationDto? EndLocation { get; set; }
    public int? SegmentTypeId { get; set; }
}
