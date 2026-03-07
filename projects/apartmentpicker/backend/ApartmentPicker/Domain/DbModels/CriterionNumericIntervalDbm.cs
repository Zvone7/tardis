namespace Domain.DbModels;

public class CriterionNumericIntervalDbm
{
    public Guid Id { get; set; }
    public Guid CriterionId { get; set; }
    public decimal? IntervalStart { get; set; }
    public decimal? IntervalEnd { get; set; }
    public int Score { get; set; }
    public int SortOrder { get; set; }
}
