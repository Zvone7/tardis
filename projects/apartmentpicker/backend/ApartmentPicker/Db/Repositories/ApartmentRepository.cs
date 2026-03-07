using System.Data;
using Microsoft.Data.SqlClient;
using Dapper;
using Domain.DbModels;
using Domain.Settings;

namespace Db.Repositories;

public class ApartmentRepository
{
    private readonly string _connectionString;

    public ApartmentRepository(AppSettings appSettings)
    {
        _connectionString = appSettings.DbConnString;
    }

    public async Task<List<ApartmentDbm>> GetByRankingCaseIdAsync(Guid rankingCaseId, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return (await db.QueryAsync<ApartmentDbm>(
            "SELECT * FROM Apartment WHERE RankingCaseId = @RankingCaseId ORDER BY CreatedAt",
            new { RankingCaseId = rankingCaseId })).AsList();
    }

    public async Task<ApartmentDbm?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return await db.QuerySingleOrDefaultAsync<ApartmentDbm>(
            "SELECT * FROM Apartment WHERE Id = @Id", new { Id = id });
    }

    public async Task<ApartmentDbm> CreateAsync(ApartmentDbm apartment, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        var id = Guid.NewGuid();
        await db.ExecuteAsync(
            @"INSERT INTO Apartment (Id, RankingCaseId, Name, SillyName, Link, Comment, HiddenFromRanking, Status)
              VALUES (@Id, @RankingCaseId, @Name, @SillyName, @Link, @Comment, @HiddenFromRanking, @Status)",
            new
            {
                Id = id,
                apartment.RankingCaseId,
                apartment.Name,
                apartment.SillyName,
                apartment.Link,
                apartment.Comment,
                apartment.HiddenFromRanking,
                apartment.Status
            });
        return (await db.QuerySingleAsync<ApartmentDbm>(
            "SELECT * FROM Apartment WHERE Id = @Id", new { Id = id }));
    }

    public async Task<ApartmentDbm> UpdateAsync(ApartmentDbm apartment, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            @"UPDATE Apartment
              SET Name = @Name, SillyName = @SillyName, Link = @Link, Comment = @Comment,
                  HiddenFromRanking = @HiddenFromRanking, Status = @Status, UpdatedAt = SYSUTCDATETIME()
              WHERE Id = @Id",
            apartment);
        return (await db.QuerySingleAsync<ApartmentDbm>(
            "SELECT * FROM Apartment WHERE Id = @Id", new { Id = apartment.Id }));
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        await db.ExecuteAsync("DELETE FROM Apartment WHERE Id = @Id", new { Id = id });
    }

    // --- Criterion Values ---

    public async Task<List<ApartmentCriterionValueDbm>> GetValuesAsync(Guid apartmentId, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return (await db.QueryAsync<ApartmentCriterionValueDbm>(
            "SELECT * FROM ApartmentCriterionValue WHERE ApartmentId = @ApartmentId",
            new { ApartmentId = apartmentId })).AsList();
    }

    public async Task<List<ApartmentCriterionValueDbm>> GetValuesByRankingCaseIdAsync(Guid rankingCaseId, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return (await db.QueryAsync<ApartmentCriterionValueDbm>(
            @"SELECT acv.* FROM ApartmentCriterionValue acv
              INNER JOIN Apartment a ON a.Id = acv.ApartmentId
              WHERE a.RankingCaseId = @RankingCaseId",
            new { RankingCaseId = rankingCaseId })).AsList();
    }

    public async Task UpsertValueAsync(ApartmentCriterionValueDbm value, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            @"MERGE ApartmentCriterionValue AS target
              USING (SELECT @ApartmentId AS ApartmentId, @CriterionId AS CriterionId) AS source
              ON target.ApartmentId = source.ApartmentId AND target.CriterionId = source.CriterionId
              WHEN MATCHED THEN
                  UPDATE SET NumberValue = @NumberValue, BoolValue = @BoolValue,
                             EnumOptionId = @EnumOptionId, TextValue = @TextValue
              WHEN NOT MATCHED THEN
                  INSERT (Id, ApartmentId, CriterionId, NumberValue, BoolValue, EnumOptionId, TextValue)
                  VALUES (NEWID(), @ApartmentId, @CriterionId, @NumberValue, @BoolValue, @EnumOptionId, @TextValue);",
            value);
    }

    public async Task DeleteValueAsync(Guid apartmentId, Guid criterionId, CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            "DELETE FROM ApartmentCriterionValue WHERE ApartmentId = @ApartmentId AND CriterionId = @CriterionId",
            new { ApartmentId = apartmentId, CriterionId = criterionId });
    }
}
