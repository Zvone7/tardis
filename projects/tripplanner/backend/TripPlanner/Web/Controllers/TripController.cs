using Application.Services;
using Domain.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Web.Helpers;

namespace Web.Controllers;

[Route($"api/[controller]")]
[Authorize]
[ApiController]
public class TripController : ControllerBase
{
    private readonly TripService _tripService_;

    public TripController(TripService tripService)
    {
        _tripService_ = tripService;
    }

    [HttpGet]
    [Route(nameof(GetAllTrips))]
    public async Task<ActionResult<List<TripDto>>> GetAllTrips(CancellationToken cancellationToken)
    {
        var userId = HttpContextExtensions.GetUserId(HttpContext);
        if (userId == null) return Unauthorized("User not found");
        return await _tripService_.GetAllAsync(userId.Value, cancellationToken);
    }

    [HttpGet]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(GetTripById))]
    public async Task<ActionResult<TripDto?>> GetTripById(int tripId, CancellationToken cancellationToken)
    {
        return await _tripService_.GetAsync(tripId, cancellationToken);
    }

    [HttpPost]
    [Route(nameof(CreateTrip))]
    public async Task<ActionResult> CreateTrip(TripDto trip, CancellationToken cancellationToken)
    {
        var userId = HttpContextExtensions.GetUserId(HttpContext);
        if (userId == null) return Unauthorized("User not found");
        await _tripService_.CreateAsync(userId.Value, trip, cancellationToken);
        return Ok();
    }

    [HttpPut]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(UpdateTrip))]
    public async Task<ActionResult<TripDto>> UpdateTrip(int tripId, TripDto trip, CancellationToken cancellationToken)
    {
        trip.Id = tripId;
        var updated = await _tripService_.UpdateAsync(trip, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete]
    [ServiceFilter(typeof(TripAccessFilterAttribute))]
    [Route(nameof(DeleteTrip))]
    public async Task<ActionResult> DeleteTrip(int tripId, CancellationToken cancellationToken)
    {
        await _tripService_.DeleteTripAsync(tripId, cancellationToken);
        return Ok();
    }
}
