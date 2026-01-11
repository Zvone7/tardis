using Db.Repositories;
using Domain.Constants;
using Domain.Dtos;

namespace Application.Services;

public class UserService
{
    private readonly UserRepository _userRepository_;
    private readonly UserPreferenceRepository _userPreferenceRepository;

    public UserService(
        UserRepository userRepository,
        UserPreferenceRepository userPreferenceRepository)
    {
        _userRepository_ = userRepository;
        _userPreferenceRepository = userPreferenceRepository;
    }

    public async Task<UserDto> CreateUserAsync(string email, string name, CancellationToken cancellationToken)
    {
        var created = await _userRepository_.CreateAsync(new AppUser
        {
            name = name,
            email = email,
            role = UserRoles.user.ToString(),
            created_at_utc = DateTime.UtcNow
        }, cancellationToken);

        var userPreference = await _userPreferenceRepository.CreateAsync(new UserPreference
            {
                preferred_utc_offset = 1,
                preferred_currency_id = 1,
                preferred_dark_mode = DarkModePreference.System
            }, created.Id,
            cancellationToken);

        var result = new UserDto
        {
            Id = created.Id,
            Name = created.name,
            Email = created.email,
            Role = created.role,
            UserPreference = new UserPreferenceDto(userPreference)
        };

        return result;
    }

    public async Task<UserDto?> GetAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await _userRepository_.GetAsync(userId, cancellationToken);
        var userPreference = await _userPreferenceRepository.GetAsync(userId, cancellationToken);
        var result = user == null ? null : new UserDto
        {
            Id = user.Id,
            Name = user.name,
            Email = user.email,
            Role = user.role,
            CreatedAt = user.created_at_utc,
            ApprovedAt = user.approved_at_utc,
            IsApproved = user.is_approved,
            UserPreference = userPreference != null ? new UserPreferenceDto(userPreference) : new UserPreferenceDto()
        };
        return result;
    }

    public async Task<UserDto?> GetAsync(string email, CancellationToken cancellationToken)
    {
        var user = await _userRepository_.GetAsync(email, cancellationToken);
        var userPreference = await _userPreferenceRepository.GetAsync(user?.Id ?? 0, cancellationToken);
        var result = user == null ? null : new UserDto
        {
            Id = user.Id,
            Name = user.name,
            Email = user.email,
            Role = user.role,
            CreatedAt = user.created_at_utc,
            ApprovedAt = user.approved_at_utc,
            IsApproved = user.is_approved,
            UserPreference = userPreference != null ? new UserPreferenceDto(userPreference) : new UserPreferenceDto()
        };
        return result;
    }

    public async Task<List<UserDto>> GetUnapprovedUsersAsync(CancellationToken cancellationToken)
    {
        var users = await _userRepository_.GetUnapprovedUsersAsync(cancellationToken);
        var result = users.Select(user => new UserDto
        {
            Id = user.Id,
            Name = user.name,
            Email = user.email,
            Role = user.role,
            CreatedAt = user.created_at_utc,
            ApprovedAt = user.approved_at_utc,
            IsApproved = user.is_approved,
        }).ToList();
        return result;
    }

    public async Task<bool> SetApprovedAsync(int userId, CancellationToken cancellationToken)
    {
        var userToApprove = await GetAsync(userId, cancellationToken);
        if (userToApprove != null)
        {
            await _userRepository_.SetApprovedAsync(userId, cancellationToken);
            return true;
        }
        return false;
    }

    // update user preference
    public async Task<UserDto?> UpdateUserPreferenceAsync(int userId, UserPreferenceDto userPreferenceDto, CancellationToken cancellationToken)
    {
        UserDto? user = null;
        var userPreference = await _userPreferenceRepository.GetAsync(userId, cancellationToken);
        if (userPreference == null)
        {
            // create new user preference
            userPreference = new UserPreference
            {
                app_user_id = userId,
                preferred_utc_offset = userPreferenceDto.PreferredUtcOffset,
                preferred_currency_id = userPreferenceDto.PreferredCurrencyId == 0 ? 1 : userPreferenceDto.PreferredCurrencyId,
                preferred_dark_mode = NormalizeDarkMode(userPreferenceDto.PreferredDarkMode)
            };
            userPreference = await _userPreferenceRepository.CreateAsync(userPreference, userId, cancellationToken);
            user = await GetAsync(userId, cancellationToken);
            if (user != null)
            {
                user.UserPreference = new UserPreferenceDto(userPreference);
            }
        }
        else
        {
            userPreference.preferred_utc_offset = userPreferenceDto.PreferredUtcOffset;
            userPreference.preferred_currency_id = userPreferenceDto.PreferredCurrencyId == 0 ? 1 : userPreferenceDto.PreferredCurrencyId;
            userPreference.preferred_dark_mode = NormalizeDarkMode(userPreferenceDto.PreferredDarkMode);
            var updatedPreference = await _userPreferenceRepository.UpdateAsync(userPreference, userId, cancellationToken);

            user = await GetAsync(userId, cancellationToken);
            if (user != null)
            {
                user.UserPreference = new UserPreferenceDto(updatedPreference);
            }
        }

        return user;
    }

    public async Task<UserDto?> UpdateDarkModePreferenceAsync(int userId, string preferredDarkMode, CancellationToken cancellationToken)
    {
        UserDto? user = null;
        var userPreference = await _userPreferenceRepository.GetAsync(userId, cancellationToken);
        var normalized = NormalizeDarkMode(preferredDarkMode);

        if (userPreference == null)
        {
            userPreference = new UserPreference
            {
                app_user_id = userId,
                preferred_utc_offset = 0,
                preferred_currency_id = 1,
                preferred_dark_mode = normalized
            };
            userPreference = await _userPreferenceRepository.CreateAsync(userPreference, userId, cancellationToken);
        }
        else
        {
            userPreference.preferred_dark_mode = normalized;
            userPreference = await _userPreferenceRepository.UpdateAsync(userPreference, userId, cancellationToken);
        }

        user = await GetAsync(userId, cancellationToken);
        if (user != null)
        {
            user.UserPreference = new UserPreferenceDto(userPreference);
        }

        return user;
    }

    private static string NormalizeDarkMode(string? preference) => DarkModePreference.Normalize(preference);
}
