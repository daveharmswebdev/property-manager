using FluentValidation;
using PropertyManager.Domain.Enums;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Validator for GetAllWorkOrdersQuery.
/// Validates optional status filter against valid WorkOrderStatus values.
/// </summary>
public class GetAllWorkOrdersValidator : AbstractValidator<GetAllWorkOrdersQuery>
{
    private static readonly string[] ValidStatuses = Enum.GetNames<WorkOrderStatus>();

    public GetAllWorkOrdersValidator()
    {
        RuleFor(x => x.Status)
            .Must(BeValidStatusOrNull)
            .WithMessage($"Status must be one of: {string.Join(", ", ValidStatuses)}")
            .When(x => !string.IsNullOrWhiteSpace(x.Status));
    }

    private static bool BeValidStatusOrNull(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return true;

        // TryParse accepts numeric strings (e.g., "123") even for invalid enum values,
        // so we also verify the parsed value is actually defined in the enum
        return Enum.TryParse<WorkOrderStatus>(status, ignoreCase: true, out var parsedStatus)
               && Enum.IsDefined(parsedStatus);
    }
}
