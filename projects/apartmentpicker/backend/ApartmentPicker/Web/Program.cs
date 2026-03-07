using Application.Services;
using Azure.Identity;
using Db.Repositories;
using Domain.Settings;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;

public class Program
{
    public static void Main(string[] args)
    {
        Console.WriteLine("****************************************");
        Console.WriteLine($"{DateTime.UtcNow}|ApartmentPicker - App start");
        Console.WriteLine("****************************************");

        var builder = WebApplication.CreateBuilder(args);
        var appSettings = SetupConfiguration(builder);
        InitializeDi(builder, appSettings);
        SetupAuthNAuth(builder, appSettings);

        var app = builder.Build();
        ConfigureApp(app);

        Console.WriteLine($"{DateTime.UtcNow}|ApartmentPicker - Running");
        app.Run();
    }

    private static AppSettings SetupConfiguration(WebApplicationBuilder builder)
    {
        builder.Configuration.AddEnvironmentVariables();
        builder.Configuration.AddJsonFile("appsettings.json", optional: false);
        var keyVaultName = builder.Configuration["KEYVAULT_NAME"];
#if RELEASE
        var keyvaultUri = new Uri($"https://{keyVaultName}.vault.azure.net/");
        builder.Configuration.AddAzureKeyVault(keyvaultUri, new DefaultAzureCredential());
#else
        builder.Configuration.AddJsonFile("appsettings.Development.json", optional: true);
        if (!string.IsNullOrWhiteSpace(keyVaultName))
        {
            var keyvaultUri = new Uri($"https://{keyVaultName}.vault.azure.net/");
            var clientId = builder.Configuration["CLIENT_ID"];
            var tenantId = builder.Configuration["TENANT_ID"];
            var clientSecret = builder.Configuration["CLIENT_SECRET"];
            if (!string.IsNullOrWhiteSpace(clientId))
            {
                builder.Configuration.AddAzureKeyVault(keyvaultUri, new ClientSecretCredential(tenantId, clientId, clientSecret));
            }
            builder.Configuration.AddJsonFile("appsettings.Development.json", optional: true);
        }
#endif

        var appSettings = new AppSettings();
        builder.Configuration.GetSection("AppSettings").Bind(appSettings);
        appSettings.FrontendRootUrl = builder.Configuration["FRONTEND_ROOT_URL"] ?? "";
        appSettings.BackendRootUrl = builder.Configuration["BACKEND_ROOT_URL"] ?? "";
        appSettings.AppStartedUtc = DateTime.UtcNow;
        appSettings.EnvCode = builder.Configuration["ENV_CODE"] ?? "";
        appSettings.BuildNumber = builder.Configuration["BUILD_NUMBER"] ?? "";
        Console.WriteLine($"{DateTime.UtcNow}|env: {appSettings.EnvCode}, build: {appSettings.BuildNumber}");
        builder.Services.AddSingleton(appSettings);

#if DEBUG
        builder.WebHost.UseUrls("https://0.0.0.0:7049");
#endif
        return appSettings;
    }

    private static void InitializeDi(WebApplicationBuilder builder, AppSettings appSettings)
    {
        // Services
        builder.Services.AddScoped<RankingCaseService>();
        builder.Services.AddScoped<CriterionService>();
        builder.Services.AddScoped<ApartmentService>();
        builder.Services.AddScoped<RankingService>();
        builder.Services.AddScoped<UserService>();

        // Repositories
        builder.Services.AddScoped<RankingCaseRepository>();
        builder.Services.AddScoped<CriterionRepository>();
        builder.Services.AddScoped<ApartmentRepository>();
        builder.Services.AddScoped<UserRepository>();
    }

    private static void SetupAuthNAuth(WebApplicationBuilder builder, AppSettings appSettings)
    {
        builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.LoginPath = "/";
                options.ExpireTimeSpan = TimeSpan.FromDays(7);
                options.SlidingExpiration = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                options.Cookie.Name = "ApAuthCookie";
#if DEBUG
                options.Cookie.SameSite = SameSiteMode.Lax;
#else
                options.Cookie.SameSite = SameSiteMode.None;
#endif
            })
            .AddGoogle(options =>
            {
                options.ClientId = appSettings.GoogleAuthSettings.ClientId;
                options.ClientSecret = appSettings.GoogleAuthSettings.ClientSecret;
                options.CallbackPath = "/signin-google";
            });

        builder.Services.AddControllersWithViews();

        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend",
                b => b
                    .WithOrigins(
#if DEBUG
                        "http://localhost:3001",
                        "https://localhost:7049",
#endif
                        appSettings.FrontendRootUrl,
                        appSettings.BackendRootUrl)
                    .AllowCredentials()
                    .AllowAnyMethod()
                    .AllowAnyHeader()
            );
        });
    }

    private static void ConfigureApp(WebApplication app)
    {
        if (!app.Environment.IsDevelopment())
        {
            app.UseExceptionHandler("/Home/Error");
            app.UseHsts();
        }

        app.UseForwardedHeaders(new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedProto
        });

        app.UseCors("AllowFrontend");
        app.UseHttpsRedirection();
        app.UseDefaultFiles();
        app.UseStaticFiles();
        app.MapFallbackToFile("index.html");
        app.UseRouting();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllerRoute(name: "default", pattern: "{controller=Home}/{action=Index}/{id?}");
    }
}
