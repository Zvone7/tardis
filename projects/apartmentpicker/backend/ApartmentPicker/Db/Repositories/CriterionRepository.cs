using System.Data;
using Microsoft.Data.SqlClient;
using Dapper;
using Domain.DbModels;
using Domain.Settings;

namespace Db.Repositories;

public class CriterionRepository
{
    private readonly string _connectionString;

    public CriterionRepository(AppSettings appSettings)
    {
        _connectionString = appSettings.DbConnString;
    }

    public async Task<List<CriterionDbm>> GetByRankingCaseIdAsync(Guid rankingCaseId, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return (await db.QueryAsync<CriterionDbm>(
            "SELECT * FROM Criterion WHERE RankingCaseId = @RankingCaseId ORDER BY SortOrder",
            new { RankingCaseId = rankingCaseId })).AsList();
    }

    public async Task<CriterionDbm?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return await db.QuerySingleOrDefaultAsync<CriterionDbm>(
            "SELECT * FROM Criterion WHERE Id = @Id", new { Id = id });
    }

    public async Task<CriterionDbm> CreateAsync(CriterionDbm criterion, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        var id = Guid.NewGuid();
        await db.ExecuteAsync(
            @"INSERT INTO Criterion (Id, RankingCaseId, Name, Description, IncludeInRanking, DataType, Unit, Weight, MissingValueHandling, SortOrder)
              VALUES (@Id, @RankingCaseId, @Name, @Description, @IncludeInRanking, @DataType, @Unit, @Weight, @MissingValueHandling, @SortOrder)",
            new
            {
                Id = id,
                criterion.RankingCaseId,
                criterion.Name,
                criterion.Description,
                criterion.IncludeInRanking,
                criterion.DataType,
                criterion.Unit,
                criterion.Weight,
                criterion.MissingValueHandling,
                criterion.SortOrder
            });
        return (await db.QuerySingleAsync<CriterionDbm>(
            "SELECT * FROM Criterion WHERE Id = @Id", new { Id = id }));
    }

    public async Task<CriterionDbm> UpdateAsync(CriterionDbm criterion, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            @"UPDATE Criterion
              SET Name = @Name, Description = @Description, IncludeInRanking = @IncludeInRanking,
                  DataType = @DataType, Unit = @Unit, Weight = @Weight,
                  MissingValueHandling = @MissingValueHandling, SortOrder = @SortOrder,
                  UpdatedAt = SYSUTCDATETIME()
              WHERE Id = @Id",
            criterion);
        return (await db.QuerySingleAsync<CriterionDbm>(
            "SELECT * FROM Criterion WHERE Id = @Id", new { Id = criterion.Id }));
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        // First delete dependent values (since FK is NO ACTION to avoid multiple cascade paths)
        await db.ExecuteAsync("DELETE FROM ApartmentCriterionValue WHERE CriterionId = @Id", new { Id = id });
        await db.ExecuteAsync("DELETE FROM Criterion WHERE Id = @Id", new { Id = id });
    }

    // --- Numeric Intervals ---

    public async Task<List<CriterionNumericIntervalDbm>> GetNumericIntervalsAsync(Guid criterionId, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return (await db.QueryAsync<CriterionNumericIntervalDbm>(
            "SELECT * FROM CriterionNumericInterval WHERE CriterionId = @CriterionId ORDER BY SortOrder",
            new { CriterionId = criterionId })).AsList();
    }

    public async Task ReplaceNumericIntervalsAsync(Guid criterionId, List<CriterionNumericIntervalDbm> intervals, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        await db.ExecuteAsync("DELETE FROM CriterionNumericInterval WHERE CriterionId = @CriterionId",
            new { CriterionId = criterionId });
        foreach (var interval in intervals)
        {
            await db.ExecuteAsync(
                @"INSERT INTO CriterionNumericInterval (Id, CriterionId, IntervalStart, IntervalEnd, Score, SortOrder)
                  VALUES (@Id, @CriterionId, @IntervalStart, @IntervalEnd, @Score, @SortOrder)",
                new
                {
                    Id = Guid.NewGuid(),
                    CriterionId = criterionId,
                    interval.IntervalStart,
                    interval.IntervalEnd,
                    interval.Score,
                    interval.SortOrder
                });
        }
    }

    // --- Boolean Rule ---

    public async Task<CriterionBooleanRuleDbm?> GetBooleanRuleAsync(Guid criterionId, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return await db.QuerySingleOrDefaultAsync<CriterionBooleanRuleDbm>(
            "SELECT * FROM CriterionBooleanRule WHERE CriterionId = @CriterionId",
            new { CriterionId = criterionId });
    }

    public async Task UpsertBooleanRuleAsync(Guid criterionId, CriterionBooleanRuleDbm rule, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            @"MERGE CriterionBooleanRule AS target
              USING (SELECT @CriterionId AS CriterionId) AS source
              ON target.CriterionId = source.CriterionId
              WHEN MATCHED THEN
                  UPDATE SET ScoreWhenTrue = @ScoreWhenTrue, ScoreWhenFalse = @ScoreWhenFalse
              WHEN NOT MATCHED THEN
                  INSERT (CriterionId, ScoreWhenTrue, ScoreWhenFalse)
                  VALUES (@CriterionId, @ScoreWhenTrue, @ScoreWhenFalse);",
            new { CriterionId = criterionId, rule.ScoreWhenTrue, rule.ScoreWhenFalse });
    }

    // --- Enum Options ---

    public async Task<List<CriterionEnumOptionDbm>> GetEnumOptionsAsync(Guid criterionId, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return (await db.QueryAsync<CriterionEnumOptionDbm>(
            "SELECT * FROM CriterionEnumOption WHERE CriterionId = @CriterionId ORDER BY SortOrder",
            new { CriterionId = criterionId })).AsList();
    }

    public async Task ReplaceEnumOptionsAsync(Guid criterionId, List<CriterionEnumOptionDbm> options, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        // Delete values referencing old enum options first
        await db.ExecuteAsync(
            @"DELETE FROM ApartmentCriterionValue
              WHERE CriterionId = @CriterionId AND EnumOptionId IS NOT NULL",
            new { CriterionId = criterionId });
        await db.ExecuteAsync("DELETE FROM CriterionEnumOption WHERE CriterionId = @CriterionId",
            new { CriterionId = criterionId });
        foreach (var option in options)
        {
            await db.ExecuteAsync(
                @"INSERT INTO CriterionEnumOption (Id, CriterionId, Value, Score, SortOrder)
                  VALUES (@Id, @CriterionId, @Value, @Score, @SortOrder)",
                new
                {
                    Id = Guid.NewGuid(),
                    CriterionId = criterionId,
                    option.Value,
                    option.Score,
                    option.SortOrder
                });
        }
    }
}
