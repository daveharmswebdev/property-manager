namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Interface for identity operations (user creation, email verification, etc.).
/// Implementation in Infrastructure layer using ASP.NET Core Identity.
/// </summary>
public interface IIdentityService
{
    /// <summary>
    /// Creates a new user with the given credentials and links to account.
    /// </summary>
    /// <returns>Tuple of (UserId, PasswordErrors). UserId is null if creation failed.</returns>
    Task<(Guid? UserId, IEnumerable<string> Errors)> CreateUserAsync(
        string email,
        string password,
        Guid accountId,
        string role,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if a user with the given email already exists.
    /// </summary>
    Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates an email verification token for the user.
    /// </summary>
    Task<string> GenerateEmailVerificationTokenAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifies the email using the provided token.
    /// </summary>
    /// <returns>Tuple of (Success, ErrorMessage).</returns>
    Task<(bool Success, string? ErrorMessage)> VerifyEmailAsync(
        string token,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates user credentials for login.
    /// Checks email exists, password is correct, and email is verified.
    /// </summary>
    /// <returns>Tuple of (Success, UserId, AccountId, Role, ErrorMessage).</returns>
    Task<(bool Success, Guid? UserId, Guid? AccountId, string? Role, string? ErrorMessage)> ValidateCredentialsAsync(
        string email,
        string password,
        CancellationToken cancellationToken = default);
}
