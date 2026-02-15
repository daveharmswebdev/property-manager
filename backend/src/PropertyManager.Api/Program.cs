using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PropertyManager.Api.Hubs;
using PropertyManager.Api.Middleware;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Infrastructure.Email;
using PropertyManager.Infrastructure.Identity;
using PropertyManager.Api.Services;
using PropertyManager.Infrastructure.Persistence;
using PropertyManager.Infrastructure.Storage;
using PropertyManager.Infrastructure.Reports;
using QuestPDF.Infrastructure;
using Serilog;

// Configure QuestPDF license (Community MIT for < $1M revenue) - AC 6.1.4
QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Application", "PropertyManager")
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container
builder.Services.AddControllers();

// Configure EF Core with PostgreSQL
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? "Host=localhost;Database=propertymanager;Username=postgres;Password=localdev";

// Convert Render's PostgreSQL URI format to .NET format if needed
// Render provides: postgres://user:password@host:port/database
// Npgsql expects: Host=host;Port=port;Database=database;Username=user;Password=password
connectionString = ConvertPostgresConnectionString(connectionString);

// Configure Npgsql data source with dynamic JSON for JSONB columns (ADR #15)
var dataSourceBuilder = new Npgsql.NpgsqlDataSourceBuilder(connectionString);
dataSourceBuilder.EnableDynamicJson(); // Required for List<T> and complex types in JSONB columns
var dataSource = dataSourceBuilder.Build();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(dataSource));

// Register Application layer interfaces
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUserService>();
builder.Services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();

// Configure Email settings
builder.Services.Configure<EmailSettings>(
    builder.Configuration.GetSection(EmailSettings.SectionName));

// Configure S3 Storage settings
builder.Services.Configure<S3StorageSettings>(
    builder.Configuration.GetSection(S3StorageSettings.SectionName));

// Check if S3 credentials are configured
var s3Settings = builder.Configuration.GetSection(S3StorageSettings.SectionName).Get<S3StorageSettings>();
var s3Configured = !string.IsNullOrEmpty(s3Settings?.AccessKeyId)
    && !string.IsNullOrEmpty(s3Settings?.SecretAccessKey)
    && !string.IsNullOrEmpty(s3Settings?.BucketName);

if (s3Configured)
{
    builder.Services.AddScoped<IStorageService, S3StorageService>();
    builder.Services.AddScoped<IReportStorageService, ReportStorageService>();
    builder.Services.AddHttpClient<IPhotoService, PhotoService>();
}
else
{
    // Use NoOp implementations for local development and CI
    builder.Services.AddScoped<IStorageService, NoOpStorageService>();
    builder.Services.AddScoped<IReportStorageService, NoOpReportStorageService>();
    builder.Services.AddScoped<IPhotoService, NoOpPhotoService>();
}

// Register thumbnail service (always available - no external dependencies)
builder.Services.AddScoped<IThumbnailService, ImageSharpThumbnailService>();

// Register PDF report generators (AC-6.1.4, AC-12.1)
builder.Services.AddScoped<IScheduleEPdfGenerator, ScheduleEPdfGenerator>();
builder.Services.AddScoped<IWorkOrderPdfGenerator, WorkOrderPdfGenerator>();

// Register report bundle service for ZIP creation (AC-6.2.4, AC-6.2.5)
builder.Services.AddScoped<IReportBundleService, ReportBundleService>();

// Configure SignalR for real-time notifications (AC-5.6.1)
builder.Services.AddSignalR();
builder.Services.AddScoped<IReceiptNotificationService, ReceiptNotificationService>();

// Configure JWT settings
builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection(JwtSettings.SectionName));
builder.Services.AddScoped<IJwtService, JwtService>();

// Configure JWT Bearer Authentication (AC4.2)
var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()!;
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtSettings.Secret)),
        ClockSkew = TimeSpan.Zero  // No clock skew tolerance per Architecture doc
    };

    // Handle JWT in query string for SignalR connections (AC-5.6.1)
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            if (!string.IsNullOrEmpty(accessToken) &&
                path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// Configure MediatR
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(PropertyManager.Application.Auth.LoginCommand).Assembly);
});

// Configure FluentValidation
builder.Services.AddValidatorsFromAssembly(typeof(PropertyManager.Application.Auth.LoginCommand).Assembly);

// Configure ASP.NET Core Identity
// Use AddIdentityCore to avoid overriding JWT Bearer as the default auth scheme
builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    // Password requirements per AC3.2
    options.Password.RequiredLength = 8;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireDigit = true;
    options.Password.RequireNonAlphanumeric = true;

    // User settings
    options.User.RequireUniqueEmail = true;

    // Sign-in settings
    options.SignIn.RequireConfirmedEmail = true;

    // Lockout settings (optional, for security)
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;
})
.AddRoles<IdentityRole<Guid>>()
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders()
.AddSignInManager();

