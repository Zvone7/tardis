using Application.Services;
using Domain.ActionModels;
using Domain.DbModels;
using Domain.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Web.Helpers;

namespace Web.Controllers;

[Route($"api/[controller]")]
[Authorize]
[ApiController]
public class SegmentController : ControllerBase
{
    private readonly SegmentService _segmentService_;

    public SegmentController(SegmentService segmentService)
    {
        _segmentService_ = segmentService;
    }

    [HttpGet]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(GetSegmentsByTripId))]
    public async Task<ActionResult<List<SegmentDto>>> GetSegmentsByTripId(int tripId, CancellationToken cancellationToken)
    {
        return await _segmentService_.GetAllByTripIdAsync(tripId, cancellationToken);
    }

    [HttpGet]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(GetSegmentById))]
    public async Task<ActionResult<SegmentDto?>> GetSegmentById([FromQuery]int tripId, int segmentId, CancellationToken cancellationToken)
    {
        return await _segmentService_.GetAsync(segmentId, cancellationToken);
    }

    [HttpPost]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(CreateSegment))]
    public async Task<ActionResult> CreateSegment([FromQuery]int tripId, SegmentDto segment, CancellationToken cancellationToken)
    {
        await _segmentService_.CreateAsync(segment, cancellationToken);
        return Ok();
    }

    [HttpPut]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(UpdateSegment))]
    public async Task<ActionResult> UpdateSegment([FromQuery]int tripId, SegmentDto segment, CancellationToken cancellationToken)
    {
        await _segmentService_.UpdateAsync(segment, cancellationToken);
        return Ok();
    }

    [HttpDelete]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(DeleteSegment))]
    public async Task<ActionResult> DeleteSegment(int tripId, int segmentId, CancellationToken cancellationToken)
    {
        await _segmentService_.DeleteAsync(segmentId, cancellationToken);
        return Ok();
    }

    [HttpGet]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(GetConnectedOptions))]
    public async Task<ActionResult<List<OptionDto>>> GetConnectedOptions(int tripId, int segmentId, CancellationToken cancellationToken)
    {
        return await _segmentService_.GetConnectedOptionsAsync(segmentId, cancellationToken);
    }
    
    [HttpPut]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(UpdateConnectedOptions))]
    public async Task<ActionResult> UpdateConnectedOptions([FromQuery]int tripId, UpdateConnectedOptionsAm am, CancellationToken cancellationToken)
    {
        await _segmentService_.ConnectSegmentWithOptionsAsync(am, cancellationToken);
        return Ok();
    }

    [HttpGet]
    [Route(nameof(GetSegmentTypes))]
    public async Task<ActionResult<List<SegmentTypeDto>>> GetSegmentTypes(CancellationToken cancellationToken)
    {
        return await _segmentService_.GetAllSegmentTypesAsync(cancellationToken);
    }

    [HttpGet("ParseBookingLink")]
    public async Task<ActionResult<SegmentSuggestionDto>> ParseBookingLink([FromQuery] string url, CancellationToken cancellationToken)
    {
        var result = await _segmentService_.ParseBookingLinkAsync(url, cancellationToken);
        return Ok(result);
    }

    [HttpGet("ParseFlightsLink")]
    public async Task<ActionResult<SegmentSuggestionDto>> ParseFlightsLink([FromQuery] string url, CancellationToken cancellationToken)
    {
        var result = await _segmentService_.ParseFlightsLinkAsync(url, cancellationToken);
        return Ok(result);
    }
}
