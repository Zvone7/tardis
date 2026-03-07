using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Domain.Dtos;
using Domain.Models;
using Domain.Services;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public sealed class GoogleFlightsLinkParser : IGoogleFlightsLinkParser
{
    private readonly ILocationIqClient _locationIqClient;
    private readonly ILogger<GoogleFlightsLinkParser> _logger;

    public GoogleFlightsLinkParser(
        ILocationIqClient locationIqClient,
        ILogger<GoogleFlightsLinkParser> logger)
    {
        _locationIqClient = locationIqClient;
        _logger = logger;
    }

    public async Task<SegmentSuggestionDto> ParseFlightsLinkAsync(string url, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            throw new ArgumentException("Invalid URL provided.");
        }

        var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query);
        var printableBlobs = new List<string>();

        var tfsRaw = TryGetQueryValue(query, "tfs");
        var tfuRaw = TryGetQueryValue(query, "tfu");

        var decodedTfs = TryBase64UrlDecode(tfsRaw);
        if (decodedTfs != null)
            printableBlobs.AddRange(ExpandPrintableBlobs(decodedTfs));

        var decodedTfu = TryBase64UrlDecode(tfuRaw);
        if (decodedTfu != null)
            printableBlobs.AddRange(ExpandPrintableBlobs(decodedTfu));

        if (printableBlobs.Count == 0)
        {
            throw new ArgumentException("Unrecognized Google Flights link.");
        }

        var airports = printableBlobs
            .SelectMany(blob => Regex.Matches(blob, @"\b[A-Z]{3}\b").Cast<Match>())
            .Select(m => m.Value)
            .Distinct(StringComparer.Ordinal)
            .Take(2)
            .ToList();

        var dates = printableBlobs
            .SelectMany(blob => Regex.Matches(blob, @"\d{4}-\d{2}-\d{2}").Cast<Match>())
            .Select(m => m.Value)
            .Distinct()
            .ToList();

        var timeTokens = printableBlobs
            .SelectMany(ParseTimesWithOrder)
            .ToList();

        var years = dates.Select(d => d[..4]).ToHashSet(StringComparer.Ordinal);
        var ddmm = dates
            .Select(d => d.Split('-'))
            .Where(parts => parts.Length == 3)
            .Select(parts => parts[2] + parts[1])
            .ToHashSet(StringComparer.Ordinal);
        var mmdd = dates
            .Select(d => d.Split('-'))
            .Where(parts => parts.Length == 3)
            .Select(parts => parts[1] + parts[2])
            .ToHashSet(StringComparer.Ordinal);

        var primaryBlob = printableBlobs.First();
        var flightNumberDigits = ExtractFlightNumberDigits(primaryBlob);

        timeTokens = timeTokens
            .Where(t =>
            {
                var raw = t.Replace(":", "");
                if (years.Contains(raw)) return false;
                if (ddmm.Contains(raw)) return false;
                if (mmdd.Contains(raw)) return false;
                if (!string.IsNullOrWhiteSpace(flightNumberDigits) && raw == flightNumberDigits) return false;
                return true;
            })
            .ToList();

        var flightCode = Regex.Match(primaryBlob, @"\b[A-Z]{2}\d{1,4}\b").Value;
        if (string.IsNullOrWhiteSpace(flightCode))
        {
            var airlineCode = Regex.Match(primaryBlob, @"\b[A-Z]{2}\b").Value;
            var flightNumber = Regex.Match(primaryBlob, @"\b\d{3,4}\b").Value;
            if (!string.IsNullOrWhiteSpace(airlineCode) && !string.IsNullOrWhiteSpace(flightNumber))
            {
                flightCode = $"{airlineCode} {flightNumber}";
            }
        }

        var suggestion = new SegmentSuggestionDto
        {
            SourceUrl = url,
            SegmentTypeId = 1, // transport_plane seeded as id 1
        };

        if (airports.Count >= 2)
        {
            suggestion.LocationName = airports[0];
            suggestion.StartLocationName = airports[0];
            suggestion.EndLocationName = airports[1];
        }
        else if (airports.Count == 1)
        {
            suggestion.LocationName = airports[0];
            suggestion.StartLocationName = airports[0];
        }

        if (dates.Count > 0)
        {
            var defaultStart = (hour: 9, minute: 0);
            var defaultEnd = (hour: 11, minute: 50);

            if (timeTokens.Count == 0)
            {
                timeTokens = new List<string> { $"{defaultStart.hour:D2}{defaultStart.minute:D2}", $"{defaultEnd.hour:D2}{defaultEnd.minute:D2}" };
            }

            var (startHour, startMinute) = TryParseTime(timeTokens.ElementAtOrDefault(0)) ?? defaultStart;
            suggestion.StartDateLocal = BuildLocalDateString(dates[0], startHour, startMinute);

            var (endHour, endMinute) = TryParseTime(timeTokens.ElementAtOrDefault(1) ?? timeTokens.ElementAtOrDefault(0)) ?? (startHour, startMinute);
            suggestion.EndDateLocal = dates.Count > 1
                ? BuildLocalDateString(dates[1], endHour, endMinute)
                : BuildLocalDateString(dates[0], endHour, endMinute);
        }

        var price = ExtractPrice(printableBlobs, dates, flightNumberDigits);
        if (price.HasValue && price.Value > 0)
        {
            suggestion.Cost = price.Value;
        }

        await EnrichAirportsAsync(suggestion, airports, cancellationToken);

        return suggestion;
    }

    private async Task EnrichAirportsAsync(
        SegmentSuggestionDto suggestion,
        IReadOnlyList<string> airports,
        CancellationToken cancellationToken)
    {
        if (airports.Count == 0) return;

        try
        {
            var startQuery = $"{airports[0]} airport";
            var startLocation = await TryGeocodeAsync(startQuery, cancellationToken);
            if (startLocation != null)
            {
                suggestion.StartLocation = startLocation;
                suggestion.Location ??= startLocation;
                suggestion.LocationName ??= suggestion.StartLocationName ?? startLocation.Name;
                suggestion.StartLocationName ??= startLocation.Name;
            }

            if (airports.Count > 1)
            {
                var endQuery = $"{airports[1]} airport";
                var endLocation = await TryGeocodeAsync(endQuery, cancellationToken);
                if (endLocation != null)
                {
                    suggestion.EndLocation = endLocation;
                    suggestion.EndLocationName ??= endLocation.Name;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to geocode Google Flights airports");
        }
    }

    private async Task<LocationDto?> TryGeocodeAsync(string query, CancellationToken cancellationToken)
    {
        var results = await _locationIqClient.ForwardGeocodeAsync(query, 1, null, null, cancellationToken);
        var best = results.FirstOrDefault();
        if (best == null) return null;

        var normalized = LocationSearchResult.FromLocationIq(best);
        return ToLocationDto(normalized);
    }

    private static string? TryGetQueryValue(IDictionary<string, Microsoft.Extensions.Primitives.StringValues> query, string key)
    {
        return query.TryGetValue(key, out var value) ? value.ToString() : null;
    }

    private static string ToPrintable(byte[] bytes)
    {
        return new string(bytes.Select(b => b is >= 32 and <= 126 ? (char)b : ' ').ToArray());
    }

    private static IEnumerable<string> ExpandPrintableBlobs(byte[] firstDecode)
    {
        var primary = ToPrintable(firstDecode);
        yield return primary;

        var compact = primary.Replace("\n", "").Replace("\r", "").Replace(" ", "");
        if (compact.Length % 4 != 0)
        {
            compact = compact.PadRight(compact.Length + (4 - compact.Length % 4) % 4, '=');
        }

        if (Regex.IsMatch(compact, @"^[A-Za-z0-9+/=_-]+$"))
        {
            var nested = TryBase64UrlDecode(compact);
            if (nested != null)
            {
                var secondary = ToPrintable(nested);
                if (!string.IsNullOrWhiteSpace(secondary))
                    yield return secondary;
            }
        }
    }

    private static decimal? ExtractPrice(IEnumerable<string> blobs, List<string> dates, string flightNumberDigits)
    {
        var dateTokens = new HashSet<string>(StringComparer.Ordinal);
        foreach (var d in dates)
        {
            dateTokens.Add(d[..4]); // year
            var parts = d.Split('-');
            if (parts.Length == 3)
            {
                dateTokens.Add(parts[2] + parts[1]); // ddMM
                dateTokens.Add(parts[1] + parts[2]); // MMdd
            }
        }

        var numericCandidates = new List<decimal>();

        foreach (var blob in blobs)
        {
            foreach (Match m in Regex.Matches(blob, @"\b\d{2,6}\b"))
            {
                numericCandidates.Add(decimal.Parse(m.Value));
            }

            foreach (Match embedded in Regex.Matches(blob, @"[A-Za-z0-9+/=_-]{8,}"))
            {
                var decoded = TryBase64UrlDecode(embedded.Value);
                if (decoded == null) continue;

                numericCandidates.AddRange(ParseVarints(decoded));
            }
        }

        var filtered = numericCandidates
            .Where(v => v >= 30 && v <= 20000)
            .Where(v =>
            {
                var token = ((int)Math.Round(v)).ToString();
                if (!string.IsNullOrWhiteSpace(flightNumberDigits) && token == flightNumberDigits) return false;
                if (dateTokens.Contains(token)) return false;
                return true;
            })
            .OrderBy(v => v)
            .ToList();

        if (filtered.Count != 1) return null;

        return Math.Round(filtered.First(), 2);
    }

    private static IEnumerable<decimal> ParseVarints(byte[] data)
    {
        var results = new List<decimal>();
        var i = 0;
        while (i < data.Length)
        {
            var key = data[i];
            var wireType = key & 0x07;
            i++;
            if (wireType == 0)
            {
                int shift = 0;
                int value = 0;
                while (i < data.Length)
                {
                    var b = data[i];
                    i++;
                    value |= (b & 0x7F) << shift;
                    if ((b & 0x80) == 0) break;
                    shift += 7;
                }
                results.Add(value);
            }
            else if (wireType == 2)
            {
                if (i >= data.Length) break;
                var length = data[i];
                i++;
                if (length < 0 || i + length > data.Length) break;
                var slice = new byte[length];
                Array.Copy(data, i, slice, 0, length);
                i += length;
                results.AddRange(ParseVarints(slice));
            }
            else
            {
                break;
            }
        }

        return results;
    }

    private static IEnumerable<string> ParseTimesWithOrder(string blob)
    {
        var colonMatches = Regex.Matches(blob, @"(?<!\d)([01]\d|2[0-3]):([0-5]\d)(?!\d)").Cast<Match>();
        var compactMatches = Regex.Matches(blob, @"(?<![0-9A-Z])([01]\d|2[0-3])([0-5]\d)(?![0-9A-Z])").Cast<Match>();

        foreach (var match in colonMatches.OrderBy(m => m.Index))
            yield return match.Value;
        foreach (var match in compactMatches.OrderBy(m => m.Index))
            yield return match.Value;
    }

    private static string ExtractFlightNumberDigits(string blob)
    {
        var spacedMatch = Regex.Match(blob, @"\b[A-Z]{2}\d?\s*(\d{3,4})\b");
        if (spacedMatch.Success && spacedMatch.Groups.Count > 1)
        {
            return spacedMatch.Groups[1].Value;
        }

        var match = Regex.Match(blob, @"\b[A-Z]{2}(\d{2,4})\b");
        if (match.Success && match.Groups.Count > 1)
        {
            return match.Groups[1].Value;
        }

        var alt = Regex.Match(blob, @"\b(\d{3,4})\b");
        return alt.Success ? alt.Groups[1].Value : string.Empty;
    }

    private static byte[]? TryBase64UrlDecode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        try
        {
            return WebEncoders.Base64UrlDecode(value);
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

    private static (int hour, int minute)? TryParseTime(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        token = token.Replace(":", "");
        if (token.Length != 4) return null;
        if (!int.TryParse(token[..2], out var h)) return null;
        if (!int.TryParse(token[2..], out var m)) return null;
        if (h is < 0 or > 23) return null;
        if (m is < 0 or > 59) return null;
        return (h, m);
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
