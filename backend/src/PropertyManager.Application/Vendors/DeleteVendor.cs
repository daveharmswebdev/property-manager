using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Vendors;

/// <summary>
/// Command for soft-deleting a vendor (FR12).
/// Sets DeletedAt timestamp on vendor record. Work orders assigned to this vendor
/// will show 'Deleted Vendor' in the UI.
/// </summary>
public record DeleteVendorCommand(Guid Id) : IRequest;

/// <summary>
/// Handler for DeleteVendorCommand.
/// Soft-deletes the vendor while preserving the FK relationship with work orders (FR12).
/// </summary>
public class DeleteVendorCommandHandler : IRequestHandler<DeleteVendorCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<DeleteVendorCommandHandler> _logger;

    public DeleteVendorCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        ILogger<DeleteVendorCommandHandler> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task Handle(DeleteVendorCommand request, CancellationToken cancellationToken)
    {
        // Find vendor with tenant isolation and soft-delete check
        var vendor = await _dbContext.Vendors
            .Where(v => v.Id == request.Id && v.AccountId == _currentUser.AccountId && v.DeletedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (vendor == null)
        {
            _logger.LogWarning(
                "Vendor not found for deletion: {VendorId}, AccountId: {AccountId}",
                request.Id,
                _currentUser.AccountId);
            throw new NotFoundException("Vendor", request.Id);
        }

        // Soft delete - set DeletedAt timestamp (FR12)
        // IMPORTANT: Do NOT set VendorId to NULL on work orders
        // They must show 'Deleted Vendor' for historical context
        vendor.DeletedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Vendor deleted: {VendorId}, AccountId: {AccountId}, UserId: {UserId}",
            request.Id,
            _currentUser.AccountId,
            _currentUser.UserId);
    }
}

/// <summary>
/// Validator for DeleteVendorCommand.
/// </summary>
public class DeleteVendorCommandValidator : AbstractValidator<DeleteVendorCommand>
{
    public DeleteVendorCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("Vendor ID is required");
    }
}
