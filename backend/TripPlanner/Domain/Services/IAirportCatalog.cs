using Domain.Models;

namespace Domain.Services;

public interface IAirportCatalog
{
    IReadOnlyList<AirportLookupResult> Search(string query, int limit = 20);
    AirportLookupResult? GetByCode(string code);
    string? GetCityCode(string cityName, string? countryCode = null);
}
