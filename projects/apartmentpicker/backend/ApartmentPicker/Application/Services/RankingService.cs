using Db.Repositories;
using Domain.DbModels;
using Domain.Dtos;

namespace Application.Services;

public class RankingService
{
    private readonly ApartmentRepository _apartmentRepository;
    private readonly CriterionRepository _criterionRepository;

    public RankingService(ApartmentRepository apartmentRepository, CriterionRepository criterionRepository)
    {
        _apartmentRepository = apartmentRepository;
        _criterionRepository = criterionRepository;
    }

    public async Task<List<RankedApartmentDto>> GetRankingsAsync(Guid rankingCaseId, CancellationToken ct)
    {
        var criteria = await _criterionRepository.GetByRankingCaseIdAsync(rankingCaseId, ct);
        var includedCriteria = criteria.Where(c => c.IncludeInRanking).ToList();
        var apartments = await _apartmentRepository.GetByRankingCaseIdAsync(rankingCaseId, ct);
        var allValues = await _apartmentRepository.GetValuesByRankingCaseIdAsync(rankingCaseId, ct);

        // Pre-load scoring rules for included criteria
        var numericIntervals = new Dictionary<Guid, List<CriterionNumericIntervalDbm>>();
        var booleanRules = new Dictionary<Guid, CriterionBooleanRuleDbm>();
        var enumOptions = new Dictionary<Guid, List<CriterionEnumOptionDbm>>();

        foreach (var c in includedCriteria)
        {
            switch (c.DataType)
            {
                case Domain.Constants.DataType.Number:
                    numericIntervals[c.Id] = await _criterionRepository.GetNumericIntervalsAsync(c.Id, ct);
                    break;
                case Domain.Constants.DataType.Boolean:
                    var rule = await _criterionRepository.GetBooleanRuleAsync(c.Id, ct);
                    if (rule != null) booleanRules[c.Id] = rule;
                    break;
                case Domain.Constants.DataType.Enum:
                    enumOptions[c.Id] = await _criterionRepository.GetEnumOptionsAsync(c.Id, ct);
                    break;
            }
        }

        // Compute max/min possible scores
        decimal maxPossible = 0, minPossible = 0;
        foreach (var c in includedCriteria)
        {
            var (minScore, maxScore) = GetScoreRange(c, numericIntervals, booleanRules, enumOptions);
            maxPossible += maxScore * c.Weight;
            minPossible += minScore * c.Weight;
        }

        var results = new List<RankedApartmentDto>();
        foreach (var apt in apartments.Where(a => !a.HiddenFromRanking))
        {
            var aptValues = allValues.Where(v => v.ApartmentId == apt.Id).ToList();
            var criterionScores = new List<CriterionScoreDto>();
            decimal totalScore = 0;

            foreach (var c in includedCriteria)
            {
                var value = aptValues.FirstOrDefault(v => v.CriterionId == c.Id);
                int? baseScore = ComputeBaseScore(c, value, numericIntervals, booleanRules, enumOptions);
                decimal? weightedScore = baseScore.HasValue ? baseScore.Value * c.Weight : null;

                if (weightedScore.HasValue)
                    totalScore += weightedScore.Value;
                else if (c.MissingValueHandling == Domain.Constants.MissingValueHandling.Penalize)
                {
                    var (minScore, _) = GetScoreRange(c, numericIntervals, booleanRules, enumOptions);
                    totalScore += minScore * c.Weight;
                }

                criterionScores.Add(new CriterionScoreDto
                {
                    CriterionId = c.Id,
                    CriterionName = c.Name,
                    Weight = c.Weight,
                    BaseScore = baseScore,
                    WeightedScore = weightedScore,
                    RawDisplayValue = GetDisplayValue(value, enumOptions)
                });
            }

            var range = maxPossible - minPossible;
            var percentScore = range != 0 ? (totalScore - minPossible) / range * 100 : 0;

            var allAptValues = allValues.Where(v => v.ApartmentId == apt.Id).ToList();
            results.Add(new RankedApartmentDto
            {
                Apartment = MapApartmentToDto(apt, allAptValues),
                TotalScore = totalScore,
                PercentScore = Math.Round(percentScore, 1),
                CriterionScores = criterionScores
            });
        }

        return results.OrderByDescending(r => r.TotalScore).ToList();
    }

