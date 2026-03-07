namespace Domain.DbModels;

public class AppUserDbm
{
    public int Id { get; set; }
    public string name { get; set; } = string.Empty;
    public string email { get; set; } = string.Empty;
    public string role { get; set; } = string.Empty;
    public DateTime created_at_utc { get; set; }
    public DateTime? approved_at_utc { get; set; }
    public bool is_approved { get; set; }
}
