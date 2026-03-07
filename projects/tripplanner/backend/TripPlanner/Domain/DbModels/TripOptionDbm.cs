namespace Domain.DbModels;

public class TripOptionDbm
{
    public int id { get; set; }
    public int trip_id { get; set; }
    public string name { get; set; }
    public DateTime? start_datetime_utc { get; set; }
    public DateTime? end_datetime_utc { get; set; }
    public decimal total_cost { get; set; }
    public bool is_ui_visible { get; set; }
}