using Domain.Dtos;

namespace Domain.ActionModels;

public class BatchUpdateLocationsAm
{
    public List<int> SegmentIds { get; set; } = [];
    public LocationDto? StartLocation { get; set; }
    public LocationDto? EndLocation { get; set; }
}
