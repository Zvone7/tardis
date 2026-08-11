namespace Domain.ActionModels;

public class BatchSetVisibilityAm
{
    public List<int> Ids { get; set; } = [];
    public bool IsVisible { get; set; }
}
