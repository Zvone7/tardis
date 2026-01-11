using System.Net;
using Domain.Exceptions;
using Domain.Models;
using Domain.Services;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/geocode")]
public class GeocodingController : ControllerBase
{
    private readonly ILocationIqClient _client;
    private readonly IAirportCatalog _airportCatalog;

    public GeocodingController(ILocationIqClient client, IAirportCatalog airportCatalog)
    {
        _client = client;
        _airportCatalog = airportCatalog;
    }

    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<LocationSearchResult>>> Search(
        [FromQuery] string q,
        [FromQuery] int limit = 8,
        [FromQuery] string? countrycodes = null,
        [FromQuery] string? lang = null,
        CancellationToken ct = default)
    {
        var query = (q ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(query))
            return BadRequest(new { error = "Missing query parameter ?q=" });

        if (limit <= 0 || limit > 50) limit = 8;

        try
        {
            var results = await _client.ForwardGeocodeAsync(
                query, limit, countrycodes, lang, ct);

            var normalized = results.Select(LocationSearchResult.FromLocationIq).ToList();
            return Ok(normalized);
        }
        catch (LocationIqException ex)
        {
            return StatusCode((int)HttpStatusCode.BadGateway, new { error = ex.Message });
        }
    }

    [HttpGet("reverse")]
    public async Task<ActionResult<LocationSearchResult?>> Reverse(
        [FromQuery] double lat,
        [FromQuery] double lon,
        [FromQuery] string? lang = null,
        CancellationToken ct = default)
    {
        try
        {
            var result = await _client.ReverseGeocodeAsync(lat, lon, lang, ct);
            if (result == null) return Ok(null);
            var normalized = LocationSearchResult.FromLocationIq(result);
            return Ok(normalized);
        }
        catch (LocationIqException ex)
        {
            return StatusCode((int)HttpStatusCode.BadGateway, new { error = ex.Message });
        }
    }

    [HttpGet("airport")]
    public ActionResult<LocationSearchResult?> Airport([FromQuery] string code)
    {
        var normalized = (code ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
            return BadRequest(new { error = "Missing query parameter ?code=" });

        var airport = _airportCatalog.GetByCode(normalized);
        if (airport == null) return Ok(null);

        var tzCity = ExtractCityFromTimeZone(airport.TimeZone);
        var city = ResolveAirportCity(airport, tzCity);
        var countryCode = airport.CountryCode;
        var formatted = string.IsNullOrWhiteSpace(countryCode) ? city : $"{city}, {countryCode}";

        var result = new LocationSearchResult
        {
            Provider = "airport-csv",
            Provider_Place_Id = airport.Code,
            Name = city,
            Country = string.Empty,
            Country_Code = countryCode,
            Lat = airport.Latitude,
            Lng = airport.Longitude,
            Formatted = formatted
        };

        return Ok(result);
    }

    private static string ResolveAirportCity(AirportLookupResult airport, string? tzCity)
    {
        var name = airport.Name ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(tzCity) &&
            name.Contains(tzCity, StringComparison.OrdinalIgnoreCase))
        {
            return tzCity;
        }

        return string.IsNullOrWhiteSpace(airport.City) ? airport.Name : airport.City;
    }

    private static string? ExtractCityFromTimeZone(string? timeZone)
    {
        if (string.IsNullOrWhiteSpace(timeZone)) return null;
        var parts = timeZone.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return null;
        var last = parts[^1].Replace('_', ' ').Trim();
        return string.IsNullOrWhiteSpace(last) ? null : last;
    }
}
