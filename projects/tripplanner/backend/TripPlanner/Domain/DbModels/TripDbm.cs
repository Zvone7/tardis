namespace Domain.DbModels;

public class TripDbm
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public bool is_active { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; } 
    public int currency_id { get; set; }
}
