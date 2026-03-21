namespace Domain.ActionModels;

public class CombineAllAm
{
    public int TripId { get; set; }
    public int StartLocationId { get; set; }
    public int EndLocationId { get; set; }
    public List<int> SegmentIds { get; set; } = [];
}
