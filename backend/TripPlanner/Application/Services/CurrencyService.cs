using Db.Repositories;
using Domain.DbModels;
using Domain.Dtos;

namespace Application.Services;

public class CurrencyService
{
    private readonly CurrencyRepository _currencyRepository;

    public CurrencyService(CurrencyRepository currencyRepository)
    {
        _currencyRepository = currencyRepository;
    }

    public async Task<List<CurrencyDto>> GetCurrenciesAsync(CancellationToken cancellationToken)
    {
        var dbItems = await _currencyRepository.GetAllAsync(cancellationToken);
        return dbItems
            .Select(c => new CurrencyDto
            {
                Id = c.id,
                Symbol = c.symbol,
                ShortName = c.short_name,
                Name = c.name,
            })
            .ToList();
    }

    public async Task<List<CurrencyConversionDto>> GetConversionsAsync(CancellationToken cancellationToken)
    {
        var dbItems = await _currencyRepository.GetConversionsAsync(cancellationToken);
        return dbItems
            .Select(c => new CurrencyConversionDto
            {
                FromCurrencyId = c.from_currency_id,
                ToCurrencyId = c.to_currency_id,
                Rate = c.rate,
            })
            .ToList();
    }

    public Task UpsertConversionAsync(CurrencyConversionDto dto, CancellationToken cancellationToken)
    {
        var dbm = new CurrencyConversionDbm
        {
            from_currency_id = dto.FromCurrencyId,
            to_currency_id = dto.ToCurrencyId,
            rate = dto.Rate,
        };
        return _currencyRepository.UpsertConversionAsync(dbm, cancellationToken);
    }
}