    private static int? ComputeBaseScore(
        CriterionDbm criterion,
        ApartmentCriterionValueDbm? value,
        Dictionary<Guid, List<CriterionNumericIntervalDbm>> numericIntervals,
        Dictionary<Guid, CriterionBooleanRuleDbm> booleanRules,
        Dictionary<Guid, List<CriterionEnumOptionDbm>> enumOptions)
    {
        if (value == null) return null;

        switch (criterion.DataType)
        {
            case Domain.Constants.DataType.Number:
                if (!value.NumberValue.HasValue) return null;
                if (!numericIntervals.TryGetValue(criterion.Id, out var intervals)) return null;
                foreach (var interval in intervals.OrderBy(i => i.SortOrder))
                {
                    var aboveStart = !interval.IntervalStart.HasValue || value.NumberValue.Value >= interval.IntervalStart.Value;
                    var belowEnd = !interval.IntervalEnd.HasValue || value.NumberValue.Value <= interval.IntervalEnd.Value;
                    if (aboveStart && belowEnd) return interval.Score;
                }
                return null;

            case Domain.Constants.DataType.Boolean:
                if (!value.BoolValue.HasValue) return null;
                if (!booleanRules.TryGetValue(criterion.Id, out var rule)) return null;
                return value.BoolValue.Value ? rule.ScoreWhenTrue : rule.ScoreWhenFalse;

            case Domain.Constants.DataType.Enum:
                if (!value.EnumOptionId.HasValue) return null;
                if (!enumOptions.TryGetValue(criterion.Id, out var options)) return null;
                var option = options.FirstOrDefault(o => o.Id == value.EnumOptionId.Value);
                return option?.Score;

            default:
                return null;
        }
    }

    private static (decimal min, decimal max) GetScoreRange(
        CriterionDbm criterion,
        Dictionary<Guid, List<CriterionNumericIntervalDbm>> numericIntervals,
        Dictionary<Guid, CriterionBooleanRuleDbm> booleanRules,
        Dictionary<Guid, List<CriterionEnumOptionDbm>> enumOptions)
    {
        switch (criterion.DataType)
        {
            case Domain.Constants.DataType.Number:
                if (numericIntervals.TryGetValue(criterion.Id, out var intervals) && intervals.Any())
                {
                    var scores = intervals.Select(i => (decimal)i.Score);
                    return (scores.Min(), scores.Max());
                }
                return (0, 0);
            case Domain.Constants.DataType.Boolean:
                if (booleanRules.TryGetValue(criterion.Id, out var rule))
                    return (Math.Min(rule.ScoreWhenTrue, rule.ScoreWhenFalse), Math.Max(rule.ScoreWhenTrue, rule.ScoreWhenFalse));
                return (0, 0);
            case Domain.Constants.DataType.Enum:
                if (enumOptions.TryGetValue(criterion.Id, out var options) && options.Any())
                {
                    var scores = options.Select(o => (decimal)o.Score);
                    return (scores.Min(), scores.Max());
                }
                return (0, 0);
            default:
                return (0, 0);
        }
    }

    private static string? GetDisplayValue(
        ApartmentCriterionValueDbm? value,
        Dictionary<Guid, List<CriterionEnumOptionDbm>> enumOptions)
    {
        if (value == null) return null;
        if (value.NumberValue.HasValue) return value.NumberValue.Value.ToString("G");
        if (value.BoolValue.HasValue) return value.BoolValue.Value ? "Yes" : "No";
        if (value.EnumOptionId.HasValue)
        {
            foreach (var options in enumOptions.Values)
            {
                var opt = options.FirstOrDefault(o => o.Id == value.EnumOptionId.Value);
                if (opt != null) return opt.Value;
            }
        }
        if (value.TextValue != null) return value.TextValue;
        return null;
    }

    private static ApartmentDto MapApartmentToDto(ApartmentDbm dbm, List<ApartmentCriterionValueDbm> values) => new()
    {
        Id = dbm.Id,
        RankingCaseId = dbm.RankingCaseId,
        Name = dbm.Name,
        SillyName = dbm.SillyName,
        Link = dbm.Link,
        Comment = dbm.Comment,
        HiddenFromRanking = dbm.HiddenFromRanking,
        Status = dbm.Status,
        CreatedAt = dbm.CreatedAt,
        UpdatedAt = dbm.UpdatedAt,
        Values = values.Select(v => new ApartmentCriterionValueDto
        {
            Id = v.Id,
            ApartmentId = v.ApartmentId,
            CriterionId = v.CriterionId,
            NumberValue = v.NumberValue,
            BoolValue = v.BoolValue,
            EnumOptionId = v.EnumOptionId,
            TextValue = v.TextValue
        }).ToList()
    };
}
