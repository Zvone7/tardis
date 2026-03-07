using Db.Repositories;
using Domain.DbModels;
using Domain.Dtos;

namespace Application.Services;

public class ApartmentService
{
    private readonly ApartmentRepository _apartmentRepository;

    public ApartmentService(ApartmentRepository apartmentRepository)
    {
        _apartmentRepository = apartmentRepository;
    }

    public async Task<List<ApartmentDto>> GetByRankingCaseIdAsync(Guid rankingCaseId, CancellationToken ct)
    {
        var apartments = await _apartmentRepository.GetByRankingCaseIdAsync(rankingCaseId, ct);
        var dtos = new List<ApartmentDto>();
        foreach (var a in apartments)
        {
            var values = await _apartmentRepository.GetValuesAsync(a.Id, ct);
            dtos.Add(MapToDto(a, values));
        }
        return dtos;
    }

    public async Task<ApartmentDto?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var a = await _apartmentRepository.GetByIdAsync(id, ct);
        if (a == null) return null;
        var values = await _apartmentRepository.GetValuesAsync(a.Id, ct);
        return MapToDto(a, values);
    }

    public async Task<ApartmentDto> CreateAsync(ApartmentDto dto, CancellationToken ct)
    {
        var dbm = MapToDbm(dto);
        var created = await _apartmentRepository.CreateAsync(dbm, ct);
        return MapToDto(created, new List<ApartmentCriterionValueDbm>());
    }

    public async Task<ApartmentDto> UpdateAsync(ApartmentDto dto, CancellationToken ct)
    {
        var dbm = MapToDbm(dto);
        dbm.Id = dto.Id;
        var updated = await _apartmentRepository.UpdateAsync(dbm, ct);
        var values = await _apartmentRepository.GetValuesAsync(updated.Id, ct);
        return MapToDto(updated, values);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        await _apartmentRepository.DeleteAsync(id, ct);
    }

    public async Task UpsertValueAsync(ApartmentCriterionValueDto valueDto, CancellationToken ct)
    {
        var dbm = new ApartmentCriterionValueDbm
        {
            ApartmentId = valueDto.ApartmentId,
            CriterionId = valueDto.CriterionId,
            NumberValue = valueDto.NumberValue,
            BoolValue = valueDto.BoolValue,
            EnumOptionId = valueDto.EnumOptionId,
            TextValue = valueDto.TextValue
        };
        await _apartmentRepository.UpsertValueAsync(dbm, ct);
    }

    public async Task DeleteValueAsync(Guid apartmentId, Guid criterionId, CancellationToken ct)
    {
        await _apartmentRepository.DeleteValueAsync(apartmentId, criterionId, ct);
    }

    private static ApartmentDto MapToDto(ApartmentDbm dbm, List<ApartmentCriterionValueDbm> values) => new()
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

    private static ApartmentDbm MapToDbm(ApartmentDto dto) => new()
    {
        RankingCaseId = dto.RankingCaseId,
        Name = dto.Name,
        SillyName = dto.SillyName,
        Link = dto.Link,
        Comment = dto.Comment,
        HiddenFromRanking = dto.HiddenFromRanking,
        Status = dto.Status
    };
}
