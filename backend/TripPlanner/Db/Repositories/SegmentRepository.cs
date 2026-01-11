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

    public async Task ConnectSegmentsWithOptionAsync(int segmentId, List<int> optionIds, CancellationToken cancellationToken)
    {
        // todo - wrap in transaction
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQueryDeleteExisting = "DELETE from option_to_segment where segment_id = @segment_id";
        await db.ExecuteAsync(sqlQueryDeleteExisting, new { segment_id = segmentId });

        foreach (var optionId in optionIds)
        {
            var sqlQueryInsertNew = "INSERT into option_to_segment (option_id, segment_id) VALUES(@option_id, @segment_id)";
            await db.ExecuteAsync(sqlQueryInsertNew, new { option_id = optionId, segment_id = segmentId });
        }
    }

    public async Task<List<SegmentDbm>> GetAllConnectedToOptionIdAsync(int optionId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<SegmentDbm>("select * from segment where id in (" +
                                                "SELECT segment_id FROM option_to_segment WHERE option_id = @option_id" +
                                                ")", new { option_id = optionId })).AsList();
    }

    public async Task<List<SegmentTypeDbm>> GetAllSegmentTypesAsync(CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<SegmentTypeDbm>("SELECT * FROM segment_type")).AsList();
    }
}
