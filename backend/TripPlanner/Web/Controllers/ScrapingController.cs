using System.Net;
using Domain.Exceptions;
using Domain.Models;
using Domain.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Web.Controllers;

[ApiController]
[Route("api/scraping")]
public class ScrapingController : ControllerBase
{
    private readonly IAmadeusScrapingService _amadeus;
    private readonly IAirportCatalog _airports;

    public ScrapingController(IAmadeusScrapingService amadeus, IAirportCatalog airports)
    {
        _amadeus = amadeus;
        _airports = airports;
    }

    [HttpPost("amadeus/flight-offers")]
    [AllowAnonymous]
    public async Task<ActionResult<AmadeusFlightOfferResponse>> SearchFlights(
        [FromBody] AmadeusFlightSearchRequest request,
        CancellationToken ct)
    {
        if (request == null)
            return BadRequest(new { error = "Missing request body." });

        if (request.StartLocation == null || request.EndLocation == null)
            return BadRequest(new { error = "StartLocation and EndLocation are required." });

        if (request.StartDateTime == default)
            return BadRequest(new { error = "StartDateTime is required." });

        try
        {
            var result = await _amadeus.GetFlightOffersAsync(request, ct);
            return Ok(result);
        }
        catch (AmadeusException ex)
        {
            return StatusCode((int)HttpStatusCode.BadGateway, new { error = ex.Message });
        }
    }

    [HttpPost("amadeus/hotel-offers")]
    public async Task<ActionResult<AmadeusHotelOfferResponse>> SearchHotels(
        [FromBody] AmadeusHotelSearchRequest request,
        CancellationToken ct)
    {
        if (request == null)
            return BadRequest(new { error = "Missing request body." });

        if (string.IsNullOrWhiteSpace(request.CityName))
            return BadRequest(new { error = "CityName is required." });

        if (request.CheckInDate == default)
            return BadRequest(new { error = "CheckInDate is required." });

        if (request.CheckOutDate == default)
            return BadRequest(new { error = "CheckOutDate is required." });

        try
        {
            var result = await _amadeus.GetHotelOffersAsync(request, ct);
            return Ok(result);
        }
        catch (AmadeusException ex)
        {
            return StatusCode((int)HttpStatusCode.BadGateway, new { error = ex.Message });
        }
    }

    [HttpGet("airports/search")]
    public ActionResult<IEnumerable<AirportLookupResult>> SearchAirports(
        [FromQuery] string q,
        [FromQuery] int limit = 20)
    {
        var query = (q ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(query))
            return BadRequest(new { error = "Missing query parameter ?q=" });

        var results = _airports.Search(query, limit);
        return Ok(results);
    }

    [HttpGet("airports/city-code")]
    public ActionResult<string?> GetCityCode([FromQuery] string city, [FromQuery] string? countryCode = null)
    {
        var query = (city ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(query))
            return BadRequest(new { error = "Missing query parameter ?city=" });

        var code = _airports.GetCityCode(query, countryCode);
        return Ok(code);
    }
}
