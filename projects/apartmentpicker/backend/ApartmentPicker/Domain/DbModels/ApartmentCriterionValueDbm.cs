namespace Domain.DbModels;

public class ApartmentCriterionValueDbm
{
    public Guid Id { get; set; }
    public Guid ApartmentId { get; set; }
    public Guid CriterionId { get; set; }
    public decimal? NumberValue { get; set; }
    public bool? BoolValue { get; set; }
    public Guid? EnumOptionId { get; set; }
    public string? TextValue { get; set; }
}
