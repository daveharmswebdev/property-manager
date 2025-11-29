using Serilog;

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

// Configure NSwag/OpenAPI
builder.Services.AddOpenApiDocument(config =>
{
    config.Title = "Property Manager API";
    config.Version = "v1";
    config.Description = "API for managing rental property expenses and generating tax reports";
});

var app = builder.Build();

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
app.UseSerilogRequestLogging();
app.MapControllers();

// Health check endpoint
app.MapGet("/api/v1/health", () => new { status = "healthy", version = "1.0.0" })
    .WithName("HealthCheck")
    .WithTags("Health");

app.Run();
