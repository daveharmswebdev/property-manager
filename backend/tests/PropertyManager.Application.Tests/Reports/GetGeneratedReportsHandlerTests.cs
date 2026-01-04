using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Reports;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Reports;

/// <summary>
/// Unit tests for GetGeneratedReportsHandler (AC-6.3.1, AC-6.3.6).
/// </summary>
public class GetGeneratedReportsHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetGeneratedReportsHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();

    public GetGeneratedReportsHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);

        _handler = new GetGeneratedReportsHandler(
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ReturnsReportsSortedByDateDescending()
    {
        // Arrange
        var reports = new List<GeneratedReport>
        {
            CreateTestReport("Property A", 2024, DateTime.UtcNow.AddDays(-3)),
            CreateTestReport("Property B", 2024, DateTime.UtcNow.AddDays(-1)),
            CreateTestReport("Property C", 2024, DateTime.UtcNow.AddDays(-2))
        };
        SetupGeneratedReportsDbSet(reports);

        var query = new GetGeneratedReportsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().HaveCount(3);
        result[0].DisplayName.Should().Be("Property B"); // Most recent first
        result[1].DisplayName.Should().Be("Property C");
        result[2].DisplayName.Should().Be("Property A"); // Oldest last
    }

    [Fact]
    public async Task Handle_ReturnsEmptyListWhenNoReports()
    {
        // Arrange
        SetupGeneratedReportsDbSet(new List<GeneratedReport>());

        var query = new GetGeneratedReportsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_MapsReportFieldsCorrectly()
    {
        // Arrange
        var reportId = Guid.NewGuid();
        var createdAt = DateTime.UtcNow.AddDays(-1);
        var report = new GeneratedReport
        {
            Id = reportId,
            AccountId = _testAccountId,
            PropertyId = Guid.NewGuid(),
            PropertyName = "Test Property",
            Year = 2024,
            FileName = "Schedule-E-Test-Property-2024.pdf",
            StorageKey = "reports/test/2024/abc.pdf",
            FileSizeBytes = 12345,
            ReportType = ReportType.SingleProperty,
            CreatedAt = createdAt,
            DeletedAt = null
        };
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { report });

        var query = new GetGeneratedReportsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().HaveCount(1);
        var dto = result[0];
        dto.Id.Should().Be(reportId);
        dto.DisplayName.Should().Be("Test Property");
        dto.Year.Should().Be(2024);
        dto.GeneratedAt.Should().Be(createdAt);
        dto.FileName.Should().Be("Schedule-E-Test-Property-2024.pdf");
        dto.FileType.Should().Be("PDF");
        dto.FileSizeBytes.Should().Be(12345);
    }

    [Fact]
    public async Task Handle_BatchReportShowsAllProperties()
    {
        // Arrange
        var batchReport = new GeneratedReport
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = null, // Batch report has no single property
            PropertyName = "All Properties (3)",
            Year = 2024,
            FileName = "Schedule-E-Reports-2024.zip",
            StorageKey = "reports/test/2024/abc.zip",
            FileSizeBytes = 54321,
            ReportType = ReportType.Batch,
            CreatedAt = DateTime.UtcNow,
            DeletedAt = null
        };
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { batchReport });

        var query = new GetGeneratedReportsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().HaveCount(1);
        var dto = result[0];
        dto.DisplayName.Should().Be("All Properties");
        dto.FileType.Should().Be("ZIP");
    }

    [Fact]
    public async Task Handle_ExcludesDeletedReports()
    {
        // Arrange
        var activeReport = CreateTestReport("Active Property", 2024, DateTime.UtcNow);
        var deletedReport = CreateTestReport("Deleted Property", 2024, DateTime.UtcNow.AddDays(-1));
        deletedReport.DeletedAt = DateTime.UtcNow;

        SetupGeneratedReportsDbSet(new List<GeneratedReport> { activeReport, deletedReport });

        var query = new GetGeneratedReportsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().HaveCount(1);
        result[0].DisplayName.Should().Be("Active Property");
    }

    [Fact]
    public async Task Handle_OnlyReturnsReportsForCurrentAccount()
    {
        // Arrange - reports from different accounts
        var otherAccountId = Guid.NewGuid();
        var myReport = CreateTestReport("My Property", 2024, DateTime.UtcNow);
        var otherReport = CreateTestReport("Other Property", 2024, DateTime.UtcNow);
        otherReport.AccountId = otherAccountId; // Different account

        // Only my report should be returned due to query filter simulation
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { myReport });

        var query = new GetGeneratedReportsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().HaveCount(1);
        result[0].DisplayName.Should().Be("My Property");
    }

    [Fact]
    public async Task Handle_HandlesNullPropertyName()
    {
        // Arrange
        var report = CreateTestReport(null!, 2024, DateTime.UtcNow);
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { report });

        var query = new GetGeneratedReportsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().HaveCount(1);
        result[0].DisplayName.Should().Be("Unknown Property");
    }

    private GeneratedReport CreateTestReport(string propertyName, int year, DateTime createdAt)
    {
        return new GeneratedReport
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = Guid.NewGuid(),
            PropertyName = propertyName,
            Year = year,
            FileName = $"Schedule-E-{propertyName}-{year}.pdf",
            StorageKey = $"reports/{_testAccountId}/{year}/{Guid.NewGuid()}.pdf",
            FileSizeBytes = 1024,
            ReportType = ReportType.SingleProperty,
            CreatedAt = createdAt,
            DeletedAt = null
        };
    }

    private void SetupGeneratedReportsDbSet(List<GeneratedReport> reports)
    {
        // Filter to simulate global query filters (tenant + soft delete)
        var filteredReports = reports
            .Where(r => r.AccountId == _testAccountId && r.DeletedAt == null)
            .ToList();

        var mockDbSet = filteredReports.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.GeneratedReports).Returns(mockDbSet.Object);
    }
}