// Configure token lifespan for email verification (24 hours per AC3.4)
builder.Services.Configure<DataProtectionTokenProviderOptions>(options =>
{
    options.TokenLifespan = TimeSpan.FromHours(24);
});

// Configure CORS (AC-14.1)
const string corsPolicyName = "AllowedOrigins";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (allowedOrigins.Length == 0)
{
    Log.Warning("No CORS allowed origins configured — all cross-origin requests will be blocked. Set Cors:AllowedOrigins in appsettings.");
}
builder.Services.AddCors(options =>
{
    options.AddPolicy(corsPolicyName, policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
              .WithHeaders("Authorization", "Content-Type")
              .AllowCredentials();
    });
});

// Configure Rate Limiting (AC-14.3)
builder.Services.AddRateLimiter(options =>
{
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/problem+json";

        var retryAfterSeconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
            ? Math.Max(1, (int)retryAfter.TotalSeconds)
            : 60;

        context.HttpContext.Response.Headers.RetryAfter =
            retryAfterSeconds.ToString(CultureInfo.InvariantCulture);

        var user = context.HttpContext.User.Identity?.Name ?? "anonymous";
        var path = context.HttpContext.Request.Path;
        Log.Warning("Rate limit exceeded for {User} at {Path}", user, path);

        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            type = "https://propertymanager.app/errors/rate-limit-exceeded",
            title = "Too many requests",
            status = 429,
            detail = $"Rate limit exceeded. Try again in {retryAfterSeconds} seconds."
        }, cancellationToken);
    };

    // Named policy: "auth" — 5 requests per minute per IP (AC #1)
    options.AddSlidingWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.SegmentsPerWindow = 6;
        opt.QueueLimit = 0;
        opt.AutoReplenishment = true;
    });

    // Named policy: "refresh" — 10 requests per minute per IP (AC #2)
    options.AddSlidingWindowLimiter("refresh", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.SegmentsPerWindow = 6;
        opt.QueueLimit = 0;
        opt.AutoReplenishment = true;
    });

    // Global policy: "api" — 100 requests per minute, keyed by user ID or IP (AC #3, #4)
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var userId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var partitionKey = userId ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        return RateLimitPartition.GetSlidingWindowLimiter(partitionKey, _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 100,
            Window = TimeSpan.FromMinutes(1),
            SegmentsPerWindow = 6,
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });
});

// Configure NSwag/OpenAPI
builder.Services.AddOpenApiDocument(config =>
{
    config.Title = "Property Manager API";
    config.Version = "v1";
    config.Description = "API for managing rental property expenses and generating tax reports";
});

var app = builder.Build();

// Register global exception handler as first middleware
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseOpenApi();
    app.UseSwaggerUi(config =>
    {
        config.Path = "/swagger";
        config.DocumentPath = "/swagger/v1/swagger.json";
    });
}

app.UseHttpsRedirection();
app.UseHsts();
app.UseSecurityHeaders();
app.UseSerilogRequestLogging();
app.UseCors(corsPolicyName);

// Add authentication and authorization middleware
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

// Map SignalR hub for real-time receipt notifications (AC-5.6.1)
app.MapHub<ReceiptHub>("/hubs/receipts");

// Apply database migrations and seed data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    if (app.Environment.IsProduction())
    {
        try
        {
            Log.Information("Applying database migrations...");
            await db.Database.MigrateAsync();
            Log.Information("Database migrations applied successfully");
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "Failed to apply database migrations - application cannot start");
            throw; // Prevent app from starting with failed migrations
        }
    }

    // Seed owner account (runs in all environments)
    try
    {
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<OwnerAccountSeeder>>();
        var seeder = new OwnerAccountSeeder(db, userManager, logger);
        await seeder.SeedAsync();
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Failed to seed owner account - continuing anyway");
        // Don't throw - allow app to start even if seeding fails (owner might already exist)
    }
}

app.Run();

// Helper function to convert PostgreSQL connection string formats
static string ConvertPostgresConnectionString(string connectionString)
{
    // If it's already in .NET format (contains "Host="), return as-is
    if (connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase))
    {
        return connectionString;
    }

    // Parse Render's URI format: postgres://user:password@host[:port]/database
    // Port is optional - Render often omits it
    var pattern = @"^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)$";
    var match = Regex.Match(connectionString, pattern);

    if (match.Success)
    {
        var user = match.Groups[1].Value;
        var password = match.Groups[2].Value;
        var host = match.Groups[3].Value;
        var port = match.Groups[4].Success ? match.Groups[4].Value : "5432";
        var database = match.Groups[5].Value;

        return $"Host={host};Port={port};Database={database};Username={user};Password={password};SSL Mode=Require;Trust Server Certificate=true";
    }

    // If pattern doesn't match, return original and let it fail with a clear error
    return connectionString;
}
