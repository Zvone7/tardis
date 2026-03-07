namespace Domain.ActionModels;

public class UpdateConnectedOptionsAm
{
    public int SegmentId { get; set; }
    public List<int> OptionIds { get; set; }
    public int TripId { get; set; }
}