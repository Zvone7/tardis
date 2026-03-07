using Application.Services;
using Domain.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Web.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class ApartmentController : ControllerBase
{
    private readonly ApartmentService _apartmentService;

    public ApartmentController(ApartmentService apartmentService)
    {
        _apartmentService = apartmentService;
    }

    [HttpGet]
    [Route(nameof(GetByRankingCaseId))]
    public async Task<ActionResult<List<ApartmentDto>>> GetByRankingCaseId([FromQuery] Guid rankingCaseId, CancellationToken ct)
    {
        return Ok(await _apartmentService.GetByRankingCaseIdAsync(rankingCaseId, ct));
    }

    [HttpGet]
    [Route(nameof(GetById))]
    public async Task<ActionResult<ApartmentDto>> GetById([FromQuery] Guid id, CancellationToken ct)
    {
        var result = await _apartmentService.GetByIdAsync(id, ct);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost]
    [Route(nameof(Create))]
    public async Task<ActionResult<ApartmentDto>> Create(ApartmentDto dto, CancellationToken ct)
    {
        return Ok(await _apartmentService.CreateAsync(dto, ct));
    }

    [HttpPut]
    [Route(nameof(Update))]
    public async Task<ActionResult<ApartmentDto>> Update(ApartmentDto dto, CancellationToken ct)
    {
        return Ok(await _apartmentService.UpdateAsync(dto, ct));
    }

    [HttpDelete]
    [Route(nameof(Delete))]
    public async Task<ActionResult> Delete([FromQuery] Guid id, CancellationToken ct)
    {
        await _apartmentService.DeleteAsync(id, ct);
        return Ok();
    }

    [HttpPut]
    [Route(nameof(UpsertValue))]
    public async Task<ActionResult> UpsertValue(ApartmentCriterionValueDto dto, CancellationToken ct)
    {
        await _apartmentService.UpsertValueAsync(dto, ct);
        return Ok();
    }

    [HttpDelete]
    [Route(nameof(DeleteValue))]
    public async Task<ActionResult> DeleteValue([FromQuery] Guid apartmentId, [FromQuery] Guid criterionId, CancellationToken ct)
    {
        await _apartmentService.DeleteValueAsync(apartmentId, criterionId, ct);
        return Ok();
    }
}
