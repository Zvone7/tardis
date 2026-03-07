using Application.Services;
using Domain.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Web.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class CriterionController : ControllerBase
{
    private readonly CriterionService _criterionService;

    public CriterionController(CriterionService criterionService)
    {
        _criterionService = criterionService;
    }

    [HttpGet]
    [Route(nameof(GetByRankingCaseId))]
    public async Task<ActionResult<List<CriterionDto>>> GetByRankingCaseId([FromQuery] Guid rankingCaseId, CancellationToken ct)
    {
        return Ok(await _criterionService.GetByRankingCaseIdAsync(rankingCaseId, ct));
    }

    [HttpGet]
    [Route(nameof(GetById))]
    public async Task<ActionResult<CriterionDto>> GetById([FromQuery] Guid id, CancellationToken ct)
    {
        var result = await _criterionService.GetByIdAsync(id, ct);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost]
    [Route(nameof(Create))]
    public async Task<ActionResult<CriterionDto>> Create(CriterionDto dto, CancellationToken ct)
    {
        return Ok(await _criterionService.CreateAsync(dto, ct));
    }

    [HttpPut]
    [Route(nameof(Update))]
    public async Task<ActionResult<CriterionDto>> Update(CriterionDto dto, CancellationToken ct)
    {
        return Ok(await _criterionService.UpdateAsync(dto, ct));
    }

    [HttpDelete]
    [Route(nameof(Delete))]
    public async Task<ActionResult> Delete([FromQuery] Guid id, CancellationToken ct)
    {
        await _criterionService.DeleteAsync(id, ct);
        return Ok();
    }
}
