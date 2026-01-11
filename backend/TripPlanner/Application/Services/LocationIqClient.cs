using System.Text.Json;
using System.Text.Json.Serialization;
using System.Web;
using Domain.Exceptions;
using Domain.Models;
using Domain.Services;
using Domain.Settings;
using Microsoft.Extensions.Logging;
using LocationIqOptions = Domain.Settings.LocationIqOptions;

namespace Application.Services;

public sealed class LocationIqClient : ILocationIqClient
{
    private readonly HttpClient _http;
    private readonly ILogger<LocationIqClient> _logger;
    private readonly LocationIqOptions _opts;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public LocationIqClient(
        HttpClient http,
        AppSettings appSettings,
        ILogger<LocationIqClient> logger)
    {
        _http = http;
        _logger = logger;
        _opts = appSettings.LocationIq;
    }

    public async Task<IReadOnlyList<LocationIqItem>> ForwardGeocodeAsync(
        string query,
        int limit,
        string? countrycodes,
        string? lang,
        CancellationToken ct = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_opts.Token))
                throw new LocationIqException("LOCATIONIQ token is not configured.");

            var url = new UriBuilder(BuildEndpoint("search"));
            var qp = HttpUtility.ParseQueryString(string.Empty);
            qp["key"] = _opts.Token;
            qp["format"] = "json";
            qp["q"] = query; // HttpUtility will handle encoding
            qp["limit"] = limit.ToString();
            qp["addressdetails"] = "1";
            qp["normalizecity"] = "1";
            qp["tag"] = "place:country,place:city,place:town,place:village";
            if (!string.IsNullOrWhiteSpace(countrycodes)) qp["countrycodes"] = countrycodes;
            if (!string.IsNullOrWhiteSpace(lang)) qp["accept-language"] = lang;
            url.Query = qp.ToString();

            using var req = new HttpRequestMessage(HttpMethod.Get, url.Uri);
            using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                throw new LocationIqException(
                    $"LocationIQ upstream {(int)res.StatusCode} {res.ReasonPhrase}: {body}");
            }

            var resp = await res.Content.ReadAsStringAsync(ct);
            var data = JsonSerializer.Deserialize<List<LocationIqItem>>(resp, JsonOpts)
                       ?? new List<LocationIqItem>();
            return NormalizeResults(data);
        }
        catch (Exception e)
        {
            _logger.LogError(e, "LocationIQ ForwardGeocodeAsync failed");
            throw;
        }
    }

    public async Task<LocationIqItem?> ReverseGeocodeAsync(
        double latitude,
        double longitude,
        string? lang,
        CancellationToken ct = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_opts.Token))
                throw new LocationIqException("LOCATIONIQ token is not configured.");

            var url = new UriBuilder(BuildEndpoint("reverse"));
            var qp = HttpUtility.ParseQueryString(string.Empty);
            qp["key"] = _opts.Token;
            qp["format"] = "json";
            qp["lat"] = latitude.ToString(System.Globalization.CultureInfo.InvariantCulture);
            qp["lon"] = longitude.ToString(System.Globalization.CultureInfo.InvariantCulture);
            qp["addressdetails"] = "1";
            if (!string.IsNullOrWhiteSpace(lang)) qp["accept-language"] = lang;
            url.Query = qp.ToString();

            using var req = new HttpRequestMessage(HttpMethod.Get, url.Uri);
            using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                throw new LocationIqException(
                    $"LocationIQ upstream {(int)res.StatusCode} {res.ReasonPhrase}: {body}");
            }

            var resp = await res.Content.ReadAsStringAsync(ct);
            var item = JsonSerializer.Deserialize<LocationIqItem>(resp, JsonOpts);
            if (item == null) return null;

            return NormalizeResults(new[] { item }).FirstOrDefault();
        }
        catch (Exception e)
        {
            _logger.LogError(e, "LocationIQ ReverseGeocodeAsync failed");
            throw;
        }
    }

    private string BuildEndpoint(string endpoint)
    {
        var baseUrl = string.IsNullOrWhiteSpace(_opts.BaseUrl)
            ? "https://us1.locationiq.com/v1"
            : _opts.BaseUrl.TrimEnd('/');

        var lower = baseUrl.ToLowerInvariant();
        if (lower.EndsWith("/search") || lower.EndsWith("/reverse"))
        {
            baseUrl = baseUrl[..baseUrl.LastIndexOf('/')];
        }

        return $"{baseUrl}/{endpoint}";
    }

    private static IReadOnlyList<LocationIqItem> NormalizeResults(IEnumerable<LocationIqItem> results)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var normalized = new List<LocationIqItem>();

        foreach (var item in results)
        {
            var name =
                item.Address?.City
                ?? item.Address?.Town
                ?? item.Address?.Village
                ?? item.Address?.Municipality
                ?? item.Address?.Hamlet
                ?? item.DisplayName
                ?? string.Empty;

            var country = item.Address?.Country ?? string.Empty;
            name = name.Trim();
            country = country.Trim();
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(country)) continue;

            var key = $"{name}|{country}";
            if (!seen.Add(key)) continue;

            normalized.Add(new LocationIqItem
            {
                PlaceId = item.PlaceId,
                Lat = item.Lat,
                Lon = item.Lon,
                DisplayName = $"{name}, {country}",
                Address = new LocationIqAddress
                {
                    City = name,
                    Country = country,
                    CountryCode = item.Address?.CountryCode
                }
            });
        }

        return normalized;
    }
}
