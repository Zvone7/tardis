using System.Data;
using Dapper;
using Domain.DbModels;
using Domain.Settings;
using Microsoft.Data.SqlClient;

namespace Db.Repositories;

public class CurrencyRepository
{
    private readonly string _connectionString;

    public CurrencyRepository(AppSettings appSettings)
    {
        _connectionString = appSettings.DbConnString;
    }

    public async Task<List<CurrencyDbm>> GetAllAsync(CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return (await db.QueryAsync<CurrencyDbm>("SELECT * FROM currency ORDER BY short_name")).AsList();
    }

    public async Task<List<CurrencyConversionDbm>> GetConversionsAsync(CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        return (await db.QueryAsync<CurrencyConversionDbm>("SELECT * FROM currency_conversion")).AsList();
    }

    public async Task UpsertConversionAsync(CurrencyConversionDbm conversion, CancellationToken cancellationToken)
    {
        using IDbConnection db = new SqlConnection(_connectionString);
        var sql = @"IF EXISTS (SELECT 1 FROM currency_conversion WHERE from_currency_id = @from_currency_id AND to_currency_id = @to_currency_id)
                    BEGIN
                        UPDATE currency_conversion SET rate = @rate WHERE from_currency_id = @from_currency_id AND to_currency_id = @to_currency_id
                    END
                    ELSE
                    BEGIN
                        INSERT INTO currency_conversion (from_currency_id, to_currency_id, rate) VALUES (@from_currency_id, @to_currency_id, @rate)
                    END";
        await db.ExecuteAsync(sql, conversion);
    }
}
