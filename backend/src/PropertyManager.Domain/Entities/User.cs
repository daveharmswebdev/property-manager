using PropertyManager.Domain.Common;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// User entity linked to an Account for multi-tenancy.
/// </summary>
public class User : AuditableEntity, ITenantEntity
{
    public Guid AccountId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "Owner"; // Owner | Contributor
    public bool EmailVerified { get; set; }

    // Navigation properties
    public Account Account { get; set; } = null!;
    public ICollection<Expense> CreatedExpenses { get; set; } = new List<Expense>();
    public ICollection<Income> CreatedIncome { get; set; } = new List<Income>();
    public ICollection<Receipt> CreatedReceipts { get; set; } = new List<Receipt>();
}
