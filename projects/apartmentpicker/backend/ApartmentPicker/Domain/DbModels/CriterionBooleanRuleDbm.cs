namespace Domain.DbModels;

public class CriterionBooleanRuleDbm
{
    public Guid CriterionId { get; set; }
    public int ScoreWhenTrue { get; set; }
    public int ScoreWhenFalse { get; set; }
}
