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

    private static string? ResolveIata(FlightLocationInput input)
    {
        if (!string.IsNullOrWhiteSpace(input.IataCode))
            return input.IataCode.Trim().ToUpperInvariant();

        return null;
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
