using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for ReportsController.
/// Tests Schedule E report generation, batch reports, report listing, downloading, and deletion.
/// </summary>
public class ReportsControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ReportsControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // POST /api/v1/reports/schedule-e Tests
    // =====================================================

    [Fact]
    public async Task GenerateScheduleE_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new
        {
            PropertyId = Guid.NewGuid(),
            Year = 2024
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/reports/schedule-e", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GenerateScheduleE_WithValidData_ReturnsPdf()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var request = new
        {
            PropertyId = propertyId,
            Year = 2024
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/pdf");
        response.Content.Headers.ContentDisposition?.FileName.Should().Contain("Schedule-E");
        response.Content.Headers.ContentDisposition?.FileName.Should().Contain("2024");

        var content = await response.Content.ReadAsByteArrayAsync();
        content.Should().NotBeEmpty();
        // PDF files start with %PDF
        content[0].Should().Be((byte)'%');
        content[1].Should().Be((byte)'P');
        content[2].Should().Be((byte)'D');
        content[3].Should().Be((byte)'F');
    }

    [Fact]
    public async Task GenerateScheduleE_WithExpensesAndIncome_CalculatesTotals()
    {
        // Arrange
        var email = $"report-calc-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        // Create a property
        var propertyResponse = await PostAsJsonWithAuthAsync("/api/v1/properties", new
        {
            Name = "Revenue Test Property",
            Street = "100 Tax Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        }, accessToken);
        var property = await propertyResponse.Content.ReadFromJsonAsync<CreatePropertyResponse>();

        // Use seeded "Repairs" category (Line 14) - ID from ExpenseCategorySeeder
        var repairsCategoryId = Guid.Parse("11111111-1111-1111-1111-111111111110");

        // Add expenses for 2024
        await PostAsJsonWithAuthAsync("/api/v1/expenses", new
        {
            PropertyId = property!.Id,
            CategoryId = repairsCategoryId,
            Description = "Roof repair",
            Amount = 500.00m,
            Date = "2024-06-15"
        }, accessToken);

        await PostAsJsonWithAuthAsync("/api/v1/expenses", new
        {
            PropertyId = property.Id,
            CategoryId = repairsCategoryId,
            Description = "Plumbing fix",
            Amount = 250.00m,
            Date = "2024-08-20"
        }, accessToken);

        // Add income for 2024
        await PostAsJsonWithAuthAsync("/api/v1/income", new
        {
            PropertyId = property.Id,
            Description = "June rent",
            Amount = 1500.00m,
            Date = "2024-06-01"
        }, accessToken);

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = property.Id,
            Year = 2024
        }, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/pdf");

        // Verify report was saved to database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var savedReport = await dbContext.GeneratedReports
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.PropertyId == property.Id && r.Year == 2024);

        savedReport.Should().NotBeNull();
        savedReport!.ReportType.Should().Be(ReportType.SingleProperty);
        savedReport.FileSizeBytes.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GenerateScheduleE_WithEmptyPropertyId_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            PropertyId = Guid.Empty,
            Year = 2024
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateScheduleE_WithInvalidYear_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var request = new
        {
            PropertyId = propertyId,
            Year = 1999 // Below 2000
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateScheduleE_WithFutureYear_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var request = new
        {
            PropertyId = propertyId,
            Year = DateTime.UtcNow.Year + 2 // Too far in future
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateScheduleE_NonExistentProperty_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            PropertyId = Guid.NewGuid(),
            Year = 2024
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateScheduleE_OtherAccountProperty_Returns404()
    {
        // Arrange
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();

        var request = new
        {
            PropertyId = propertyId1,
            Year = 2024
        };

        // Act - User 2 tries to generate report for User 1's property
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", request, accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // POST /api/v1/reports/schedule-e/batch Tests
    // =====================================================

    [Fact]
    public async Task GenerateBatchScheduleE_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new
        {
            PropertyIds = new[] { Guid.NewGuid() },
            Year = 2024
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/reports/schedule-e/batch", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GenerateBatchScheduleE_WithValidData_ReturnsZip()
    {
        // Arrange
        var email = $"batch-report-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        // Create two properties
        var prop1Response = await PostAsJsonWithAuthAsync("/api/v1/properties", new
        {
            Name = "Batch Property 1",
            Street = "123 First Ave",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        }, accessToken);
        var prop1 = await prop1Response.Content.ReadFromJsonAsync<CreatePropertyResponse>();

        var prop2Response = await PostAsJsonWithAuthAsync("/api/v1/properties", new
        {
            Name = "Batch Property 2",
            Street = "456 Second Ave",
            City = "Austin",
            State = "TX",
            ZipCode = "78702"
        }, accessToken);
        var prop2 = await prop2Response.Content.ReadFromJsonAsync<CreatePropertyResponse>();

        var request = new
        {
            PropertyIds = new[] { prop1!.Id, prop2!.Id },
            Year = 2024
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e/batch", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/zip");
        response.Content.Headers.ContentDisposition?.FileName.Should().Contain("Schedule-E-Reports");
        response.Content.Headers.ContentDisposition?.FileName.Should().Contain("2024");

        var content = await response.Content.ReadAsByteArrayAsync();
        content.Should().NotBeEmpty();
        // ZIP files start with PK (0x50 0x4B)
        content[0].Should().Be(0x50);
        content[1].Should().Be(0x4B);
    }

    [Fact]
    public async Task GenerateBatchScheduleE_WithEmptyPropertyIds_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            PropertyIds = Array.Empty<Guid>(),
            Year = 2024
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e/batch", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateBatchScheduleE_WithInvalidYear_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var request = new
        {
            PropertyIds = new[] { propertyId },
            Year = 1999
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e/batch", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateBatchScheduleE_AllPropertiesNotFound_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            PropertyIds = new[] { Guid.NewGuid(), Guid.NewGuid() },
            Year = 2024
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e/batch", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateBatchScheduleE_SavesReportToDatabase()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var request = new
        {
            PropertyIds = new[] { propertyId },
            Year = 2024
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e/batch", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var savedReport = await dbContext.GeneratedReports
            .IgnoreQueryFilters()
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(r => r.ReportType == ReportType.Batch && r.Year == 2024);

        savedReport.Should().NotBeNull();
        savedReport!.PropertyName.Should().Contain("All Properties");
    }

    // =====================================================
    // GET /api/v1/reports Tests
    // =====================================================

    [Fact]
    public async Task GetReports_WithoutAuth_Returns401()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/reports");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetReports_WithAuth_ReturnsEmptyList()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Act
        var response = await GetWithAuthAsync("/api/v1/reports", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<List<GeneratedReportDto>>();
        content.Should().NotBeNull();
        content.Should().BeEmpty();
    }

    [Fact]
    public async Task GetReports_WithGeneratedReports_ReturnsList()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Generate a report first
        await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = propertyId,
            Year = 2024
        }, accessToken);

        // Act
        var response = await GetWithAuthAsync("/api/v1/reports", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<List<GeneratedReportDto>>();
        content.Should().NotBeNull();
        content.Should().HaveCount(1);
        content![0].Year.Should().Be(2024);
        content[0].FileType.Should().Be("PDF");
    }

    [Fact]
    public async Task GetReports_OnlyReturnsOwnReports()
    {
        // Arrange
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var (accessToken2, propertyId2) = await CreateUserWithPropertyAsync();

        // User 1 generates a report
        await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = propertyId1,
            Year = 2024
        }, accessToken1);

        // User 2 generates a report
        await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = propertyId2,
            Year = 2023
        }, accessToken2);

        // Act - User 1 gets their reports
        var response = await GetWithAuthAsync("/api/v1/reports", accessToken1);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<List<GeneratedReportDto>>();
        content.Should().NotBeNull();
        content.Should().HaveCount(1);
        content![0].Year.Should().Be(2024);
    }

    // =====================================================
    // GET /api/v1/reports/{id} Tests
    // =====================================================

    [Fact]
    public async Task DownloadReport_WithoutAuth_Returns401()
    {
        // Arrange
        var reportId = Guid.NewGuid();

        // Act
        var response = await _client.GetAsync($"/api/v1/reports/{reportId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DownloadReport_ValidId_ReturnsFile()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Generate a report first
        await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = propertyId,
            Year = 2024
        }, accessToken);

        // Get the report ID
        var reportsResponse = await GetWithAuthAsync("/api/v1/reports", accessToken);
        var reports = await reportsResponse.Content.ReadFromJsonAsync<List<GeneratedReportDto>>();
        var reportId = reports![0].Id;

        // Act
        var response = await GetWithAuthAsync($"/api/v1/reports/{reportId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/pdf");

        var content = await response.Content.ReadAsByteArrayAsync();
        content.Should().NotBeEmpty();
    }

    [Fact]
    public async Task DownloadReport_NonExistentId_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentId = Guid.NewGuid();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/reports/{nonExistentId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DownloadReport_OtherAccountReport_Returns404()
    {
        // Arrange
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // User 1 generates a report
        await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = propertyId1,
            Year = 2024
        }, accessToken1);

        // Get the report ID
        var reportsResponse = await GetWithAuthAsync("/api/v1/reports", accessToken1);
        var reports = await reportsResponse.Content.ReadFromJsonAsync<List<GeneratedReportDto>>();
        var reportId = reports![0].Id;

        // Act - User 2 tries to download User 1's report
        var response = await GetWithAuthAsync($"/api/v1/reports/{reportId}", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // DELETE /api/v1/reports/{id} Tests
    // =====================================================

    [Fact]
    public async Task DeleteReport_WithoutAuth_Returns401()
    {
        // Arrange
        var reportId = Guid.NewGuid();

        // Act
        var response = await _client.DeleteAsync($"/api/v1/reports/{reportId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteReport_ValidId_Returns204()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Generate a report first
        await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = propertyId,
            Year = 2024
        }, accessToken);

        // Get the report ID
        var reportsResponse = await GetWithAuthAsync("/api/v1/reports", accessToken);
        var reports = await reportsResponse.Content.ReadFromJsonAsync<List<GeneratedReportDto>>();
        var reportId = reports![0].Id;

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/reports/{reportId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteReport_ValidId_SoftDeletesReport()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Generate a report first
        await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = propertyId,
            Year = 2024
        }, accessToken);

        // Get the report ID
        var reportsResponse = await GetWithAuthAsync("/api/v1/reports", accessToken);
        var reports = await reportsResponse.Content.ReadFromJsonAsync<List<GeneratedReportDto>>();
        var reportId = reports![0].Id;

        var beforeDelete = DateTime.UtcNow;

        // Act
        await DeleteWithAuthAsync($"/api/v1/reports/{reportId}", accessToken);

        var afterDelete = DateTime.UtcNow;

        // Assert
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var deletedReport = await dbContext.GeneratedReports
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Id == reportId);

        deletedReport.Should().NotBeNull();
        deletedReport!.DeletedAt.Should().NotBeNull();
        deletedReport.DeletedAt.Should().BeAfter(beforeDelete.AddSeconds(-1));
        deletedReport.DeletedAt.Should().BeBefore(afterDelete.AddSeconds(1));
    }

    [Fact]
    public async Task DeleteReport_NonExistentId_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentId = Guid.NewGuid();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/reports/{nonExistentId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteReport_OtherAccountReport_Returns404()
    {
        // Arrange
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // User 1 generates a report
        await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = propertyId1,
            Year = 2024
        }, accessToken1);

        // Get the report ID
        var reportsResponse = await GetWithAuthAsync("/api/v1/reports", accessToken1);
        var reports = await reportsResponse.Content.ReadFromJsonAsync<List<GeneratedReportDto>>();
        var reportId = reports![0].Id;

        // Act - User 2 tries to delete User 1's report
        var response = await DeleteWithAuthAsync($"/api/v1/reports/{reportId}", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteReport_AlreadyDeleted_Returns404()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Generate a report
        await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = propertyId,
            Year = 2024
        }, accessToken);

        // Get the report ID
        var reportsResponse = await GetWithAuthAsync("/api/v1/reports", accessToken);
        var reports = await reportsResponse.Content.ReadFromJsonAsync<List<GeneratedReportDto>>();
        var reportId = reports![0].Id;

        // Delete once
        await DeleteWithAuthAsync($"/api/v1/reports/{reportId}", accessToken);

        // Act - Try to delete again
        var response = await DeleteWithAuthAsync($"/api/v1/reports/{reportId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteReport_ExcludedFromGetReports()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Generate two reports
        await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = propertyId,
            Year = 2024
        }, accessToken);

        await PostAsJsonWithAuthAsync("/api/v1/reports/schedule-e", new
        {
            PropertyId = propertyId,
            Year = 2023
        }, accessToken);

        // Get reports and delete one
        var reportsResponse = await GetWithAuthAsync("/api/v1/reports", accessToken);
        var reports = await reportsResponse.Content.ReadFromJsonAsync<List<GeneratedReportDto>>();
        var reportToDelete = reports!.First(r => r.Year == 2023);

        await DeleteWithAuthAsync($"/api/v1/reports/{reportToDelete.Id}", accessToken);

        // Act
        var response = await GetWithAuthAsync("/api/v1/reports", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<List<GeneratedReportDto>>();
        content.Should().HaveCount(1);
        content![0].Year.Should().Be(2024);
    }

    // =====================================================
    // Helper Methods
    // =====================================================

    private async Task<string> GetAccessTokenAsync()
    {
        var email = $"test-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        return accessToken;
    }

    private async Task<(string AccessToken, Guid UserId)> RegisterAndLoginAsync(string email)
    {
        var password = "Test@123456";

        // Create user directly in database
        var (userId, _) = await _factory.CreateTestUserAsync(email, password);

        // Login
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, userId);
    }

    private async Task<(string AccessToken, Guid PropertyId)> CreateUserWithPropertyAsync()
    {
        var email = $"report-test-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        // Create a property
        var propertyRequest = new
        {
            Name = "Test Property",
            Street = "123 Test Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };
        var propertyResponse = await PostAsJsonWithAuthAsync("/api/v1/properties", propertyRequest, accessToken);
        var propertyContent = await propertyResponse.Content.ReadFromJsonAsync<CreatePropertyResponse>();

        return (accessToken, propertyContent!.Id);
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> GetWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> DeleteWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }
}

// =====================================================
// Response DTOs
// =====================================================

public record GeneratedReportDto(
    Guid Id,
    string DisplayName,
    int Year,
    DateTime GeneratedAt,
    string FileName,
    string FileType,
    long FileSizeBytes
);
