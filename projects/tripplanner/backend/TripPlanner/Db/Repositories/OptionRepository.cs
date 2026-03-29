using System.Data;
using System.Text;
using Dapper;
using Domain.DbModels;
using Domain.Settings;
using Microsoft.Data.SqlClient;

public class OptionRepository
{
    private readonly string _connectionString_;

    public OptionRepository(AppSettings appSettings)
    {
        _connectionString_ = appSettings.DbConnString;
    }

    public async Task<List<TripOptionDbm>> GetOptionsByTripIdAsync(int tripId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<TripOptionDbm>("SELECT * FROM TripOption WHERE trip_id = @trip_id", new { trip_id = tripId })).AsList();
    }

    public async Task<TripOptionDbm?> GetAsync(int optionId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return await db.QuerySingleOrDefaultAsync<TripOptionDbm>("SELECT * FROM TripOption WHERE id = @id", new { id = optionId });
    }

    public async Task CreateAsync(TripOptionDbm option, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = "INSERT INTO TripOption (trip_id, name, start_datetime_utc, end_datetime_utc, total_cost, is_ui_visible) " +
                       "VALUES " +
                       "(@trip_id, @name, @start_datetime_utc, @end_datetime_utc, @total_cost, 1)";
        await db.ExecuteAsync(sqlQuery, option);
    }

    public async Task<int> CreateAndReturnIdAsync(TripOptionDbm option, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = "INSERT INTO TripOption (trip_id, name, start_datetime_utc, end_datetime_utc, total_cost, is_ui_visible) " +
                       "OUTPUT INSERTED.id " +
                       "VALUES " +
                       "(@trip_id, @name, @start_datetime_utc, @end_datetime_utc, @total_cost, 1)";
        return await db.QuerySingleAsync<int>(sqlQuery, option);
    }

    public async Task UpdateLightAsync(TripOptionDbm option, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = "UPDATE TripOption SET " +
                       "name = @name, " +
                       "is_ui_visible=@is_ui_visible " +
                       "WHERE id = @id AND trip_id = @trip_id";
        await db.ExecuteAsync(sqlQuery, option);
    }
    
    public async Task UpdateAsync(TripOptionDbm option, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = "UPDATE TripOption " +
                       "SET name = @name, " +
                       "start_datetime_utc = @start_datetime_utc, " +
                       "end_datetime_utc = @end_datetime_utc, " +
                       "total_cost = @total_cost, " +
                       "is_ui_visible = @is_ui_visible " +
                       "WHERE id = @id AND trip_id = @trip_id";
        await db.ExecuteAsync(sqlQuery, option);
    }

    public async Task DeleteAsync(int optionId, int tripId, CancellationToken cancellationToken)
    {
        // todo - wrap in transaction
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery2 = "DELETE FROM option_to_segment WHERE option_id = @id AND option_id IN (SELECT id FROM TripOption WHERE trip_id = @trip_id)";
        await db.ExecuteAsync(sqlQuery2, new { id = optionId, trip_id = tripId });
        var sqlQuery = "DELETE FROM TripOption WHERE id = @id AND trip_id = @trip_id";
        await db.ExecuteAsync(sqlQuery, new { id = optionId, trip_id = tripId });
    }

    public async Task<List<TripOptionDbm>> GetOptionsBySegmentIdAsync(int segmentId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<TripOptionDbm>("SELECT * from TripOption where id in (" +
                                                   "SELECT option_id FROM option_to_segment WHERE segment_id = @id" +
                                                   ")", new { id = segmentId }))
            .AsList();
    }

    public async Task ConnectOptionWithSegmentsAsync(int optionId, List<int> segmentIds, int tripId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQueryDeleteExisting = "DELETE from option_to_segment where option_id = @option_id";
        await db.ExecuteAsync(sqlQueryDeleteExisting, new { option_id = optionId });

        foreach (var segmentId in segmentIds)
        {
            var sql = "INSERT INTO option_to_segment (option_id, segment_id) " +
                      "SELECT @option_id, @segment_id " +
                      "WHERE EXISTS (SELECT 1 FROM Segment WHERE id = @segment_id AND trip_id = @trip_id) " +
                      "AND EXISTS (SELECT 1 FROM TripOption WHERE id = @option_id AND trip_id = @trip_id)";
            await db.ExecuteAsync(sql, new { option_id = optionId, segment_id = segmentId, trip_id = tripId });
        }
    }
    
    public async Task<List<TripOptionDbm>> GetAllConnectedToSegmentIdAsync(int segmentId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = new StringBuilder();
        sqlQuery.Append("SELECT * FROM TripOption WHERE id IN (");
        sqlQuery.Append("SELECT option_id FROM option_to_segment WHERE segment_id = @segment_id");
        sqlQuery.Append(")");
        return (await db.QueryAsync<TripOptionDbm>(sqlQuery.ToString(), new { segment_id = segmentId })).AsList();
    }

    public async Task AddSegmentToOptionsAsync(int segmentId, List<int> optionIds, int tripId, CancellationToken cancellationToken)
    {
        if (optionIds.Count == 0) return;
        using IDbConnection db = new SqlConnection(_connectionString_);
        foreach (var optionId in optionIds)
        {
            var sql = "IF NOT EXISTS (SELECT 1 FROM option_to_segment WHERE option_id = @option_id AND segment_id = @segment_id) " +
                      "INSERT INTO option_to_segment (option_id, segment_id) " +
                      "SELECT @option_id, @segment_id " +
                      "WHERE EXISTS (SELECT 1 FROM Segment WHERE id = @segment_id AND trip_id = @trip_id) " +
                      "AND EXISTS (SELECT 1 FROM TripOption WHERE id = @option_id AND trip_id = @trip_id)";
            await db.ExecuteAsync(sql, new { option_id = optionId, segment_id = segmentId, trip_id = tripId });
        }
    }

    public async Task RemoveSegmentFromOptionsAsync(int segmentId, List<int> optionIds, int tripId, CancellationToken cancellationToken)
    {
        if (optionIds.Count == 0) return;
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sql = "DELETE ots FROM option_to_segment ots " +
                  "INNER JOIN TripOption o ON o.id = ots.option_id " +
                  "WHERE ots.segment_id = @segment_id AND ots.option_id IN @option_ids AND o.trip_id = @trip_id";
        await db.ExecuteAsync(sql, new { segment_id = segmentId, option_ids = optionIds, trip_id = tripId });
    }

    public async Task BatchDeleteAsync(List<int> optionIds, int tripId, CancellationToken cancellationToken)
    {
        if (optionIds.Count == 0) return;
        using IDbConnection db = new SqlConnection(_connectionString_);
        await db.ExecuteAsync(
            "DELETE FROM option_to_segment WHERE option_id IN @ids AND option_id IN (SELECT id FROM TripOption WHERE trip_id = @trip_id)",
            new { ids = optionIds, trip_id = tripId });
        await db.ExecuteAsync(
            "DELETE FROM TripOption WHERE id IN @ids AND trip_id = @trip_id",
            new { ids = optionIds, trip_id = tripId });
    }

    public async Task BatchSetVisibilityAsync(List<int> optionIds, bool isVisible, int tripId, CancellationToken cancellationToken)
    {
        if (optionIds.Count == 0) return;
        using IDbConnection db = new SqlConnection(_connectionString_);
        await db.ExecuteAsync(
            "UPDATE TripOption SET is_ui_visible = @is_visible WHERE id IN @ids AND trip_id = @trip_id",
            new { ids = optionIds, is_visible = isVisible, trip_id = tripId });
    }
}