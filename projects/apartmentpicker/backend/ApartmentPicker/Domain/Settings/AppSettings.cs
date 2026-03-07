namespace Domain.Settings;

public class AppSettings
{
    public string DbConnString { get; set; } = string.Empty;
    public string FrontendRootUrl { get; set; } = string.Empty;
    public string BackendRootUrl { get; set; } = string.Empty;
    public string EnvCode { get; set; } = string.Empty;
    public string BuildNumber { get; set; } = string.Empty;
    public DateTime AppStartedUtc { get; set; }
    public GoogleAuthSettings GoogleAuthSettings { get; set; } = new();
}

public class GoogleAuthSettings
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
}
