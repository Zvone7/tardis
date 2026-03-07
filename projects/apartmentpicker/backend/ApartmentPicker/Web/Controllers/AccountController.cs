using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Application.Services;
using Domain.Constants;
using Domain.Dtos;
using Domain.Settings;

[Route("api/[controller]")]
[ApiController]
public class AccountController : Controller
{
    private readonly AppSettings _appSettings;
    private readonly UserService _userService;
    private readonly string _redirectUrl;

    public AccountController(AppSettings appSettings, UserService userService)
    {
        _appSettings = appSettings;
        _userService = userService;
        _redirectUrl = $"{_appSettings.FrontendRootUrl.TrimEnd('/')}/ranking-cases";
    }

    [HttpGet("Login")]
    public IActionResult Login()
    {
        var redirectUrl = Url.Action(nameof(GoogleResponse), "Account", Request.Scheme);
        var properties = new AuthenticationProperties { RedirectUri = redirectUrl };
        properties.AllowRefresh = true;
        properties.IsPersistent = true;
        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    [HttpGet("GoogleResponse")]
    public async Task<IActionResult> GoogleResponse(CancellationToken cancellationToken = default)
    {
        var authenticateResult = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);

        if (!authenticateResult.Succeeded)
        {
            Console.WriteLine("Unsuccessful authentication via google. Redirecting home.");
            return Redirect(_appSettings.FrontendRootUrl);
        }
        Console.WriteLine("Successful authenticated via google.");

        var claims = authenticateResult.Principal.Identities
            .FirstOrDefault()?.Claims.Select(claim => new
            {
                claim.Type,
                claim.Value
            });

        var email = claims?.FirstOrDefault(c => c.Type == ClaimTypes.Email)?.Value;
        var name = claims?.FirstOrDefault(c => c.Type == ClaimTypes.Name)?.Value;

        if (!string.IsNullOrEmpty(email))
        {
            var user = await _userService.GetAsync(email, cancellationToken);
            if (user == null)
            {
                user = await _userService.CreateUserAsync(email, name, cancellationToken);
            }

            await CreateCookieAsync(user.Id, email, name);
            return Redirect(_redirectUrl);
        }
        return Redirect(_appSettings.FrontendRootUrl);
    }

    [HttpGet("Info")]
    public async Task<ActionResult<UserDto?>> Info(CancellationToken cancellationToken)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "UserId");
            if (userIdClaim != null)
            {
                var user = await _userService.GetAsync(int.Parse(userIdClaim.Value), cancellationToken);
                if (user != null && user.IsApproved)
                    return user;
            }
        }
        return Unauthorized();
    }

    [HttpPost("Logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok();
    }

    [Authorize]
    [HttpGet("Unapproved")]
    public async Task<ActionResult<List<UserDto>>> Unapproved(CancellationToken cancellationToken)
    {
        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "UserId");
        if (userIdClaim == null) return Unauthorized();

        var currentUser = await _userService.GetAsync(int.Parse(userIdClaim.Value), cancellationToken);
        if (currentUser?.Role != UserRoles.admin.ToString()) return Forbid();

        var unapproved = await _userService.GetUnapprovedUsersAsync(cancellationToken);
        return unapproved;
    }

    [Authorize]
    [HttpPost("Approve")]
    public async Task<IActionResult> Approve([FromQuery] int userId, CancellationToken cancellationToken)
    {
        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "UserId");
        if (userIdClaim == null) return Unauthorized();

        var currentUser = await _userService.GetAsync(int.Parse(userIdClaim.Value), cancellationToken);
        if (currentUser?.Role != UserRoles.admin.ToString()) return Forbid();

        var result = await _userService.SetApprovedAsync(userId, cancellationToken);
        return result ? Ok() : NotFound();
    }

    private async Task CreateCookieAsync(int userId, string email, string? name)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Email, email),
            new Claim(ClaimTypes.Name, name ?? string.Empty),
            new Claim(ClaimTypes.Role, UserRoles.user.ToString()),
            new Claim("UserId", userId.ToString())
        };

        var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var claimsPrincipal = new ClaimsPrincipal(claimsIdentity);

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            claimsPrincipal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTime.UtcNow.AddDays(7)
            });
    }
}
