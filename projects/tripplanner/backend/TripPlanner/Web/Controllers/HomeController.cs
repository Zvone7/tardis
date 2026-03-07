using System.Diagnostics;
using Domain.Settings;
using Microsoft.AspNetCore.Mvc;
using Web.Models;

namespace Web.Controllers;

[Route($"api/[controller]")]
[ApiController]
public class HomeController : Controller
{
    private readonly AppSettings _appSettings;
    private readonly ILogger<HomeController> _logger_;

    public HomeController(
        AppSettings appSettings,
        ILogger<HomeController> logger)
    {
        _appSettings = appSettings;
        _logger_ = logger;
    }

    public IActionResult Index()
    {
        return View();
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }

    [HttpGet]
    [Route(nameof(Status))]
    public string Status()
    {
        return $"Api up and running. [{_appSettings.EnvCode}-{_appSettings.BuildNumber}] \n" +
               $"Started {_appSettings.AppStartedUtc:yyyy/MM/dd HH:mm:ss} (utc). \n" +
               $"BE {_appSettings.BackendRootUrl}. \n" +
               $"FE {_appSettings.FrontendRootUrl}. \n";
    }
}