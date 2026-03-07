using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Domain.Dtos;
using Domain.Models;
using Domain.Services;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Primitives;

namespace Application.Services;

public sealed class BookingLinkParser : IBookingLinkParser
{
    private readonly ILocationIqClient _locationIqClient;
    private readonly ILogger<BookingLinkParser> _logger;

    public BookingLinkParser(
        ILocationIqClient locationIqClient,
        ILogger<BookingLinkParser> logger)
    {
        _locationIqClient = locationIqClient;
        _logger = logger;
    }

    public async Task<SegmentSuggestionDto> ParseBookingLinkAsync(string url, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            throw new ArgumentException("Invalid URL provided.");
        }

        var countryName = ExtractCountryNameFromPath(uri);

        var suggestion = new SegmentSuggestionDto
        {
            SourceUrl = url,
            Name = ExtractNameFromPath(uri),
            LocationName = ExtractLocationSlug(uri),
        };

        var query = QueryHelpers.ParseQuery(uri.Query);
        var checkIn = TryGetQueryValue(query, "checkin");
        var checkOut = TryGetQueryValue(query, "checkout");

        suggestion.StartDateLocal = BuildLocalDateString(checkIn, 15, 0);
        suggestion.EndDateLocal = BuildLocalDateString(checkOut, 11, 0);
        suggestion.Cost = TryParsePrice(query, out var currencyCode);
        suggestion.CurrencyCode = currencyCode;
        suggestion.SegmentTypeId = DetermineSegmentTypeId(suggestion.Name);

        await EnrichLocationAsync(suggestion, query, countryName, cancellationToken);
        suggestion.StartLocation ??= suggestion.Location;
        suggestion.StartLocationName ??= suggestion.LocationName;

        return suggestion;
    }

    private async Task EnrichLocationAsync(
        SegmentSuggestionDto suggestion,
        IDictionary<string, StringValues> query,
        string? countryName,
        CancellationToken cancellationToken)
    {
        try
        {
            var searchParts = new List<string>();
            if (!string.IsNullOrWhiteSpace(suggestion.Name))
                searchParts.Add(suggestion.Name!);

            var explicitSearch = TryGetQueryValue(query, "ss");
            if (string.IsNullOrWhiteSpace(explicitSearch))
                explicitSearch = TryGetQueryValue(query, "city");
            if (!string.IsNullOrWhiteSpace(explicitSearch))
                searchParts.Add(explicitSearch!);

            if (!string.IsNullOrWhiteSpace(countryName))
                searchParts.Add(countryName);

            var searchQuery = string.Join(" ", searchParts
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Distinct(StringComparer.OrdinalIgnoreCase));

            if (string.IsNullOrWhiteSpace(searchQuery))
                return;

            var results = await _locationIqClient.ForwardGeocodeAsync(searchQuery, 1, null, null, cancellationToken);
            var best = results.FirstOrDefault();
            if (best == null) return;

            var normalized = LocationSearchResult.FromLocationIq(best);
            suggestion.Location = ToLocationDto(normalized);
            suggestion.StartLocation ??= suggestion.Location;
            suggestion.LocationName ??= normalized.Formatted;
            suggestion.StartLocationName ??= suggestion.LocationName;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to geocode booking location");
        }
    }

    private static string? ExtractNameFromPath(Uri uri)
    {
        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0) return null;

        var slug = segments[^1];
        var htmlIndex = slug.IndexOf(".html", StringComparison.OrdinalIgnoreCase);
        if (htmlIndex >= 0)
        {
            slug = slug[..htmlIndex];
        }

        slug = Regex.Replace(slug, @"\.[a-z]{2}-[a-z]{2}$", "", RegexOptions.IgnoreCase);
        slug = slug.Replace('-', ' ').Trim();
        if (string.IsNullOrWhiteSpace(slug)) return null;
        return CultureInfo.CurrentCulture.TextInfo.ToTitleCase(slug);
    }

    private static string? ExtractLocationSlug(Uri uri)
    {
        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length < 2) return null;
        var candidate = segments[^2];
        candidate = candidate.Replace('-', ' ').Trim();
        if (string.IsNullOrWhiteSpace(candidate)) return null;
        return CultureInfo.CurrentCulture.TextInfo.ToTitleCase(candidate);
    }

    private static string? ExtractCountryNameFromPath(Uri uri)
    {
        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length < 2) return null;
        var candidate = segments.Length >= 2 ? segments[1] : null;
        if (string.IsNullOrWhiteSpace(candidate) || candidate.Length != 2) return null;

        try
        {
            var region = new RegionInfo(candidate.ToUpperInvariant());
            return region.EnglishName;
        }
        catch
        {
            return null;
        }
    }

    private static string? BuildLocalDateString(string? dateValue, int hour, int minute)
    {
        if (string.IsNullOrWhiteSpace(dateValue)) return null;
        if (!DateTime.TryParse(dateValue, out var dateOnly)) return null;
        var local = new DateTime(dateOnly.Year, dateOnly.Month, dateOnly.Day, hour, minute, 0, DateTimeKind.Unspecified);
        return local.ToString("yyyy-MM-ddTHH:mm");
    }

    private static decimal? TryParsePrice(IDictionary<string, StringValues> query, out string? currencyCode)
    {
        currencyCode = TryGetQueryValue(query, "selected_currency")
                       ?? TryGetQueryValue(query, "currency")
                       ?? TryGetQueryValue(query, "src_currency");

        var explicitPrice = TryGetQueryValue(query, "price");
        if (TryParseDecimal(explicitPrice, out var parsedExplicit))
        {
            return parsedExplicit;
        }

        var blockValue = TryGetQueryValue(query, "sr_pri_blocks");
        if (!string.IsNullOrWhiteSpace(blockValue))
        {
            var blocks = blockValue.Split(',', StringSplitOptions.RemoveEmptyEntries);
            foreach (var block in blocks)
            {
                var parts = block.Split('_', StringSplitOptions.RemoveEmptyEntries);
                var candidate = parts.LastOrDefault();
                if (TryParseDecimal(candidate, out var raw))
                {
                    if (raw >= 1000)
                    {
                        raw /= 100m;
                    }
                    return raw;
                }
            }
        }

        return null;
    }

    private static string? TryGetQueryValue(IDictionary<string, StringValues> query, string key)
    {
        return query.TryGetValue(key, out var value) ? value.ToString() : null;
    }

    private static bool TryParseDecimal(string? input, out decimal value)
    {
        return decimal.TryParse(input, NumberStyles.AllowDecimalPoint | NumberStyles.AllowThousands,
            CultureInfo.InvariantCulture, out value);
    }

    private static int DetermineSegmentTypeId(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return 9; // default accommodation other

        var normalized = name.ToLowerInvariant();
        if (normalized.Contains("hostel"))
            return 7; // hostel
        if (normalized.Contains("hotel"))
            return 6; // hotel

        return 9;
    }

    private static LocationDto ToLocationDto(LocationSearchResult normalized)
    {
        return new LocationDto
        {
            Id = 0,
            Provider = normalized.Provider,
            ProviderPlaceId = normalized.Provider_Place_Id,
            Name = normalized.Name,
            Country = normalized.Country ?? string.Empty,
            CountryCode = normalized.Country_Code,
            Latitude = normalized.Lat,
            Longitude = normalized.Lng,
        };
    }
}
