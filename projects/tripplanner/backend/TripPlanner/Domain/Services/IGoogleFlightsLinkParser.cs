using Domain.Dtos;

namespace Domain.Services;

public interface IGoogleFlightsLinkParser
{
    Task<SegmentSuggestionDto> ParseFlightsLinkAsync(string url, CancellationToken cancellationToken);
}
