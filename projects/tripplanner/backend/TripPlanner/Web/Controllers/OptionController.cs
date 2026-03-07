using Application.Services;
using Domain.ActionModels;
using Domain.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Web.Helpers;

namespace Web.Controllers;

[Route($"api/[controller]")]
[Authorize]
[ApiController]
public class OptionController : ControllerBase
{
    private readonly OptionService _optionService_;

    public OptionController(OptionService optionService)
    {
        _optionService_ = optionService;
    }

    [HttpGet]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(GetOptionsByTripId))]
    public async Task<ActionResult<List<OptionDto>>> GetOptionsByTripId(int tripId, CancellationToken cancellationToken)
    {
        var options = await _optionService_.GetAllByTripIdAsync(tripId, cancellationToken);
        return Ok(options);
    }

    [HttpGet]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(GetOptionById))]
    public async Task<ActionResult<OptionDto?>> GetOptionById(int tripId, int optionId, CancellationToken cancellationToken)
    {
        var option = await _optionService_.GetAsync(optionId, cancellationToken);
        return Ok(option);
    }

    [HttpPost]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(CreateOption))]
    public async Task<ActionResult> CreateOption([FromQuery] int tripId, OptionDto option, CancellationToken cancellationToken)
    {
        await _optionService_.CreateAsync(option, cancellationToken);
        return Ok();
    }

    [HttpPut]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(UpdateOption))]
    public async Task<ActionResult> UpdateOption([FromQuery] int tripId, UpdateOptionAm option, CancellationToken cancellationToken)
    {
        await _optionService_.UpdateAsync(option, cancellationToken);
        return Ok();
    }

    [HttpDelete]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(DeleteOption))]
    public async Task<ActionResult> DeleteOption(int tripId, int optionId, CancellationToken cancellationToken)
    {
        await _optionService_.DeleteAsync(optionId, cancellationToken);
        return Ok();
    }

    [HttpGet]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(GetConnectedSegments))]
    public async Task<ActionResult<List<SegmentDto>>> GetConnectedSegments([FromQuery] int tripId, int optionId, CancellationToken cancellationToken)
    {
        var segments = await _optionService_.GetConnectedSegmentsAsync(optionId, cancellationToken);
        return Ok(segments);
    }

    [HttpPut]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(UpdateConnectedSegments))]
    public async Task<ActionResult> UpdateConnectedSegments([FromQuery] int tripId, UpdateConnectedSegmentsAm am, CancellationToken cancellationToken)
    {
        await _optionService_.ConnectOptionWithSegmentsAsync(am, cancellationToken);
        return Ok();
    }
}