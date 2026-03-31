namespace PropertyManager.Domain.Exceptions;

/// <summary>
/// Exception thrown when a user lacks permission to perform an operation.
/// Mapped to 403 Forbidden by GlobalExceptionHandlerMiddleware.
/// </summary>
public class ForbiddenAccessException : Exception
{
    public ForbiddenAccessException() : base() { }

    public ForbiddenAccessException(string message) : base(message) { }

    public ForbiddenAccessException(string message, Exception innerException) : base(message, innerException) { }
}
