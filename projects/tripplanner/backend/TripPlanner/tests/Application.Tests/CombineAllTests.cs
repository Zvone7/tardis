using Application.Services;
using Domain.DbModels;
using FluentAssertions;

namespace Application.Tests;

[TestFixture]
public class CombineAllTests
{
    private static SegmentDbm MakeSegment(int id, string name, int? startLocId, int? endLocId, DateTime startUtc)
    {
        return new SegmentDbm
        {
            id = id,
            name = name,
            start_location_id = startLocId,
            end_location_id = endLocId,
            start_datetime_utc = startUtc,
            end_datetime_utc = startUtc.AddHours(2),
            trip_id = 1,
            segment_type_id = 1,
            cost = 100,
            currency_id = 1,
            is_ui_visible = true
        };
    }

    [Test]
    public void CartesianProduct_2Outbound_2Return_Returns4Combinations()
    {
        var outbound1 = MakeSegment(1, "FlightA", 10, 20, new DateTime(2026, 3, 10, 16, 0, 0));
        var outbound2 = MakeSegment(2, "FlightB", 10, 20, new DateTime(2026, 3, 10, 17, 0, 0));
        var return1 = MakeSegment(3, "FlightC", 20, 10, new DateTime(2026, 3, 11, 1, 0, 0));
        var return2 = MakeSegment(4, "FlightD", 20, 10, new DateTime(2026, 3, 11, 2, 0, 0));

        var legs = new List<List<SegmentDbm>>
        {
            new() { outbound1, outbound2 },
            new() { return1, return2 }
        };

        var result = OptionService.CartesianProduct(legs);

        result.Should().HaveCount(4);
        result.Should().ContainEquivalentOf(new List<SegmentDbm> { outbound1, return1 });
        result.Should().ContainEquivalentOf(new List<SegmentDbm> { outbound1, return2 });
        result.Should().ContainEquivalentOf(new List<SegmentDbm> { outbound2, return1 });
        result.Should().ContainEquivalentOf(new List<SegmentDbm> { outbound2, return2 });
    }

    [Test]
    public void CartesianProduct_3Legs_2Each_Returns8Combinations()
    {
        var seg1 = MakeSegment(1, "A1", 10, 20, new DateTime(2026, 3, 10, 10, 0, 0));
        var seg2 = MakeSegment(2, "A2", 10, 20, new DateTime(2026, 3, 10, 11, 0, 0));
        var seg3 = MakeSegment(3, "B1", 20, 10, new DateTime(2026, 3, 11, 10, 0, 0));
        var seg4 = MakeSegment(4, "B2", 20, 10, new DateTime(2026, 3, 11, 11, 0, 0));
        var seg5 = MakeSegment(5, "C1", 10, 20, new DateTime(2026, 3, 12, 10, 0, 0));
        var seg6 = MakeSegment(6, "C2", 10, 20, new DateTime(2026, 3, 12, 11, 0, 0));

        var legs = new List<List<SegmentDbm>>
        {
            new() { seg1, seg2 },
            new() { seg3, seg4 },
            new() { seg5, seg6 }
        };

        var result = OptionService.CartesianProduct(legs);

        result.Should().HaveCount(8);
        // Each combination should have exactly 3 segments (one per leg)
        result.Should().AllSatisfy(combo => combo.Should().HaveCount(3));
    }

    [Test]
    public void BuildCombinations_2Outbound2Return_Returns4CreateActions()
    {
        var outbound1 = MakeSegment(1, "FlightA", 10, 20, new DateTime(2026, 3, 10, 16, 0, 0));
        var outbound2 = MakeSegment(2, "FlightB", 10, 20, new DateTime(2026, 3, 10, 17, 0, 0));
        var return1 = MakeSegment(3, "FlightC", 20, 10, new DateTime(2026, 3, 11, 1, 0, 0));
        var return2 = MakeSegment(4, "FlightD", 20, 10, new DateTime(2026, 3, 11, 2, 0, 0));

        var segments = new List<SegmentDbm> { outbound1, outbound2, return1, return2 };
        var existingOptions = new List<(int optionId, HashSet<int> segmentIds, bool isVisible)>();

        var actions = OptionService.BuildCombinations(segments, 10, 20, existingOptions);

        actions.Should().HaveCount(4);
        actions.Should().AllSatisfy(a => a.Type.Should().Be(CombineActionType.Create));
    }

