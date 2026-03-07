using System.Data;
using Dapper;
using Domain.DbModels;
using Domain.Settings;
using Microsoft.Data.SqlClient;

namespace Db.Repositories;

public class UserRepository
{
    private readonly string _connectionString;

    public UserRepository(AppSettings appSettings)
    {
        _connectionString = appSettings.DbConnString;
    }

    public async Task<AppUserDbm> CreateAsync(AppUserDbm user, CancellationToken cancellationToken = default)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        var id = await db.QuerySingleAsync<int>(
            "INSERT INTO app_user (name, email, role, created_at_utc) " +
            "VALUES (@name, @email, @role, @created_at_utc); " +
            "SELECT CAST(SCOPE_IDENTITY() AS INT);", user);
        user.Id = id;
        return user;
    }

    public async Task<AppUserDbm?> GetAsync(int id, CancellationToken cancellationToken = default)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return await db.QueryFirstOrDefaultAsync<AppUserDbm>(
            "SELECT * FROM app_user WHERE id = @id", new { id });
    }

    public async Task<AppUserDbm?> GetAsync(string email, CancellationToken cancellationToken = default)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return await db.QueryFirstOrDefaultAsync<AppUserDbm>(
            "SELECT * FROM app_user WHERE email = @email", new { email });
    }

    public async Task<List<AppUserDbm>> GetUnapprovedUsersAsync(CancellationToken cancellationToken = default)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        var res = await db.QueryAsync<AppUserDbm>(
            "SELECT * FROM app_user WHERE is_approved = 0");
        return res.ToList();
    }

    public async Task SetApprovedAsync(int id, CancellationToken cancellationToken = default)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            "UPDATE app_user SET is_approved = 1, approved_at_utc = @approved_at_utc WHERE id = @id",
            new { id, approved_at_utc = DateTime.UtcNow });
    }
}
