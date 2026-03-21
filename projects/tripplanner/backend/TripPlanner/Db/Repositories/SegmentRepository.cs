using System.Data;
using System.Text;
using Dapper;
using Domain.DbModels;
using Domain.Settings;
using Microsoft.Data.SqlClient;

public class SegmentRepository
{
    private readonly string _connectionString_;

    public SegmentRepository(AppSettings appSettings)
    {
        _connectionString_ = appSettings.DbConnString;
    }

    public async Task<List<SegmentDbm>> GetAllByTripIdAsync(int tripId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<SegmentDbm>("SELECT * FROM Segment WHERE trip_id = @trip_id", new { trip_id = tripId })).AsList();
    }

    public async Task<SegmentDbm?> GetAsync(int segmentId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return await db.QuerySingleOrDefaultAsync<SegmentDbm>("SELECT * FROM Segment WHERE id = @id", new { id = segmentId });
    }
    
    public async Task<List<SegmentDbm>> GetByIdsAsync(List<int> ids, CancellationToken cancellationToken)
    {
        if (ids.Count == 0) return [];
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<SegmentDbm>("SELECT * FROM Segment WHERE id IN @ids", new { ids })).AsList();
    }

    public async Task<List<SegmentDbm>> GetByIdsAndTripAsync(List<int> ids, int tripId, CancellationToken cancellationToken)
    {
        if (ids.Count == 0) return [];
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<SegmentDbm>("SELECT * FROM Segment WHERE id IN @ids AND trip_id = @trip_id", new { ids, trip_id = tripId })).AsList();
    }

    public async Task<List<SegmentDbm>> GetAllByOptionIdAsync(int optionId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<SegmentDbm>("select * from segment where id in (" +
                                                "SELECT segment_id FROM option_to_segment WHERE option_id = @option_id" +
                                                ")", new { option_id = optionId })).AsList();
    }

    public async Task CreateAsync(SegmentDbm segment, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = "INSERT INTO Segment (" +
                       "trip_id, " +
                       "start_datetime_utc, " +
                       "start_datetime_utc_offset, "+
                       "end_datetime_utc, " +
                       "end_datetime_utc_offset, "+
                       "name, " +
                       "cost, " +
                       "currency_id, " +
                       "segment_type_id, " +
                       "comment, " +
                       "start_location_id, " +
                       "end_location_id, " +
                       "is_ui_visible" +
                       ") VALUES (" +
                       "@trip_id, " +
                       "@start_datetime_utc, " +
                       "@start_datetime_utc_offset, " +
                       "@end_datetime_utc, " +
                       "@end_datetime_utc_offset, " +
                       "@name, " +
                       "@cost, " +
                       "@currency_id, " +
                       "@segment_type_id," +
                       "@comment, " +
                       "@start_location_id, " +
                       "@end_location_id, " +
                       "@is_ui_visible " +
                       ")";
        await db.ExecuteAsync(sqlQuery, segment);
    }

    public async Task UpdateAsync(SegmentDbm segment, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = "UPDATE Segment SET " +
                       "trip_id = @trip_id, " +
                       "start_datetime_utc = @start_datetime_utc, " +
                       "start_datetime_utc_offset = @start_datetime_utc_offset, " +
                       "end_datetime_utc = @end_datetime_utc, " +
                       "end_datetime_utc_offset = @end_datetime_utc_offset, " +
                       "name = @name, " +
                       "cost = @cost, " +
                       "currency_id = @currency_id, " +
                       "segment_type_id = @segment_type_id, " +
                       "comment = @comment, " +
                       "start_location_id = @start_location_id, " +
                       "end_location_id = @end_location_id, " +
                       "is_ui_visible = @is_ui_visible " +
                       "WHERE id = @id";
        await db.ExecuteAsync(sqlQuery, segment);
    }

    public async Task DeleteAsync(int segmentId, CancellationToken cancellationToken)
    {
        // todo - wrap in transaction
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery2 = "DELETE FROM option_to_segment WHERE segment_id = @id";
        await db.ExecuteAsync(sqlQuery2, new { id = segmentId });
        var sqlQuery = "DELETE FROM Segment WHERE id = @id";
        await db.ExecuteAsync(sqlQuery, new { id = segmentId });
    }

    public async Task ConnectSegmentsWithOptionAsync(int segmentId, List<int> optionIds, int tripId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQueryDeleteExisting = "DELETE from option_to_segment where segment_id = @segment_id";
        await db.ExecuteAsync(sqlQueryDeleteExisting, new { segment_id = segmentId });

        foreach (var optionId in optionIds)
        {
            var sql = "INSERT INTO option_to_segment (option_id, segment_id) " +
                      "SELECT @option_id, @segment_id " +
                      "WHERE EXISTS (SELECT 1 FROM Segment WHERE id = @segment_id AND trip_id = @trip_id) " +
                      "AND EXISTS (SELECT 1 FROM TripOption WHERE id = @option_id AND trip_id = @trip_id)";
            await db.ExecuteAsync(sql, new { option_id = optionId, segment_id = segmentId, trip_id = tripId });
        }
    }

    public async Task<List<SegmentDbm>> GetAllConnectedToOptionIdAsync(int optionId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<SegmentDbm>("select * from segment where id in (" +
                                                "SELECT segment_id FROM option_to_segment WHERE option_id = @option_id" +
                                                ")", new { option_id = optionId })).AsList();
    }

    public async Task UpdateLocationsAsync(List<int> segmentIds, int? startLocationId, int? endLocationId, bool updateStart, bool updateEnd, CancellationToken cancellationToken)
    {
        if (segmentIds.Count == 0) return;
        if (!updateStart && !updateEnd) return;

        var setClauses = new List<string>();
        var parameters = new DynamicParameters();
        parameters.Add("ids", segmentIds);

        if (updateStart)
        {
            setClauses.Add("start_location_id = @start_location_id");
            parameters.Add("start_location_id", startLocationId);
        }
        if (updateEnd)
        {
            setClauses.Add("end_location_id = @end_location_id");
            parameters.Add("end_location_id", endLocationId);
        }

        using IDbConnection db = new SqlConnection(_connectionString_);
        var sql = $"UPDATE Segment SET {string.Join(", ", setClauses)} WHERE id IN @ids";
        await db.ExecuteAsync(sql, parameters);
    }

    public async Task BatchDeleteAsync(List<int> segmentIds, int tripId, CancellationToken cancellationToken)
    {
        if (segmentIds.Count == 0) return;
        using IDbConnection db = new SqlConnection(_connectionString_);
        await db.ExecuteAsync(
            "DELETE FROM option_to_segment WHERE segment_id IN @ids AND segment_id IN (SELECT id FROM Segment WHERE trip_id = @trip_id)",
            new { ids = segmentIds, trip_id = tripId });
        await db.ExecuteAsync(
            "DELETE FROM Segment WHERE id IN @ids AND trip_id = @trip_id",
            new { ids = segmentIds, trip_id = tripId });
    }

    public async Task BatchSetVisibilityAsync(List<int> segmentIds, bool isVisible, int tripId, CancellationToken cancellationToken)
    {
        if (segmentIds.Count == 0) return;
        using IDbConnection db = new SqlConnection(_connectionString_);
        await db.ExecuteAsync(
            "UPDATE Segment SET is_ui_visible = @is_visible WHERE id IN @ids AND trip_id = @trip_id",
            new { ids = segmentIds, is_visible = isVisible, trip_id = tripId });
    }

    public async Task<List<SegmentTypeDbm>> GetAllSegmentTypesAsync(CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<SegmentTypeDbm>("SELECT * FROM segment_type")).AsList();
    }
}