    [Test]
    public void BuildCombinations_SkipsVisibleDuplicate()
    {
        var outbound1 = MakeSegment(1, "FlightA", 10, 20, new DateTime(2026, 3, 10, 16, 0, 0));
        var return1 = MakeSegment(2, "FlightC", 20, 10, new DateTime(2026, 3, 11, 1, 0, 0));
        var return2 = MakeSegment(3, "FlightD", 20, 10, new DateTime(2026, 3, 11, 2, 0, 0));

        var segments = new List<SegmentDbm> { outbound1, return1, return2 };
        // Option with segments {1, 2} already exists and is visible
        var existingOptions = new List<(int optionId, HashSet<int> segmentIds, bool isVisible)>
        {
            (100, new HashSet<int> { 1, 2 }, true)
        };

        var actions = OptionService.BuildCombinations(segments, 10, 20, existingOptions);

        // Should only create {1, 3} — the {1, 2} combo is skipped
        actions.Should().HaveCount(1);
        actions[0].Type.Should().Be(CombineActionType.Create);
        actions[0].SegmentIds.Should().BeEquivalentTo(new[] { 1, 3 });
    }

    [Test]
    public void BuildCombinations_UnhidesHiddenDuplicate()
    {
        var outbound1 = MakeSegment(1, "FlightA", 10, 20, new DateTime(2026, 3, 10, 16, 0, 0));
        var return1 = MakeSegment(2, "FlightC", 20, 10, new DateTime(2026, 3, 11, 1, 0, 0));
        var return2 = MakeSegment(3, "FlightD", 20, 10, new DateTime(2026, 3, 11, 2, 0, 0));

        var segments = new List<SegmentDbm> { outbound1, return1, return2 };
        // Option with segments {1, 2} exists but is HIDDEN
        var existingOptions = new List<(int optionId, HashSet<int> segmentIds, bool isVisible)>
        {
            (100, new HashSet<int> { 1, 2 }, false)
        };

        var actions = OptionService.BuildCombinations(segments, 10, 20, existingOptions);

        actions.Should().HaveCount(2);

        var unhideAction = actions.First(a => a.Type == CombineActionType.Unhide);
        unhideAction.ExistingOptionId.Should().Be(100);
        unhideAction.SegmentIds.Should().BeEquivalentTo(new[] { 1, 2 });

        var createAction = actions.First(a => a.Type == CombineActionType.Create);
        createAction.SegmentIds.Should().BeEquivalentTo(new[] { 1, 3 });
    }

    [Test]
    public void BuildCombinations_NoMatchingLegs_ReturnsEmpty()
    {
        // Segments with locations that don't match start=10, end=20
        var seg = MakeSegment(1, "FlightX", 30, 40, new DateTime(2026, 3, 10, 16, 0, 0));
        var segments = new List<SegmentDbm> { seg };
        var existingOptions = new List<(int optionId, HashSet<int> segmentIds, bool isVisible)>();

        var actions = OptionService.BuildCombinations(segments, 10, 20, existingOptions);

        actions.Should().BeEmpty();
    }

    [Test]
    public void BuildCombinations_SingleLeg_EachSegmentBecomesOneOption()
    {
        // Only outbound flights, no returns
        var outbound1 = MakeSegment(1, "FlightA", 10, 20, new DateTime(2026, 3, 10, 16, 0, 0));
        var outbound2 = MakeSegment(2, "FlightB", 10, 20, new DateTime(2026, 3, 10, 17, 0, 0));

        var segments = new List<SegmentDbm> { outbound1, outbound2 };
        var existingOptions = new List<(int optionId, HashSet<int> segmentIds, bool isVisible)>();

        var actions = OptionService.BuildCombinations(segments, 10, 20, existingOptions);

        actions.Should().HaveCount(2);
        actions.Should().AllSatisfy(a => a.Type.Should().Be(CombineActionType.Create));
        actions.Should().AllSatisfy(a => a.SegmentIds.Should().HaveCount(1));
    }
}
