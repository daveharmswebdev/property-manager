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

    /// <summary>
    /// Sends a password reset email with the provided token (AC6.6).
    /// Link format: {frontend_url}/reset-password?token={token}
    /// </summary>
    Task SendPasswordResetEmailAsync(
        string email,
        string token,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends an invitation email with the provided code (AC: TD.6.5).
    /// Link format: {frontend_url}/accept-invitation?code={code}
    /// </summary>
    Task SendInvitationEmailAsync(
        string email,
        string code,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a tenant invitation email that includes the property address (AC: 20.2 #4).
    /// Link format: {frontend_url}/accept-invitation?code={code}
    /// </summary>
    Task SendTenantInvitationEmailAsync(
        string email,
        string code,
        string propertyAddress,
        CancellationToken cancellationToken = default);
}
