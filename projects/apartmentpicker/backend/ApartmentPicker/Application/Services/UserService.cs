using Db.Repositories;
using Domain.Constants;
using Domain.DbModels;
using Domain.Dtos;

namespace Application.Services;

public class UserService
{
    private readonly UserRepository _userRepository;

    public UserService(UserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task<UserDto> CreateUserAsync(string email, string? name, CancellationToken cancellationToken)
    {
        var created = await _userRepository.CreateAsync(new AppUserDbm
        {
            name = name ?? string.Empty,
            email = email,
            role = UserRoles.user.ToString(),
            created_at_utc = DateTime.UtcNow
        }, cancellationToken);

        return MapToDto(created);
    }

    public async Task<UserDto?> GetAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetAsync(userId, cancellationToken);
        return user == null ? null : MapToDto(user);
    }

    public async Task<UserDto?> GetAsync(string email, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetAsync(email, cancellationToken);
        return user == null ? null : MapToDto(user);
    }

    public async Task<List<UserDto>> GetUnapprovedUsersAsync(CancellationToken cancellationToken)
    {
        var users = await _userRepository.GetUnapprovedUsersAsync(cancellationToken);
        return users.Select(MapToDto).ToList();
    }

    public async Task<bool> SetApprovedAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetAsync(userId, cancellationToken);
        if (user != null)
        {
            await _userRepository.SetApprovedAsync(userId, cancellationToken);
            return true;
        }
        return false;
    }

    private static UserDto MapToDto(AppUserDbm user) => new()
    {
        Id = user.Id,
        Name = user.name,
        Email = user.email,
        Role = user.role,
        CreatedAt = user.created_at_utc,
        ApprovedAt = user.approved_at_utc,
        IsApproved = user.is_approved
    };
}
