using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.Expenses;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Expense management endpoints for CRUD operations.
/// </summary>
[ApiController]
[Route("api/v1")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class ExpensesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<CreateExpenseCommand> _createValidator;
    private readonly ILogger<ExpensesController> _logger;

    public ExpensesController(
        IMediator mediator,
        IValidator<CreateExpenseCommand> createValidator,
        ILogger<ExpensesController> logger)
    {
        _mediator = mediator;
        _createValidator = createValidator;
        _logger = logger;
    }

    /// <summary>
    /// Create a new expense (AC-3.1.1, AC-3.1.6).
    /// </summary>
    /// <param name="request">Expense details</param>
    /// <returns>The newly created expense's ID</returns>
    /// <response code="201">Returns the newly created expense ID</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property or category not found</response>
    [HttpPost("expenses")]
    [ProducesResponseType(typeof(CreateExpenseResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateExpense([FromBody] CreateExpenseRequest request)
    {
        var command = new CreateExpenseCommand(
            request.PropertyId,
            request.Amount,
            request.Date,
            request.CategoryId,
            request.Description);

        // Validate command
        var validationResult = await _createValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        try
        {
            var expenseId = await _mediator.Send(command);

            _logger.LogInformation(
                "Expense created: {ExpenseId} for property {PropertyId}, amount {Amount} at {Timestamp}",
                expenseId,
                request.PropertyId,
                request.Amount,
                DateTime.UtcNow);

            var response = new CreateExpenseResponse(expenseId);

            return CreatedAtAction(
                nameof(CreateExpense),
                new { id = expenseId },
                response);
        }
        catch (NotFoundException ex)
        {
            _logger.LogWarning(
                "Resource not found when creating expense: {Message} at {Timestamp}",
                ex.Message,
                DateTime.UtcNow);

            return NotFound(new ProblemDetails
            {
                Type = "https://propertymanager.app/errors/not-found",
                Title = "Resource not found",
                Status = StatusCodes.Status404NotFound,
                Detail = ex.Message,
                Instance = HttpContext.Request.Path,
                Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
            });
        }
    }

    /// <summary>
    /// Get all expense categories (AC-3.1.4).
    /// </summary>
    /// <returns>List of expense categories (15 IRS Schedule E categories)</returns>
    /// <response code="200">Returns the list of expense categories</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpGet("expense-categories")]
    [ProducesResponseType(typeof(ExpenseCategoriesResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetExpenseCategories()
    {
        var query = new GetExpenseCategoriesQuery();
        var categories = await _mediator.Send(query);

        _logger.LogInformation(
            "Retrieved {Count} expense categories at {Timestamp}",
            categories.Count,
            DateTime.UtcNow);

        return Ok(new ExpenseCategoriesResponse(categories, categories.Count));
    }

    /// <summary>
    /// Get expenses for a property (AC-3.1.7).
    /// </summary>
    /// <param name="id">Property GUID</param>
    /// <param name="year">Optional tax year filter</param>
    /// <returns>List of expenses with YTD total</returns>
    /// <response code="200">Returns the list of expenses</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property not found</response>
    [HttpGet("properties/{id:guid}/expenses")]
    [ProducesResponseType(typeof(ExpenseListDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetExpensesByProperty(Guid id, [FromQuery] int? year = null)
    {
        try
        {
            var query = new GetExpensesByPropertyQuery(id, year);
            var response = await _mediator.Send(query);

            _logger.LogInformation(
                "Retrieved {Count} expenses for property {PropertyId}, year {Year} at {Timestamp}",
                response.TotalCount,
                id,
                year?.ToString() ?? "all",
                DateTime.UtcNow);

            return Ok(response);
        }
        catch (NotFoundException)
        {
            _logger.LogWarning(
                "Property not found: {PropertyId} at {Timestamp}",
                id,
                DateTime.UtcNow);

            return NotFound(new ProblemDetails
            {
                Type = "https://propertymanager.app/errors/not-found",
                Title = "Resource not found",
                Status = StatusCodes.Status404NotFound,
                Detail = $"Property '{id}' does not exist",
                Instance = HttpContext.Request.Path,
                Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
            });
        }
    }

    private ValidationProblemDetails CreateValidationProblemDetails(FluentValidation.Results.ValidationResult validationResult)
    {
        var errors = validationResult.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.ErrorMessage).ToArray());

        return new ValidationProblemDetails(errors)
        {
            Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
            Title = "One or more validation errors occurred.",
            Status = StatusCodes.Status400BadRequest,
            Instance = HttpContext.Request.Path,
            Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
        };
    }
}

/// <summary>
/// Request model for creating an expense.
/// </summary>
public record CreateExpenseRequest(
    Guid PropertyId,
    decimal Amount,
    DateOnly Date,
    Guid CategoryId,
    string? Description
);

/// <summary>
/// Response model for successful expense creation.
/// </summary>
public record CreateExpenseResponse(
    Guid Id
);

/// <summary>
/// Response model for expense categories list.
/// </summary>
public record ExpenseCategoriesResponse(
    List<ExpenseCategoryDto> Items,
    int TotalCount
);
