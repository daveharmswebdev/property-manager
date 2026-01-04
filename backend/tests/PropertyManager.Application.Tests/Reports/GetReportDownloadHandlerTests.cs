using FluentAssertions;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Reports;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.Reports;

/// <summary>
/// Unit tests for GetReportDownloadHandler (AC-6.3.2).
/// </summary>
public class GetReportDownloadHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IReportStorageService> _storageServiceMock;
    private readonly Mock<ILogger<GetReportDownloadHandler>> _loggerMock;
    private readonly GetReportDownloadHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();

    public GetReportDownloadHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _storageServiceMock = new Mock<IReportStorageService>();
        _loggerMock = new Mock<ILogger<GetReportDownloadHandler>>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);

        _handler = new GetReportDownloadHandler(
            _dbContextMock.Object,
            _currentUserMock.Object,
            _storageServiceMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ValidId_ReturnsFileContent()
    {
        // Arrange
        var report = CreateTestReport(ReportType.SingleProperty);
        var expectedContent = new byte[] { 0x25, 0x50, 0x44, 0x46 }; // PDF magic bytes
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { report });
        _storageServiceMock
            .Setup(x => x.GetReportAsync(report.StorageKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedContent);

        var query = new GetReportDownloadQuery(report.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Content.Should().BeEquivalentTo(expectedContent);
        result.FileName.Should().Be(report.FileName);
        result.ContentType.Should().Be("application/pdf");
    }

    [Fact]
    public async Task Handle_BatchReport_ReturnsZipContentType()
    {
        // Arrange
        var batchReport = CreateTestReport(ReportType.Batch);
        batchReport.FileName = "Schedule-E-Reports-2024.zip";
        var expectedContent = new byte[] { 0x50, 0x4B, 0x03, 0x04 }; // ZIP magic bytes
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { batchReport });
        _storageServiceMock
            .Setup(x => x.GetReportAsync(batchReport.StorageKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedContent);

        var query = new GetReportDownloadQuery(batchReport.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Content.Should().BeEquivalentTo(expectedContent);
        result.ContentType.Should().Be("application/zip");
    }

    [Fact]
    public async Task Handle_NotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupGeneratedReportsDbSet(new List<GeneratedReport>());

        var nonExistentId = Guid.NewGuid();
        var query = new GetReportDownloadQuery(nonExistentId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_DeletedReport_ThrowsNotFoundException()
    {
        // Arrange
        var deletedReport = CreateTestReport(ReportType.SingleProperty);
        deletedReport.DeletedAt = DateTime.UtcNow.AddDays(-1);
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { deletedReport });

        var query = new GetReportDownloadQuery(deletedReport.Id);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_EnforcesTenantIsolation()
    {
        // Arrange - report from different account should not be visible
        var otherAccountReport = CreateTestReport(ReportType.SingleProperty);
        otherAccountReport.AccountId = Guid.NewGuid(); // Different account

        // Simulating query filter - report not visible to current user
        SetupGeneratedReportsDbSet(new List<GeneratedReport>());

        var query = new GetReportDownloadQuery(otherAccountReport.Id);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_S3Error_PropagatesException()
    {
        // Arrange
        var report = CreateTestReport(ReportType.SingleProperty);
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { report });
        _storageServiceMock
            .Setup(x => x.GetReportAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("S3 error - file not found"));

        var query = new GetReportDownloadQuery(report.Id);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*S3 error*");
    }

    [Fact]
    public async Task Handle_LogsDownload()
    {
        // Arrange
        var report = CreateTestReport(ReportType.SingleProperty);
        var content = new byte[] { 0x25, 0x50, 0x44, 0x46 };
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { report });
        _storageServiceMock
            .Setup(x => x.GetReportAsync(report.StorageKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(content);

        var query = new GetReportDownloadQuery(report.Id);

        // Act
        await _handler.Handle(query, CancellationToken.None);

        // Assert - verify logging was called with correct parameters
        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains(report.Id.ToString())),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    private GeneratedReport CreateTestReport(ReportType reportType)
    {
        var fileExtension = reportType == ReportType.Batch ? "zip" : "pdf";
        return new GeneratedReport
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = reportType == ReportType.Batch ? null : Guid.NewGuid(),
            PropertyName = reportType == ReportType.Batch ? "All Properties (3)" : "Test Property",
            Year = 2024,
            FileName = $"Schedule-E-Test-2024.{fileExtension}",
            StorageKey = $"reports/{_testAccountId}/2024/{Guid.NewGuid()}.{fileExtension}",
            FileSizeBytes = 1024,
            ReportType = reportType,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
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
