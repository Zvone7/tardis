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

    public async Task UpdateLightAsync(TripOptionDbm option, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = "UPDATE TripOption SET " +
                       "name = @name, " +
                       "is_ui_visible=@is_ui_visible " +
                       "WHERE id = @id";
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
                       "WHERE id = @id";
        await db.ExecuteAsync(sqlQuery, option);
    }

    public async Task DeleteAsync(int optionId, CancellationToken cancellationToken)
    {
        // todo - wrap in transaction
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery2 = "DELETE FROM option_to_segment WHERE option_id = @id";
        await db.ExecuteAsync(sqlQuery2, new { id = optionId });
        var sqlQuery = "DELETE FROM TripOption WHERE id = @id";
        await db.ExecuteAsync(sqlQuery, new { id = optionId });
    }

    public async Task<List<TripOptionDbm>> GetOptionsBySegmentIdAsync(int segmentId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return (await db.QueryAsync<TripOptionDbm>("SELECT * from TripOption where id in (" +
                                                   "SELECT option_id FROM option_to_segment WHERE segment_id = @id" +
                                                   ")", new { id = segmentId }))
            .AsList();
    }

    public async Task ConnectOptionWithSegmentsAsync(int optionId, List<int> segmentIds, CancellationToken cancellationToken)
    {
        // todo - wrap in transaction
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQueryDeleteExisting = "DELETE from option_to_segment where option_id = @option_id";
        await db.ExecuteAsync(sqlQueryDeleteExisting, new { option_id = optionId });

        foreach (var segmentId in segmentIds)
        {
            var sqlQueryInsertNew = "INSERT into option_to_segment (option_id, segment_id) VALUES(@option_id, @segment_id)";
            await db.ExecuteAsync(sqlQueryInsertNew, new { option_id = optionId, segment_id = segmentId });
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

}