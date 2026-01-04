using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Reports;

/// <summary>
/// Command to delete a generated report.
/// Deletes from S3 storage and soft-deletes from database.
/// </summary>
public record DeleteGeneratedReportCommand(Guid ReportId) : IRequest;

/// <summary>
/// Handler for DeleteGeneratedReportCommand.
/// </summary>
public class DeleteGeneratedReportHandler : IRequestHandler<DeleteGeneratedReportCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly IReportStorageService _storageService;
    private readonly ILogger<DeleteGeneratedReportHandler> _logger;

    public DeleteGeneratedReportHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        IReportStorageService storageService,
        ILogger<DeleteGeneratedReportHandler> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _storageService = storageService;
        _logger = logger;
    }

    public async Task Handle(DeleteGeneratedReportCommand request, CancellationToken cancellationToken)
    {
        // Find report - global query filter already applies tenant isolation
        var report = await _dbContext.GeneratedReports
            .FirstOrDefaultAsync(r => r.Id == request.ReportId, cancellationToken);

        if (report == null)
        {
            throw new NotFoundException("Report", request.ReportId);
        }

        // Delete from S3 storage (hard delete)
        try
        {
            await _storageService.DeleteReportAsync(report.StorageKey, cancellationToken);
        }
        catch (Exception ex)
        {
            // Log but continue with database deletion
            // The file may already be deleted or inaccessible
            _logger.LogWarning(ex,
                "Failed to delete report file from S3: {StorageKey}. Continuing with database deletion.",
                report.StorageKey);
        }

        // Soft delete in database
        report.DeletedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Deleted report {ReportId} ({FileName}) for account {AccountId}",
            request.ReportId,
            report.FileName,
            _currentUser.AccountId);
    }
}
