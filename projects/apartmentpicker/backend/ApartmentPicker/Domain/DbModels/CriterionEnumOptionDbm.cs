namespace Domain.DbModels;

public class CriterionEnumOptionDbm
{
    public Guid Id { get; set; }
    public Guid CriterionId { get; set; }
    public string Value { get; set; } = string.Empty;
    public int Score { get; set; }
    public int SortOrder { get; set; }
}
