using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Web;
using Domain.Exceptions;
using Domain.Models;
using Domain.Services;
using Domain.Settings;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public sealed class AmadeusScrapingService : IAmadeusScrapingService
{
    private readonly HttpClient _http;
    private readonly ILogger<AmadeusScrapingService> _logger;
    private readonly Amadeus _opts;
    private readonly SemaphoreSlim _tokenLock = new(1, 1);
    private string? _accessToken;
    private DateTimeOffset _accessTokenExpiresAt = DateTimeOffset.MinValue;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public AmadeusScrapingService(
        HttpClient http,
        AppSettings appSettings,
        ILogger<AmadeusScrapingService> logger)
    {
        _http = http;
        _logger = logger;
        _opts = appSettings.ScrapingApi?.Amadeus
            ?? throw new AmadeusException("Amadeus scraping settings are missing.");
    }

    public async Task<AmadeusFlightOfferResponse> GetFlightOffersAsync(
        AmadeusFlightSearchRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null) throw new AmadeusException("Request payload is missing.");
        if (request.StartLocation == null || request.EndLocation == null)
            throw new AmadeusException("StartLocation and EndLocation are required.");
        if (request.StartDateTime == default)
            throw new AmadeusException("StartDateTime is required.");

        var adults = request.Adults <= 0 ? 1 : request.Adults;
        var origin = ResolveIata(request.StartLocation);
        var destination = ResolveIata(request.EndLocation);

        if (string.IsNullOrWhiteSpace(origin) || string.IsNullOrWhiteSpace(destination))
            throw new AmadeusException("StartLocation.IataCode and EndLocation.IataCode are required.");

        var departureDate = request.StartDateTime.ToString("yyyy-MM-dd");
        var returnDate = request.EndDateTime == default
            ? null
            : request.EndDateTime.ToString("yyyy-MM-dd");

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["originLocationCode"] = origin;
        query["destinationLocationCode"] = destination;
        query["departureDate"] = departureDate;
        if (!string.IsNullOrWhiteSpace(returnDate))
            query["returnDate"] = returnDate;
        query["adults"] = adults.ToString();

        var url = new UriBuilder(BuildUri("/v2/shopping/flight-offers")) { Query = query.ToString() };

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, url.Uri);
            await AddAuthHeaderAsync(req, cancellationToken);

            using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            var body = await res.Content.ReadAsStringAsync(cancellationToken);

            if (!res.IsSuccessStatusCode)
                throw new AmadeusException($"Amadeus upstream {(int)res.StatusCode} {res.ReasonPhrase}: {body}");

            return JsonSerializer.Deserialize<AmadeusFlightOfferResponse>(body, JsonOpts)
                   ?? new AmadeusFlightOfferResponse();
        }
        catch (Exception ex) when (ex is not AmadeusException)
        {
            _logger.LogError(ex, "Amadeus GetFlightOffersAsync failed");
            throw;
        }
    }

    public async Task<AmadeusHotelOfferResponse> GetHotelOffersAsync(
        AmadeusHotelSearchRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null) throw new AmadeusException("Request payload is missing.");
        if (string.IsNullOrWhiteSpace(request.CityName))
            throw new AmadeusException("CityName is required.");
        if (request.CheckInDate == default)
            throw new AmadeusException("CheckInDate is required.");
        if (request.CheckOutDate == default)
            throw new AmadeusException("CheckOutDate is required.");

        var adults = request.Adults <= 0 ? 1 : request.Adults;
        var cityCode = !string.IsNullOrWhiteSpace(request.CityCode)
            ? request.CityCode.Trim().ToUpperInvariant()
            : await ResolveCityCodeAsync(request.CityName, request.CountryCode, cancellationToken);
        if (string.IsNullOrWhiteSpace(cityCode))
            throw new AmadeusException("Unable to resolve city code for hotel search.");

        var hotelIds = await GetHotelIdsByCityAsync(cityCode, cancellationToken);
        if (hotelIds.Count == 0)
            throw new AmadeusException("No hotels found for the selected city.");

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["hotelIds"] = string.Join(",", hotelIds.Take(25));
        query["checkInDate"] = request.CheckInDate.ToString("yyyy-MM-dd");
        query["checkOutDate"] = request.CheckOutDate.ToString("yyyy-MM-dd");
        query["adults"] = adults.ToString();

        var url = new UriBuilder(BuildUri("/v3/shopping/hotel-offers")) { Query = query.ToString() };

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, url.Uri);
            await AddAuthHeaderAsync(req, cancellationToken);

            using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            var body = await res.Content.ReadAsStringAsync(cancellationToken);

            if (!res.IsSuccessStatusCode)
                throw new AmadeusException($"Amadeus upstream {(int)res.StatusCode} {res.ReasonPhrase}: {body}");

            return JsonSerializer.Deserialize<AmadeusHotelOfferResponse>(body, JsonOpts)
                   ?? new AmadeusHotelOfferResponse();
        }
        catch (Exception ex) when (ex is not AmadeusException)
        {
            _logger.LogError(ex, "Amadeus GetHotelOffersAsync failed");
            throw;
        }
    }

    private async Task<List<string>> GetHotelIdsByCityAsync(string cityCode, CancellationToken cancellationToken)
    {
        var query = HttpUtility.ParseQueryString(string.Empty);
        query["cityCode"] = cityCode;
        query["radius"] = "20";
        query["radiusUnit"] = "KM";
        query["hotelSource"] = "ALL";

        var url = new UriBuilder(BuildUri("/v1/reference-data/locations/hotels/by-city")) { Query = query.ToString() };

        using var req = new HttpRequestMessage(HttpMethod.Get, url.Uri);
        await AddAuthHeaderAsync(req, cancellationToken);

        using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        var body = await res.Content.ReadAsStringAsync(cancellationToken);

        if (!res.IsSuccessStatusCode)
            throw new AmadeusException($"Amadeus hotel lookup failed {(int)res.StatusCode} {res.ReasonPhrase}: {body}");

        var parsed = JsonSerializer.Deserialize<AmadeusHotelListResponse>(body, JsonOpts)
                     ?? new AmadeusHotelListResponse();
        return parsed.Data
            .Select(h => h.HotelId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string? ResolveIata(FlightLocationInput input)
    {
        if (!string.IsNullOrWhiteSpace(input.IataCode))
            return input.IataCode.Trim().ToUpperInvariant();

        return null;
    }

    private async Task<string?> ResolveCityCodeAsync(
        string cityName,
        string? countryCode,
        CancellationToken cancellationToken)
    {
        var trimmed = cityName.Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return null;

        var city = await FindCityCodeAsync(trimmed, countryCode, cancellationToken);
        if (!string.IsNullOrWhiteSpace(city)) return city;

        if (!string.IsNullOrWhiteSpace(countryCode))
        {
            city = await FindCityCodeAsync(trimmed, null, cancellationToken);
            if (!string.IsNullOrWhiteSpace(city)) return city;
        }

        var firstToken = trimmed.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(firstToken) && !string.Equals(firstToken, trimmed, StringComparison.OrdinalIgnoreCase))
        {
            city = await FindCityCodeAsync(firstToken, countryCode, cancellationToken);
            if (!string.IsNullOrWhiteSpace(city)) return city;
        }

        return null;
    }

    private async Task<string?> FindCityCodeAsync(
        string keyword,
        string? countryCode,
        CancellationToken cancellationToken)
    {
        var query = HttpUtility.ParseQueryString(string.Empty);
        query["subType"] = "CITY";
        query["keyword"] = keyword;
        if (!string.IsNullOrWhiteSpace(countryCode))
            query["countryCode"] = countryCode.Trim().ToUpperInvariant();

        var url = new UriBuilder(BuildUri("/v1/reference-data/locations")) { Query = query.ToString() };

        using var req = new HttpRequestMessage(HttpMethod.Get, url.Uri);
        await AddAuthHeaderAsync(req, cancellationToken);

        using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        var body = await res.Content.ReadAsStringAsync(cancellationToken);

        if (!res.IsSuccessStatusCode)
            throw new AmadeusException($"Amadeus location lookup failed {(int)res.StatusCode} {res.ReasonPhrase}: {body}");

        var parsed = JsonSerializer.Deserialize<AmadeusLocationResponse>(body, JsonOpts)
                     ?? new AmadeusLocationResponse();
        var city = parsed.Data.FirstOrDefault(d => string.Equals(d.SubType, "CITY", StringComparison.OrdinalIgnoreCase));
        return city?.IataCode;
    }

    private async Task AddAuthHeaderAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var token = await GetAccessTokenAsync(cancellationToken);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(_accessToken) &&
            _accessTokenExpiresAt > DateTimeOffset.UtcNow.AddMinutes(1))
            return _accessToken;

        await _tokenLock.WaitAsync(cancellationToken);
        try
        {
            if (!string.IsNullOrWhiteSpace(_accessToken) &&
                _accessTokenExpiresAt > DateTimeOffset.UtcNow.AddMinutes(1))
                return _accessToken;

            var key = string.IsNullOrWhiteSpace(_opts.Key) ? _opts.ApiKey : _opts.Key;
            var secret = string.IsNullOrWhiteSpace(_opts.Secret) ? _opts.ApiSecret : _opts.Secret;

            if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(secret))
                throw new AmadeusException("Amadeus API credentials are not configured.");

            using var req = new HttpRequestMessage(HttpMethod.Post, BuildUri("/v1/security/oauth2/token"));
            req.Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = key,
                ["client_secret"] = secret
            });

            using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            var body = await res.Content.ReadAsStringAsync(cancellationToken);

            if (!res.IsSuccessStatusCode)
                throw new AmadeusException($"Amadeus auth failed {(int)res.StatusCode} {res.ReasonPhrase}: {body}");

            var token = JsonSerializer.Deserialize<AmadeusAccessToken>(body, JsonOpts)
                        ?? throw new AmadeusException("Amadeus token response was empty.");

            if (string.IsNullOrWhiteSpace(token.AccessToken))
                throw new AmadeusException("Amadeus token was missing.");

            _accessToken = token.AccessToken;
            _accessTokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(Math.Max(30, token.ExpiresIn - 30));
            return _accessToken;
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    private Uri BuildUri(string path)
    {
        var baseUrl = string.IsNullOrWhiteSpace(_opts.BaseUrl)
            ? "https://test.api.amadeus.com"
            : _opts.BaseUrl.Trim();

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var baseUri))
            throw new AmadeusException("Invalid Amadeus BaseUrl configuration.");

        var root = baseUri.GetLeftPart(UriPartial.Authority);
        return new Uri(new Uri(root), path.TrimStart('/'));
    }
}
