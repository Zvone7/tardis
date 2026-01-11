using System.Data;
using Microsoft.Data.SqlClient;
using Dapper;
using Domain.DbModels;
using Domain.Settings;

public class TripRepository
{
    private readonly string _connectionString_;

    public TripRepository(AppSettings appSettings)
    {
        _connectionString_ = appSettings.DbConnString;
    }

    public async Task<List<TripDbm>> GetAllActiveAsync(int userId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<TripDbm>(
            "SELECT t.id, t.name, t.description, t.is_active, t.currency_id, " +
            "       MIN(s.start_datetime_utc) AS startTime, " +
            "       MAX(s.end_datetime_utc) AS endTime " +
            "FROM Trip t " +
            "INNER JOIN app_user_to_trip aut ON aut.trip_id = t.id " +
            "LEFT JOIN segment s ON s.trip_id = t.id " +  // Use LEFT JOIN to include trips even if they have no segments
            "WHERE t.is_active = 1 " +
            "AND aut.app_user_id = @userId " +
            "GROUP BY t.id, t.name, t.description, t.is_active, t.currency_id", 
            new { userId = userId })).AsList();

    }

    public async Task<TripDbm?> GetAsync(int tripId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return await db.QuerySingleOrDefaultAsync<TripDbm>("SELECT * FROM Trip WHERE id = @Id ", new { Id = tripId });
    }

    public async Task<TripDbm> CreateAsync(int userId, TripDbm trip, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = "INSERT INTO Trip (Name, Description, is_active, currency_id) VALUES (@Name, @Description, @is_active, @currency_id)";
        await db.ExecuteAsync(sqlQuery, trip);
        var createdTrip = await db.QuerySingleOrDefaultAsync<TripDbm>("SELECT * FROM Trip WHERE Name = @Name AND Description = @Description", trip);
        var sqlQuery2 = "INSERT INTO app_user_to_trip (app_user_id, trip_id) VALUES (@userId, @tripId)";
        await db.ExecuteAsync(sqlQuery2, new { userId = userId, tripId = createdTrip.Id });
        return createdTrip;
    }

    public async Task<TripDbm> UpdateAsync(TripDbm trip, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = "UPDATE Trip SET Name = @Name, Description = @Description, is_active = @is_active, currency_id = @currency_id WHERE Id = @Id";
        await db.ExecuteAsync(sqlQuery, trip);
        var updatedTrip = await db.QuerySingleOrDefaultAsync<TripDbm>("SELECT * FROM Trip WHERE Id = @Id", new { Id = trip.Id });
        return updatedTrip;
    }

    public async Task DeleteAsync(int tripId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        // instead of delete set as inactive
        var sqlQuery = "UPDATE Trip SET is_active = 0 WHERE Id = @Id";
        await db.ExecuteAsync(sqlQuery, new { Id = tripId });
    }

    public async Task<bool> CheckUserHasAccessToTripAsync(int userId, int tripId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var isUserOwnedTrip = await db.QuerySingleOrDefaultAsync<int>("SELECT top 1 * FROM app_user_to_trip WHERE app_user_id = @userId AND trip_id = @tripId", new { userId = userId, tripId = tripId });
        return isUserOwnedTrip != 0;
    }
}
