using Db.Repositories;
using Domain.DbModels;
using Domain.Dtos;

namespace Application.Services;

public class RankingCaseService
{
    private readonly RankingCaseRepository _rankingCaseRepository;
    private readonly ApartmentRepository _apartmentRepository;

    public RankingCaseService(RankingCaseRepository rankingCaseRepository, ApartmentRepository apartmentRepository)
    {
        _rankingCaseRepository = rankingCaseRepository;
        _apartmentRepository = apartmentRepository;
    }

    public async Task<List<RankingCaseDto>> GetAllAsync(CancellationToken ct)
    {
        var cases = await _rankingCaseRepository.GetAllAsync(ct);
        var dtos = new List<RankingCaseDto>();
        foreach (var c in cases)
        {
            var apartments = await _apartmentRepository.GetByRankingCaseIdAsync(c.Id, ct);
            dtos.Add(MapToDto(c, apartments.Count));
        }
        return dtos;
    }

    public async Task<RankingCaseDto?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var c = await _rankingCaseRepository.GetByIdAsync(id, ct);
        if (c == null) return null;
        var apartments = await _apartmentRepository.GetByRankingCaseIdAsync(c.Id, ct);
        return MapToDto(c, apartments.Count);
    }

    public async Task<RankingCaseDto> CreateAsync(RankingCaseDto dto, CancellationToken ct)
    {
        var dbm = new RankingCaseDbm
        {
            Name = dto.Name,
            Description = dto.Description,
            Currency = dto.Currency
        };
        var created = await _rankingCaseRepository.CreateAsync(dbm, ct);
        return MapToDto(created, 0);
    }

    public async Task<RankingCaseDto> UpdateAsync(RankingCaseDto dto, CancellationToken ct)
    {
        var dbm = new RankingCaseDbm
        {
            Id = dto.Id,
            Name = dto.Name,
            Description = dto.Description,
            Currency = dto.Currency
        };
        var updated = await _rankingCaseRepository.UpdateAsync(dbm, ct);
        var apartments = await _apartmentRepository.GetByRankingCaseIdAsync(updated.Id, ct);
        return MapToDto(updated, apartments.Count);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        await _rankingCaseRepository.DeleteAsync(id, ct);
    }

    private static RankingCaseDto MapToDto(RankingCaseDbm dbm, int apartmentCount) => new()
    {
        Id = dbm.Id,
        Name = dbm.Name,
        Description = dbm.Description,
        Currency = dbm.Currency,
        ApartmentCount = apartmentCount,
        CreatedAt = dbm.CreatedAt,
        UpdatedAt = dbm.UpdatedAt
    };
}
