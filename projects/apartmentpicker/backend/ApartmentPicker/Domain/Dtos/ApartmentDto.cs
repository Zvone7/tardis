namespace Domain.Dtos;

public class ApartmentDto
{
    public Guid Id { get; set; }
    public Guid RankingCaseId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? SillyName { get; set; }
    public string? Link { get; set; }
    public string? Comment { get; set; }
    public bool HiddenFromRanking { get; set; }
    public string Status { get; set; } = "Considering";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<ApartmentCriterionValueDto> Values { get; set; } = new();
}
