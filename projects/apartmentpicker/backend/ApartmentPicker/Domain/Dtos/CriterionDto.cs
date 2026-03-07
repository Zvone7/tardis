namespace Domain.Dtos;

public class CriterionDto
{
    public Guid Id { get; set; }
    public Guid RankingCaseId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IncludeInRanking { get; set; } = true;
    public string DataType { get; set; } = "Number";
    public string? Unit { get; set; }
    public int Weight { get; set; } = 3;
    public string MissingValueHandling { get; set; } = "Ignore";
    public int SortOrder { get; set; }

    // Scoring rules (populated based on DataType)
    public List<NumericIntervalDto>? NumericIntervals { get; set; }
    public BooleanRuleDto? BooleanRule { get; set; }
    public List<EnumOptionDto>? EnumOptions { get; set; }
}

public class NumericIntervalDto
{
    public Guid Id { get; set; }
    public decimal? IntervalStart { get; set; }
    public decimal? IntervalEnd { get; set; }
    public int Score { get; set; }
    public int SortOrder { get; set; }
}

public class BooleanRuleDto
{
    public int ScoreWhenTrue { get; set; }
    public int ScoreWhenFalse { get; set; }
}

public class EnumOptionDto
{
    public Guid Id { get; set; }
    public string Value { get; set; } = string.Empty;
    public int Score { get; set; }
    public int SortOrder { get; set; }
}
