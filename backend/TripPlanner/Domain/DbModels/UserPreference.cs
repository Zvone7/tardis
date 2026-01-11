namespace Db.Repositories;

public class UserPreference
{
    public int id { get; set; }
    public int app_user_id { get; set; }
    public int preferred_utc_offset { get; set; }
    public int preferred_currency_id { get; set; }
    public string preferred_dark_mode { get; set; } = "system";
}
