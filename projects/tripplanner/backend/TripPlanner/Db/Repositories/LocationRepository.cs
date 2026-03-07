using System.Data;
using Dapper;
using Domain.DbModels;
using Domain.Settings;
using Microsoft.Data.SqlClient;

public class LocationRepository
{
    private readonly string _connectionString_;

    public LocationRepository(AppSettings appSettings)
    {
        _connectionString_ = appSettings.DbConnString;
    }

    public async Task<LocationDbm?> GetAsync(int locationId, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        return await db.QuerySingleOrDefaultAsync<LocationDbm>("SELECT * FROM Location WHERE id = @id", new { id = locationId });
    }

    public async Task<LocationDbm> CreateAsync(LocationDbm location, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = @"
        INSERT INTO Location (provider, provider_place_id, name, country, country_code, lat, lng)
        OUTPUT INSERTED.id
        VALUES (@provider, @provider_place_id, @name, @country, @country_code, @lat, @lng)";
    
        var id = await db.QuerySingleAsync<int>(sqlQuery, location);
        location.id = id;
        return location;
    }


    public async Task UpdateAsync(LocationDbm location, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString_);
        var sqlQuery = "UPDATE Location SET " +
                       "provider = @provider, " +
                       "provider_place_id = @provider_place_id, " +
                       "name = @name, " +
                       "country = @country, " +
                       "country_code = @country_code, " +
                       "lat = @lat, " +
                       "lng = @lng " +
                       "WHERE id = @id";
        await db.ExecuteAsync(sqlQuery, location);
    }
}