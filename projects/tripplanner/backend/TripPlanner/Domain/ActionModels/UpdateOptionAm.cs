namespace Domain.ActionModels;

public class UpdateOptionAm
{
    public int Id { get; set; }
    public string Name { get; set; }
    public bool IsUiVisible { get; set; }
    public int TripId { get; set; }
}