using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

// --- DTOs ---

/// <summary>
/// Top-level DTO for the work order PDF report.
/// </summary>
public record WorkOrderPdfReportDto(
    Guid WorkOrderId,
    string ShortId,
    string Status,
    DateTime GeneratedDate,
    string PropertyName,
    string PropertyAddress,
    string Description,
    string? CategoryName,
    string Tags,
    DateTime CreatedDate,
    string CreatedByName,
    WorkOrderPdfVendorDto? Vendor,
    bool IsDiy,
    IReadOnlyList<WorkOrderPdfNoteDto> Notes,
    IReadOnlyList<WorkOrderPdfExpenseDto> Expenses,
    int PhotoCount
);

/// <summary>
/// Vendor contact information for the PDF.
/// </summary>
public record WorkOrderPdfVendorDto(
    string Name,
    string? Phone,
    string? Email,
    string TradeTags
);

/// <summary>
/// Note entry for the PDF.
/// </summary>
public record WorkOrderPdfNoteDto(
    string Content,
    string AuthorName,
    DateTime Timestamp
);

/// <summary>
/// Expense entry for the PDF.
/// </summary>
public record WorkOrderPdfExpenseDto(
    DateOnly Date,
    string? Description,
    string CategoryName,
    decimal Amount
);

/// <summary>
/// Result returned by the handler containing PDF bytes and filename.
/// </summary>
public record WorkOrderPdfResult(
    byte[] PdfBytes,
    string FileName
);

// --- Query ---

/// <summary>
/// Query to generate a work order PDF (AC #1).
/// </summary>
public record GenerateWorkOrderPdfQuery(Guid WorkOrderId) : IRequest<WorkOrderPdfResult>;

// --- Validator ---

/// <summary>
/// Validator for GenerateWorkOrderPdfQuery (Task 3.7).
/// </summary>
public class GenerateWorkOrderPdfQueryValidator : AbstractValidator<GenerateWorkOrderPdfQuery>
{
    public GenerateWorkOrderPdfQueryValidator()
    {
        RuleFor(x => x.WorkOrderId)
            .NotEmpty().WithMessage("WorkOrderId must not be empty.");
    }
}

// --- Handler ---

/// <summary>
/// Handler for GenerateWorkOrderPdfQuery (AC #1, #2, #3, #4).
/// Loads work order with all related data and generates a PDF.
/// </summary>
public class GenerateWorkOrderPdfQueryHandler : IRequestHandler<GenerateWorkOrderPdfQuery, WorkOrderPdfResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly IIdentityService _identityService;
    private readonly IWorkOrderPdfGenerator _pdfGenerator;

    public GenerateWorkOrderPdfQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        IIdentityService identityService,
        IWorkOrderPdfGenerator pdfGenerator)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _identityService = identityService;
        _pdfGenerator = pdfGenerator;
    }

    public async Task<WorkOrderPdfResult> Handle(GenerateWorkOrderPdfQuery request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        // Load work order with all related data (Task 3.2)
        var workOrder = await _dbContext.WorkOrders
            .AsNoTracking()
            .Include(w => w.Property)
            .Include(w => w.Vendor)
                .ThenInclude(v => v!.TradeTagAssignments)
                    .ThenInclude(a => a.TradeTag)
            .Include(w => w.Category)
            .Include(w => w.TagAssignments)
                .ThenInclude(a => a.Tag)
            .Include(w => w.Photos)
            .Where(w => w.Id == request.WorkOrderId && w.AccountId == _currentUser.AccountId)
            .FirstOrDefaultAsync(cancellationToken);

        if (workOrder == null)
        {
            throw new NotFoundException(nameof(Domain.Entities.WorkOrder), request.WorkOrderId);
        }

        // Load notes separately (polymorphic table) (Task 3.3)
        var notes = await _dbContext.Notes
            .AsNoTracking()
            .Where(n => n.EntityType == "WorkOrder" && n.EntityId == request.WorkOrderId)
            .OrderBy(n => n.CreatedAt)
            .ToListAsync(cancellationToken);

        // Load linked expenses separately (Task 3.4)
        var expenses = await _dbContext.Expenses
            .AsNoTracking()
            .Where(e => e.WorkOrderId == request.WorkOrderId)
            .Include(e => e.Category)
            .OrderByDescending(e => e.Date)
            .ToListAsync(cancellationToken);

        // Resolve user display names (Task 3.5)
        var userIds = notes.Select(n => n.CreatedByUserId)
            .Append(workOrder.CreatedByUserId)
            .Distinct();
        var userNames = await _identityService.GetUserDisplayNamesAsync(userIds, cancellationToken);

        string ResolveName(Guid userId) =>
            userNames.TryGetValue(userId, out var name) ? name : "Unknown";

        // Map to DTO (Task 3.6)
        var vendorDto = workOrder.Vendor != null
            ? new WorkOrderPdfVendorDto(
                workOrder.Vendor.FullName,
                workOrder.Vendor.Phones.FirstOrDefault()?.Number,
                workOrder.Vendor.Emails.FirstOrDefault(),
                string.Join(", ", workOrder.Vendor.TradeTagAssignments.Select(a => a.TradeTag.Name)))
            : null;

        var noteDtos = notes.Select(n => new WorkOrderPdfNoteDto(
            n.Content,
            ResolveName(n.CreatedByUserId),
            n.CreatedAt
        )).ToList();

        var expenseDtos = expenses.Select(e => new WorkOrderPdfExpenseDto(
            e.Date,
            e.Description,
            e.Category.Name,
            e.Amount
        )).ToList();

        var tags = string.Join(", ", workOrder.TagAssignments.Select(a => a.Tag.Name));
        var address = $"{workOrder.Property.Street}, {workOrder.Property.City}, {workOrder.Property.State} {workOrder.Property.ZipCode}";
        var shortId = workOrder.Id.ToString("N")[..8];

        var reportDto = new WorkOrderPdfReportDto(
            WorkOrderId: workOrder.Id,
            ShortId: shortId,
            Status: workOrder.Status.ToString(),
            GeneratedDate: now,
            PropertyName: workOrder.Property.Name,
            PropertyAddress: address,
            Description: workOrder.Description,
            CategoryName: workOrder.Category?.Name,
            Tags: tags,
            CreatedDate: workOrder.CreatedAt,
            CreatedByName: ResolveName(workOrder.CreatedByUserId),
            Vendor: vendorDto,
            IsDiy: workOrder.IsDiy,
            Notes: noteDtos,
            Expenses: expenseDtos,
            PhotoCount: workOrder.Photos.Count
        );

        var pdfBytes = _pdfGenerator.Generate(reportDto);

        // Build filename (Dev Notes: File Naming Convention)
        var sanitizedPropertyName = new string(workOrder.Property.Name
            .Where(c => char.IsLetterOrDigit(c) || c == ' ')
            .ToArray())
            .Replace(' ', '-');

        var fileName = $"WorkOrder-{sanitizedPropertyName}-{now:yyyy-MM-dd}-{shortId}.pdf";

        return new WorkOrderPdfResult(pdfBytes, fileName);
    }
}
