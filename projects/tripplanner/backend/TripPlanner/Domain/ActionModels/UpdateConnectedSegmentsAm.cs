namespace Domain.ActionModels;

public class UpdateConnectedSegmentsAm
{
    public int OptionId { get; set; }
    public List<int> SegmentIds { get; set; } = [];
}