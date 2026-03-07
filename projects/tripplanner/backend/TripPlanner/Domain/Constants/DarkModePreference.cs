namespace Domain.Constants;

public static class DarkModePreference
{
    public const string System = "system";
    public const string Dark = "dark";
    public const string Light = "light";

    private static readonly HashSet<string> AllowedValues = new(StringComparer.OrdinalIgnoreCase)
    {
        System,
        Dark,
        Light,
    };

    public static string Normalize(string? preference)
    {
        if (preference is null) return System;
        var lower = preference.ToLowerInvariant();
        return AllowedValues.Contains(lower) ? lower : System;
    }
}
