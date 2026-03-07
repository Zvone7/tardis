using Domain.Dtos;

namespace Domain.Services;

public interface IBookingLinkParser
{
    Task<SegmentSuggestionDto> ParseBookingLinkAsync(string url, CancellationToken cancellationToken);
}
