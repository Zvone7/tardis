using Application.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Web.Helpers;

public class TripAccessFilterAttribute : Attribute, IAsyncActionFilter
{
    private readonly IServiceProvider _serviceProvider_;

    public TripAccessFilterAttribute(IServiceProvider serviceProvider)
    {
        _serviceProvider_ = serviceProvider;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!context.ActionArguments.TryGetValue("tripId", out var tripId))
        {
            context.Result = new BadRequestObjectResult("Trip ID is required.");
            return;
        }

        var httpContext = context.HttpContext;
        var userId = HttpContextExtensions.GetUserId(httpContext);
        if (userId == null)
        {
            context.Result = new ForbidResult($"Access denied: user not found.");
            return;
        }

        using var scope = _serviceProvider_.CreateScope();
        var tripRepository = scope.ServiceProvider.GetRequiredService<TripService>();

        try
        {
            var hasAccess = await tripRepository.CheckUserHasAccessToTripAsync(userId.Value, int.Parse(tripId.ToString()), httpContext.RequestAborted);
            if (!hasAccess)
            {
                context.Result = new ForbidResult($"Access denied. User {userId} doesn't have access to {tripId}");
                return;
            }
        }
        catch (Exception ex)
        {
            context.Result = new ForbidResult($"Access denied: {ex.Message}");
            return;
        }

        await next();
    }
}