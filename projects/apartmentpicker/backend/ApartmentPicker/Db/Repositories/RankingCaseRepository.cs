using System.Data;
using Microsoft.Data.SqlClient;
using Dapper;
using Domain.DbModels;
using Domain.Settings;

namespace Db.Repositories;

public class RankingCaseRepository
{
    private readonly string _connectionString;

    public RankingCaseRepository(AppSettings appSettings)
    {
        _connectionString = appSettings.DbConnString;
    }

    public async Task<List<RankingCaseDbm>> GetAllAsync(CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return (await db.QueryAsync<RankingCaseDbm>(
            "SELECT * FROM RankingCase ORDER BY CreatedAt DESC")).AsList();
    }

    public async Task<RankingCaseDbm?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return await db.QuerySingleOrDefaultAsync<RankingCaseDbm>(
            "SELECT * FROM RankingCase WHERE Id = @Id", new { Id = id });
    }

    public async Task<RankingCaseDbm> CreateAsync(RankingCaseDbm rankingCase, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        var id = Guid.NewGuid();
        await db.ExecuteAsync(
            @"INSERT INTO RankingCase (Id, Name, Description, Currency)
              VALUES (@Id, @Name, @Description, @Currency)",
            new { Id = id, rankingCase.Name, rankingCase.Description, rankingCase.Currency });
        return (await db.QuerySingleAsync<RankingCaseDbm>(
            "SELECT * FROM RankingCase WHERE Id = @Id", new { Id = id }));
    }

    public async Task<RankingCaseDbm> UpdateAsync(RankingCaseDbm rankingCase, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            @"UPDATE RankingCase
              SET Name = @Name, Description = @Description, Currency = @Currency, UpdatedAt = SYSUTCDATETIME()
              WHERE Id = @Id",
            rankingCase);
        return (await db.QuerySingleAsync<RankingCaseDbm>(
            "SELECT * FROM RankingCase WHERE Id = @Id", new { Id = rankingCase.Id }));
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        await db.ExecuteAsync("DELETE FROM RankingCase WHERE Id = @Id", new { Id = id });
    }
}
