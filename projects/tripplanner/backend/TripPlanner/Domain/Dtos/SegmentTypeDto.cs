namespace Domain.Dtos;

public class SegmentTypeDto{
    public int Id { get; set; }
    public string ShortName { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string Color { get; set; }
    public string IconSvg { get; set; }
    public int SegmentTypeId { get; set; }
}