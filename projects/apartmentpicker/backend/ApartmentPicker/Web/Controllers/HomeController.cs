using Domain.Settings;
using Microsoft.AspNetCore.Mvc;

namespace Web.Controllers;

[Route("api/[controller]")]
[ApiController]
public class HomeController : ControllerBase
{
    private readonly AppSettings _appSettings;

    public HomeController(AppSettings appSettings)
    {
        _appSettings = appSettings;
    }

    [HttpGet]
    [Route(nameof(Status))]
    public ActionResult<string> Status()
    {
        return Ok($"ApartmentPicker | env: {_appSettings.EnvCode} | build: {_appSettings.BuildNumber} | started: {_appSettings.AppStartedUtc:u}");
    }
}
