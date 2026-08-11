namespace Domain.ActionModels;

public class BatchConnectSegmentAm
{
    public List<int> OptionIds { get; set; } = [];
    public int SegmentId { get; set; }
    public bool Connect { get; set; }
}
