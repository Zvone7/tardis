using Domain.Constants;
using Domain.Dtos;

namespace Domain.Helpers;

public static class UserHelpers
{
    public static bool IsAdmin(this UserDto user)
    {
        return user.Role.Equals(UserRoles.admin.ToString(), StringComparison.OrdinalIgnoreCase);
    }
}