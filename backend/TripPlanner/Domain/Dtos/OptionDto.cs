namespace Domain.Dtos;

public class OptionDto
{
    public int Id { get; set; }
    public int TripId { get; set; }
    public string Name { get; set; }
    public DateTime? StartDateTimeUtc { get; set; }
    public DateTime? EndDateTimeUtc { get; set; }
    public decimal TotalCost { get; set; }
    public decimal CostPerDay { get; set; }
    public int TotalDays { get; set; }
    public bool IsUiVisible { get; set; }
    public Dictionary<CostType, decimal> CostPerType { get; set; } = new();
}

public enum CostType
{
    Accommodation,
    Transport,
    Other
}