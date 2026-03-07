using System.Text.Json;
using Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace Web.Controllers;

[ApiController]
[Route("api/chat")]
public class ChatController : ControllerBase
{
    private readonly ChatService _chatService;

    public ChatController(ChatService chatService)
    {
        _chatService = chatService;
    }

    [HttpPost("completions")]
    public async Task StreamCompletion(CancellationToken ct)
    {
        JsonElement body;
        try
        {
            using var doc = await JsonDocument.ParseAsync(Request.Body, cancellationToken: ct);
            body = doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            Response.StatusCode = 400;
            await Response.WriteAsJsonAsync(new { error = "Invalid JSON body." }, ct);
            return;
        }

        try
        {
            var result = await _chatService.StreamCompletionAsync(body, ct);

            if (!result.Success)
            {
                Response.StatusCode = result.StatusCode;
                Response.ContentType = "application/json";
                await Response.WriteAsync(result.ErrorBody ?? "{}", ct);
                return;
            }

            Response.StatusCode = 200;
            Response.ContentType = "text/event-stream";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["Connection"] = "keep-alive";

            await using var stream = result.Stream!;
            await stream.CopyToAsync(Response.Body, ct);
            await Response.Body.FlushAsync(ct);
        }
        catch (InvalidOperationException ex)
        {
            Response.StatusCode = 500;
            await Response.WriteAsJsonAsync(new { error = ex.Message }, ct);
        }
    }
}
