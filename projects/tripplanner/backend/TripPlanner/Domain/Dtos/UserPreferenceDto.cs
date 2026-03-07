using Db.Repositories;
using Domain.Constants;

namespace Domain.Dtos;

public class UserPreferenceDto
{
    public int PreferredUtcOffset { get; set; }
    public int PreferredCurrencyId { get; set; } = 1;
    public string PreferredDarkMode { get; set; } = DarkModePreference.System;

    public UserPreferenceDto() { }

    public UserPreferenceDto(UserPreference userPreference)
    {
        PreferredUtcOffset = userPreference.preferred_utc_offset;
        PreferredCurrencyId = userPreference.preferred_currency_id;
        PreferredDarkMode = string.IsNullOrWhiteSpace(userPreference.preferred_dark_mode)
            ? DarkModePreference.System
            : userPreference.preferred_dark_mode;
    }
}
