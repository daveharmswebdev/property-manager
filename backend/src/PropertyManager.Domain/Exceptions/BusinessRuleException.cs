namespace PropertyManager.Domain.Exceptions;

/// <summary>
/// Exception thrown when a domain business rule is violated.
/// Mapped to 400 Bad Request by the global exception handler middleware.
/// </summary>
public class BusinessRuleException : Exception
{
    public BusinessRuleException()
        : base()
    {
    }

    public BusinessRuleException(string message)
        : base(message)
    {
    }

    public BusinessRuleException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
