namespace Domain.DbModels;

public class LocationDbm
{
    public int id { get; set; }
    public string provider { get; set; } = "";
    public string provider_place_id { get; set; } = "";
    public string name { get; set; } = "";
    public string? country { get; set; }
    public string? country_code { get; set; }
    public double lat { get; set; }
    public double lng { get; set; }
    public string formatted { get; set; } = "";
}