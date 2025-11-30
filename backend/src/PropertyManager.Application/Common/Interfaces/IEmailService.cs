namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Interface for email operations.
/// Implementation in Infrastructure layer.
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Sends a verification email with the provided token.
    /// </summary>
    Task SendVerificationEmailAsync(
        string email,
        string token,
        CancellationToken cancellationToken = default);
}
