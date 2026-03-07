using Application.Services;
using Domain.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Web.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class RankingCaseController : ControllerBase
{
    private readonly RankingCaseService _rankingCaseService;

    public RankingCaseController(RankingCaseService rankingCaseService)
    {
        _rankingCaseService = rankingCaseService;
    }

    [HttpGet]
    [Route(nameof(GetAll))]
    public async Task<ActionResult<List<RankingCaseDto>>> GetAll(CancellationToken ct)
    {
        return Ok(await _rankingCaseService.GetAllAsync(ct));
    }

    [HttpGet]
    [Route(nameof(GetById))]
    public async Task<ActionResult<RankingCaseDto>> GetById([FromQuery] Guid id, CancellationToken ct)
    {
        var result = await _rankingCaseService.GetByIdAsync(id, ct);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost]
    [Route(nameof(Create))]
    public async Task<ActionResult<RankingCaseDto>> Create(RankingCaseDto dto, CancellationToken ct)
    {
        return Ok(await _rankingCaseService.CreateAsync(dto, ct));
    }

    [HttpPut]
    [Route(nameof(Update))]
    public async Task<ActionResult<RankingCaseDto>> Update(RankingCaseDto dto, CancellationToken ct)
    {
        return Ok(await _rankingCaseService.UpdateAsync(dto, ct));
    }

    [HttpDelete]
    [Route(nameof(Delete))]
    public async Task<ActionResult> Delete([FromQuery] Guid id, CancellationToken ct)
    {
        await _rankingCaseService.DeleteAsync(id, ct);
        return Ok();
    }
}
