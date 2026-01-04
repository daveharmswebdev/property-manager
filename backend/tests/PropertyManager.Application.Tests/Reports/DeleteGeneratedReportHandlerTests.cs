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
/// Unit tests for DeleteGeneratedReportHandler (AC-6.3.3).
/// </summary>
public class DeleteGeneratedReportHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IReportStorageService> _storageServiceMock;
    private readonly Mock<ILogger<DeleteGeneratedReportHandler>> _loggerMock;
    private readonly DeleteGeneratedReportHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();

    public DeleteGeneratedReportHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _storageServiceMock = new Mock<IReportStorageService>();
        _loggerMock = new Mock<ILogger<DeleteGeneratedReportHandler>>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);

        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        _handler = new DeleteGeneratedReportHandler(
            _dbContextMock.Object,
            _currentUserMock.Object,
            _storageServiceMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ValidId_SoftDeletesReport()
    {
        // Arrange
        var report = CreateTestReport();
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { report });
        _storageServiceMock
            .Setup(x => x.DeleteReportAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var command = new DeleteGeneratedReportCommand(report.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        report.DeletedAt.Should().NotBeNull();
        report.DeletedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ValidId_DeletesFileFromS3()
    {
        // Arrange
        var report = CreateTestReport();
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { report });
        _storageServiceMock
            .Setup(x => x.DeleteReportAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var command = new DeleteGeneratedReportCommand(report.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _storageServiceMock.Verify(x => x.DeleteReportAsync(
            report.StorageKey,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_S3DeleteFails_StillSoftDeletesReport()
    {
        // Arrange
        var report = CreateTestReport();
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { report });
        _storageServiceMock
            .Setup(x => x.DeleteReportAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("S3 error"));

        var command = new DeleteGeneratedReportCommand(report.Id);

        // Act - should not throw despite S3 failure
        await _handler.Handle(command, CancellationToken.None);

        // Assert - report should still be soft-deleted
        report.DeletedAt.Should().NotBeNull();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupGeneratedReportsDbSet(new List<GeneratedReport>());

        var nonExistentId = Guid.NewGuid();
        var command = new DeleteGeneratedReportCommand(nonExistentId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_AlreadyDeletedReport_ThrowsNotFoundException()
    {
        // Arrange
        var deletedReport = CreateTestReport();
        deletedReport.DeletedAt = DateTime.UtcNow.AddDays(-1);
        SetupGeneratedReportsDbSet(new List<GeneratedReport> { deletedReport });

        var command = new DeleteGeneratedReportCommand(deletedReport.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_EnforcesTenantIsolation()
    {
        // Arrange - report from different account should not be visible
        var otherAccountReport = CreateTestReport();
        otherAccountReport.AccountId = Guid.NewGuid(); // Different account

        // Simulating query filter - report not visible to current user
        SetupGeneratedReportsDbSet(new List<GeneratedReport>());

        var command = new DeleteGeneratedReportCommand(otherAccountReport.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_BatchReport_DeletesCorrectly()
    {
        // Arrange
        var batchReport = CreateTestReport();
        batchReport.PropertyId = null;
        batchReport.PropertyName = "All Properties (3)";
        batchReport.ReportType = ReportType.Batch;
        batchReport.FileName = "Schedule-E-Reports-2024.zip";
        batchReport.StorageKey = $"reports/{_testAccountId}/2024/batch.zip";

        SetupGeneratedReportsDbSet(new List<GeneratedReport> { batchReport });
        _storageServiceMock
            .Setup(x => x.DeleteReportAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var command = new DeleteGeneratedReportCommand(batchReport.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        batchReport.DeletedAt.Should().NotBeNull();
        _storageServiceMock.Verify(x => x.DeleteReportAsync(
            batchReport.StorageKey,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private GeneratedReport CreateTestReport()
    {
        return new GeneratedReport
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = Guid.NewGuid(),
            PropertyName = "Test Property",
            Year = 2024,
            FileName = "Schedule-E-Test-Property-2024.pdf",
            StorageKey = $"reports/{_testAccountId}/2024/{Guid.NewGuid()}.pdf",
            FileSizeBytes = 1024,
            ReportType = ReportType.SingleProperty,
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
