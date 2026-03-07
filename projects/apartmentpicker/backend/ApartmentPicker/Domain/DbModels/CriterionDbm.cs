namespace Domain.DbModels;

public class CriterionDbm
{
    public Guid Id { get; set; }
    public Guid RankingCaseId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IncludeInRanking { get; set; }
    public string DataType { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public int Weight { get; set; }
    public string MissingValueHandling { get; set; } = "Ignore";
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
