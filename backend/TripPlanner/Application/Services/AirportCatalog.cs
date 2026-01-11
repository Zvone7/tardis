using System.Text;
using Domain.Models;
using Domain.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;

namespace Application.Services;

public sealed class AirportCatalog : IAirportCatalog
{
    private readonly ILogger<AirportCatalog> _logger;
    private readonly string _csvPath;
    private readonly Lazy<IReadOnlyList<AirportLookupResult>> _airports;

    public AirportCatalog(IHostEnvironment env, ILogger<AirportCatalog> logger)
    {
        _logger = logger;
        _csvPath = Path.Combine(env.ContentRootPath, "Resources", "airports.csv");
        _airports = new Lazy<IReadOnlyList<AirportLookupResult>>(LoadAirports);
    }

    public IReadOnlyList<AirportLookupResult> Search(string query, int limit = 20)
    {
        if (string.IsNullOrWhiteSpace(query)) return Array.Empty<AirportLookupResult>();
        var term = query.Trim();
        if (term.Length < 2) return Array.Empty<AirportLookupResult>();

        var results = _airports.Value
            .Where(a =>
                a.Code.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                a.Name.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                a.City.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                a.CountryCode.Contains(term, StringComparison.OrdinalIgnoreCase))
            .Take(Math.Clamp(limit, 1, 100))
            .ToList();

        return results;
    }

    public AirportLookupResult? GetByCode(string code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        var normalized = code.Trim().ToUpperInvariant();
        return _airports.Value.FirstOrDefault(a => string.Equals(a.Code, normalized, StringComparison.OrdinalIgnoreCase));
    }

    private IReadOnlyList<AirportLookupResult> LoadAirports()
    {
        try
        {
            if (!File.Exists(_csvPath))
            {
                _logger.LogWarning("Airports CSV not found at {Path}", _csvPath);
                return Array.Empty<AirportLookupResult>();
            }

            using var stream = File.OpenRead(_csvPath);
            using var reader = new StreamReader(stream);
            var header = reader.ReadLine();
            if (string.IsNullOrWhiteSpace(header)) return Array.Empty<AirportLookupResult>();

            var columns = ParseCsvLine(header);
            var map = columns
                .Select((name, idx) => new { name = name.Trim(), idx })
                .ToDictionary(x => x.name, x => x.idx, StringComparer.OrdinalIgnoreCase);

            int idxCode = GetIndex(map, "code");
            int idxName = GetIndex(map, "name");
            int idxCity = GetIndex(map, "city");
            int idxCountry = GetIndex(map, "country");
            int idxType = GetIndex(map, "type");
            int idxLat = GetIndex(map, "latitude");
            int idxLon = GetIndex(map, "longitude");
            int idxTimeZone = GetIndex(map, "time_zone");

            var list = new List<AirportLookupResult>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            while (!reader.EndOfStream)
            {
                var line = reader.ReadLine();
                if (string.IsNullOrWhiteSpace(line)) continue;
                var row = ParseCsvLine(line);
                if (row.Length <= Math.Max(idxType, Math.Max(idxCountry, Math.Max(idxCity, Math.Max(idxName, idxCode))))) continue;

                var type = SafeGet(row, idxType);
                if (!string.Equals(type, "AP", StringComparison.OrdinalIgnoreCase)) continue;

                var code = SafeGet(row, idxCode).ToUpperInvariant();
                if (code.Length != 3) continue;
                if (!seen.Add(code)) continue;

                var name = SafeGet(row, idxName);
                var city = SafeGet(row, idxCity);
                var country = SafeGet(row, idxCountry);
                var latRaw = SafeGet(row, idxLat);
                var lonRaw = SafeGet(row, idxLon);
                var timeZone = SafeGet(row, idxTimeZone);
                double.TryParse(latRaw, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var lat);
                double.TryParse(lonRaw, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var lon);

                list.Add(new AirportLookupResult
                {
                    Code = code,
                    Name = string.IsNullOrWhiteSpace(name) ? code : name,
                    City = string.IsNullOrWhiteSpace(city) ? (string.IsNullOrWhiteSpace(name) ? code : name) : city,
                    CountryCode = country,
                    Latitude = lat,
                    Longitude = lon,
                    TimeZone = timeZone
                });
            }

            return list;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load airports CSV");
            return Array.Empty<AirportLookupResult>();
        }
    }

    private static int GetIndex(IReadOnlyDictionary<string, int> map, string key)
    {
        if (!map.TryGetValue(key, out var idx))
            throw new InvalidOperationException($"Missing column '{key}' in airports CSV.");
        return idx;
    }

    private static string SafeGet(string[] row, int idx)
    {
        if (idx < 0 || idx >= row.Length) return string.Empty;
        return row[idx].Trim();
    }

    private static string[] ParseCsvLine(string line)
    {
        var result = new List<string>();
        var sb = new StringBuilder();
        var inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    sb.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(sb.ToString());
                sb.Clear();
            }
            else
            {
                sb.Append(c);
            }
        }

        result.Add(sb.ToString());
        return result.ToArray();
    }
}
