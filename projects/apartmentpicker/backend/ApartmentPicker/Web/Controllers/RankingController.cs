using Application.Services;
using Domain.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Web.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class RankingController : ControllerBase
{
    private readonly RankingService _rankingService;

    public RankingController(RankingService rankingService)
    {
        _rankingService = rankingService;
    }

    [HttpGet]
    [Route(nameof(GetRankings))]
    public async Task<ActionResult<List<RankedApartmentDto>>> GetRankings([FromQuery] Guid rankingCaseId, CancellationToken ct)
    {
        return Ok(await _rankingService.GetRankingsAsync(rankingCaseId, ct));
    }
}
