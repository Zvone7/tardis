using Db.Repositories;
using Domain.DbModels;
using Domain.Dtos;

namespace Application.Services;

public class CriterionService
{
    private readonly CriterionRepository _criterionRepository;

    public CriterionService(CriterionRepository criterionRepository)
    {
        _criterionRepository = criterionRepository;
    }

    public async Task<List<CriterionDto>> GetByRankingCaseIdAsync(Guid rankingCaseId, CancellationToken ct)
    {
        var criteria = await _criterionRepository.GetByRankingCaseIdAsync(rankingCaseId, ct);
        var dtos = new List<CriterionDto>();
        foreach (var c in criteria)
        {
            dtos.Add(await BuildCriterionDtoAsync(c, ct));
        }
        return dtos;
    }

    public async Task<CriterionDto?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var c = await _criterionRepository.GetByIdAsync(id, ct);
        if (c == null) return null;
        return await BuildCriterionDtoAsync(c, ct);
    }

    public async Task<CriterionDto> CreateAsync(CriterionDto dto, CancellationToken ct)
    {
        var dbm = MapToDbm(dto);
        var created = await _criterionRepository.CreateAsync(dbm, ct);
        await SaveScoringRulesAsync(created.Id, dto, ct);
        return (await BuildCriterionDtoAsync(created, ct));
    }

    public async Task<CriterionDto> UpdateAsync(CriterionDto dto, CancellationToken ct)
    {
        var dbm = MapToDbm(dto);
        dbm.Id = dto.Id;
        var updated = await _criterionRepository.UpdateAsync(dbm, ct);
        await SaveScoringRulesAsync(updated.Id, dto, ct);
        return (await BuildCriterionDtoAsync(updated, ct));
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        await _criterionRepository.DeleteAsync(id, ct);
    }

    private async Task SaveScoringRulesAsync(Guid criterionId, CriterionDto dto, CancellationToken ct)
    {
        if (dto.DataType == Domain.Constants.DataType.Number && dto.NumericIntervals != null)
        {
            var intervals = dto.NumericIntervals.Select(i => new CriterionNumericIntervalDbm
            {
                IntervalStart = i.IntervalStart,
                IntervalEnd = i.IntervalEnd,
                Score = i.Score,
                SortOrder = i.SortOrder
            }).ToList();
            await _criterionRepository.ReplaceNumericIntervalsAsync(criterionId, intervals, ct);
        }
        else if (dto.DataType == Domain.Constants.DataType.Boolean && dto.BooleanRule != null)
        {
            var rule = new CriterionBooleanRuleDbm
            {
                ScoreWhenTrue = dto.BooleanRule.ScoreWhenTrue,
                ScoreWhenFalse = dto.BooleanRule.ScoreWhenFalse
            };
            await _criterionRepository.UpsertBooleanRuleAsync(criterionId, rule, ct);
        }
        else if (dto.DataType == Domain.Constants.DataType.Enum && dto.EnumOptions != null)
        {
            var options = dto.EnumOptions.Select(o => new CriterionEnumOptionDbm
            {
                Value = o.Value,
                Score = o.Score,
                SortOrder = o.SortOrder
            }).ToList();
            await _criterionRepository.ReplaceEnumOptionsAsync(criterionId, options, ct);
        }
    }

    private async Task<CriterionDto> BuildCriterionDtoAsync(CriterionDbm dbm, CancellationToken ct)
    {
        var dto = new CriterionDto
        {
            Id = dbm.Id,
            RankingCaseId = dbm.RankingCaseId,
            Name = dbm.Name,
            Description = dbm.Description,
            IncludeInRanking = dbm.IncludeInRanking,
            DataType = dbm.DataType,
            Unit = dbm.Unit,
            Weight = dbm.Weight,
            MissingValueHandling = dbm.MissingValueHandling,
            SortOrder = dbm.SortOrder
        };

        switch (dbm.DataType)
        {
            case Domain.Constants.DataType.Number:
                var intervals = await _criterionRepository.GetNumericIntervalsAsync(dbm.Id, ct);
                dto.NumericIntervals = intervals.Select(i => new NumericIntervalDto
                {
                    Id = i.Id,
                    IntervalStart = i.IntervalStart,
                    IntervalEnd = i.IntervalEnd,
                    Score = i.Score,
                    SortOrder = i.SortOrder
                }).ToList();
                break;
            case Domain.Constants.DataType.Boolean:
                var rule = await _criterionRepository.GetBooleanRuleAsync(dbm.Id, ct);
                if (rule != null)
                    dto.BooleanRule = new BooleanRuleDto
                    {
                        ScoreWhenTrue = rule.ScoreWhenTrue,
                        ScoreWhenFalse = rule.ScoreWhenFalse
                    };
                break;
            case Domain.Constants.DataType.Enum:
                var options = await _criterionRepository.GetEnumOptionsAsync(dbm.Id, ct);
                dto.EnumOptions = options.Select(o => new EnumOptionDto
                {
                    Id = o.Id,
                    Value = o.Value,
                    Score = o.Score,
                    SortOrder = o.SortOrder
                }).ToList();
                break;
        }

        return dto;
    }

    private static CriterionDbm MapToDbm(CriterionDto dto) => new()
    {
        RankingCaseId = dto.RankingCaseId,
        Name = dto.Name,
        Description = dto.Description,
        IncludeInRanking = dto.IncludeInRanking,
        DataType = dto.DataType,
        Unit = dto.Unit,
        Weight = dto.Weight,
        MissingValueHandling = dto.MissingValueHandling,
        SortOrder = dto.SortOrder
    };
}
