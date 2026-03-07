namespace Domain.Dtos;

public class RankedApartmentDto
{
    public ApartmentDto Apartment { get; set; } = null!;
    public decimal TotalScore { get; set; }
    public decimal PercentScore { get; set; }
    public List<CriterionScoreDto> CriterionScores { get; set; } = new();
}

public class CriterionScoreDto
{
    public Guid CriterionId { get; set; }
    public string CriterionName { get; set; } = string.Empty;
    public int Weight { get; set; }
    public int? BaseScore { get; set; }
    public decimal? WeightedScore { get; set; }
    public string? RawDisplayValue { get; set; }
}
