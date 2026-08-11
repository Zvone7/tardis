using Domain.Models;

namespace Domain.Services;
public interface ILocationIqClient
{
    Task<IReadOnlyList<LocationIqItem>> ForwardGeocodeAsync(
        string query,
        int limit,
        string? countrycodes,
        string? lang,
        string? viewbox = null,
        CancellationToken ct = default);

    Task<LocationIqItem?> ReverseGeocodeAsync(
        double latitude,
        double longitude,
        string? lang,
        CancellationToken ct = default);
}
