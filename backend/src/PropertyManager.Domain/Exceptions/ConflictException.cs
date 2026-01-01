namespace PropertyManager.Domain.Exceptions;

/// <summary>
/// Exception thrown when an operation cannot be completed due to a conflict
/// with the current state of a resource (e.g., trying to process an already processed receipt).
/// </summary>
public class ConflictException : Exception
{
    public ConflictException()
        : base()
    {
    }

    public ConflictException(string message)
        : base(message)
    {
    }

    public ConflictException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public ConflictException(string name, object key, string reason)
        : base($"{name} with ID '{key}' {reason}.")
    {
    }
}
