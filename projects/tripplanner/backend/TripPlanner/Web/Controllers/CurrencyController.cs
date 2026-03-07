using Application.Services;
using Domain.Dtos;
using Domain.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Web.Helpers;

namespace Web.Controllers;

[Route("api/[controller]")]
[Authorize]
[ApiController]
public class CurrencyController : ControllerBase
{
    private readonly CurrencyService _currencyService;
    private readonly UserService _userService;

    public CurrencyController(CurrencyService currencyService, UserService userService)
    {
        _currencyService = currencyService;
        _userService = userService;
    }

    [HttpGet]
    [Route(nameof(GetCurrencies))]
    public async Task<ActionResult<List<CurrencyDto>>> GetCurrencies(CancellationToken cancellationToken)
    {
        var currencies = await _currencyService.GetCurrenciesAsync(cancellationToken);
        return currencies;
    }

    [HttpGet]
    [Route(nameof(GetConversions))]
    public async Task<ActionResult<List<CurrencyConversionDto>>> GetConversions(CancellationToken cancellationToken)
    {
        var conversions = await _currencyService.GetConversionsAsync(cancellationToken);
        return conversions;
    }

    [HttpPut]
    [Route(nameof(UpsertConversion))]
    public async Task<ActionResult> UpsertConversion(CurrencyConversionDto conversion, CancellationToken cancellationToken)
    {
        var userId = HttpContextExtensions.GetUserId(HttpContext);
        if (userId == null) return Unauthorized("User not found");

        var user = await _userService.GetAsync(userId.Value, cancellationToken);
        if (user == null || !user.IsApproved || !user.IsAdmin())
        {
            return Forbid();
        }

        await _currencyService.UpsertConversionAsync(conversion, cancellationToken);
        return Ok();
    }
}
