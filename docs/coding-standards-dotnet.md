# .NET Coding Standards - Property Manager

This document defines coding standards specific to the Property Manager .NET backend. These patterns are enforced by code review and should be followed by all developers (human and AI).

## Exception Handling

### Global Exception Handler

The API uses `GlobalExceptionHandlerMiddleware` registered as the **first middleware** in the pipeline. This provides centralized exception handling for all requests.

**DO NOT** add try-catch blocks in controllers for standard domain exceptions.

#### Exception Mapping Reference

| Exception Type | HTTP Status | When to Throw |
|----------------|-------------|---------------|
| `NotFoundException` | 404 | Entity not found in database |
| `ValidationException` (FluentValidation) | 400 | Business rule validation failure |
| `ArgumentException` | 400 | Invalid argument passed to method |
| `UnauthorizedAccessException` | 403 | User lacks permission for operation |
| Unhandled exceptions | 500 | Unexpected errors |

### Controller Exception Handling Rules

#### DO: Let middleware handle domain exceptions

```csharp
// CORRECT - Simple, clean controller
public async Task<IActionResult> GetExpense(Guid id)
{
    var expense = await _mediator.Send(new GetExpenseQuery(id));
    return Ok(expense);
    // NotFoundException automatically becomes 404 ProblemDetails
}
```

#### DON'T: Add redundant try-catch blocks

```csharp
// WRONG - Redundant exception handling
public async Task<IActionResult> GetExpense(Guid id)
{
    try
    {
        var expense = await _mediator.Send(new GetExpenseQuery(id));
        return Ok(expense);
    }
    catch (NotFoundException ex)  // DON'T DO THIS
    {
        return NotFound(new ProblemDetails { ... });
    }
}
```

#### EXCEPTION: Custom exception handling

Use try-catch **only** when you need behavior different from the default:

```csharp
// ALLOWED - Custom behavior (returning default instead of 404)
public async Task<IActionResult> GetExpenseOrDefault(Guid id)
{
    try
    {
        return Ok(await _mediator.Send(new GetExpenseQuery(id)));
    }
    catch (NotFoundException)
    {
        return Ok(new ExpenseDto { Amount = 0 }); // Custom fallback
    }
}
```

### Handler Exception Rules

MediatR handlers should throw domain exceptions when appropriate:

```csharp
public class GetExpenseHandler : IRequestHandler<GetExpenseQuery, ExpenseDto>
{
    public async Task<ExpenseDto> Handle(GetExpenseQuery request, CancellationToken ct)
    {
        var expense = await _dbContext.Expenses.FindAsync(request.Id, ct);

        if (expense == null)
            throw new NotFoundException($"Expense '{request.Id}' was not found");

        return _mapper.Map<ExpenseDto>(expense);
    }
}
```

### Validation Pattern

FluentValidation is used for request validation. Validators are called **explicitly** in controllers:

```csharp
public async Task<IActionResult> CreateExpense([FromBody] CreateExpenseRequest request)
{
    var command = new CreateExpenseCommand(...);

    // Explicit validation before MediatR
    var validationResult = await _validator.ValidateAsync(command);
    if (!validationResult.IsValid)
    {
        return BadRequest(CreateValidationProblemDetails(validationResult));
    }

    var id = await _mediator.Send(command);
    return CreatedAtAction(...);
}
```

## Code Review Checklist - Exception Handling

When reviewing .NET code, verify:

- [ ] Controllers do NOT have try-catch for `NotFoundException`, `ValidationException`, `ArgumentException`
- [ ] Try-catch is used ONLY for custom exception handling behavior
- [ ] MediatR handlers throw appropriate domain exceptions
- [ ] New exception types are added to `GlobalExceptionHandlerMiddleware` if needed
- [ ] FluentValidation is used for request validation (not manual if/throw)
- [ ] ProblemDetails responses include traceId for correlation

## Adding New Exception Types

If you need a new domain exception:

1. Create the exception class in `PropertyManager.Domain.Exceptions/`
2. Add mapping in `GlobalExceptionHandlerMiddleware.GetStatusCodeAndType()`
3. Update this document's exception mapping table
4. Add unit test for the new exception type

Example:

```csharp
// Domain/Exceptions/ConflictException.cs
public class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
}

// Add to middleware GetStatusCodeAndType()
ConflictException => (409, "https://propertymanager.app/errors/conflict", "Resource conflict"),
```

## References

- [RFC 7807 - Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- [ASP.NET Core Error Handling](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling)
- [docs/architecture.md](./architecture.md) - Full architecture documentation
