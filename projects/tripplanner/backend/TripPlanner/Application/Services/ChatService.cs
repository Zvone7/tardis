using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Domain.Settings;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public sealed class ChatCompletionResult
{
    public bool Success { get; init; }
    public int StatusCode { get; init; }
    public string? ErrorBody { get; init; }
    public Stream? Stream { get; init; }
}

public sealed class ChatService
{
    private const string OpenAiBaseUrl = "https://api.openai.com/v1/chat/completions";

    private readonly IHttpClientFactory _httpFactory;
    private readonly OpenAiSettings _settings;
    private readonly ILogger<ChatService> _logger;

    public ChatService(
        IHttpClientFactory httpFactory,
        AppSettings appSettings,
        ILogger<ChatService> logger)
    {
        _httpFactory = httpFactory;
        _settings = appSettings.OpenAi ?? new OpenAiSettings();
        _logger = logger;
    }

    public async Task<ChatCompletionResult> StreamCompletionAsync(
        JsonElement requestBody,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            throw new InvalidOperationException("OpenAI API key is not configured.");

        var payload = BuildPayload(requestBody);

        var client = _httpFactory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Post, OpenAiBaseUrl);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiKey);
        request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

        var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("OpenAI returned {StatusCode}: {Body}", (int)response.StatusCode, errorBody);
            response.Dispose();
            request.Dispose();
            client.Dispose();
            return new ChatCompletionResult
            {
                Success = false,
                StatusCode = (int)response.StatusCode,
                ErrorBody = errorBody,
            };
        }

        var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        return new ChatCompletionResult
        {
            Success = true,
            StatusCode = 200,
            Stream = stream,
        };
    }

    private string BuildPayload(JsonElement requestBody)
    {
        using var doc = JsonDocument.Parse(requestBody.GetRawText());
        var root = doc.RootElement;

        var writer = new MemoryStream();
        using (var json = new Utf8JsonWriter(writer))
        {
            json.WriteStartObject();

            json.WriteString("model", _settings.Model);
            json.WriteBoolean("stream", true);

            if (root.TryGetProperty("messages", out var messages))
            {
                json.WritePropertyName("messages");
                messages.WriteTo(json);
            }

            if (root.TryGetProperty("tools", out var tools))
            {
                json.WritePropertyName("tools");
                tools.WriteTo(json);
            }

            if (root.TryGetProperty("tool_choice", out var toolChoice))
            {
                json.WritePropertyName("tool_choice");
                toolChoice.WriteTo(json);
            }

            json.WriteEndObject();
        }

        return Encoding.UTF8.GetString(writer.ToArray());
    }
}
