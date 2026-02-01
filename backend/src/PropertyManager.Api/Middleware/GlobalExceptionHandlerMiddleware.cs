using System.Net;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.Common;
using PropertyManager.Domain.Exceptions;
using DomainValidationException = PropertyManager.Domain.Exceptions.ValidationException;

namespace PropertyManager.Api.Middleware;

/// <summary>
/// Global exception handler middleware that catches unhandled exceptions
/// and returns standardized RFC 7807 ProblemDetails responses.
/// </summary>
public class GlobalExceptionHandlerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandlerMiddleware> _logger;
    private readonly IHostEnvironment _environment;

    public GlobalExceptionHandlerMiddleware(
        RequestDelegate next,
        ILogger<GlobalExceptionHandlerMiddleware> logger,
        IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, type, title) = GetErrorDetails(exception);

        // Log at appropriate level (sanitize user-controlled input to prevent log forging)
        var sanitizedMessage = LogSanitizer.Sanitize(exception.Message);
        var sanitizedPath = LogSanitizer.Sanitize(context.Request.Path);

        if (statusCode >= 500)
        {
            _logger.LogError(
                exception,
                "Server error occurred: {Message} at {Path}",
                sanitizedMessage,
                sanitizedPath);
        }
        else
        {
            _logger.LogWarning(
                exception,
                "Client error occurred: {Message} at {Path}",
                sanitizedMessage,
                sanitizedPath);
        }

        // Create ProblemDetails response
        var problemDetails = new ProblemDetails
        {
            Type = type,
            Title = title,
            Status = statusCode,
            Detail = exception.Message,
            Instance = context.Request.Path
        };

        // Add traceId for correlation
        problemDetails.Extensions["traceId"] = context.TraceIdentifier;

        // Add validation errors if present
        if (exception is DomainValidationException domainValidationEx && domainValidationEx.Errors.Count > 0)
        {
            problemDetails.Extensions["errors"] = domainValidationEx.Errors;
        }
        else if (exception is FluentValidation.ValidationException fluentValidationEx)
        {
            var errors = fluentValidationEx.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
            if (errors.Count > 0)
            {
                problemDetails.Extensions["errors"] = errors;
            }
        }

        // Include stack trace only in Development mode
        if (_environment.IsDevelopment())
        {
            problemDetails.Extensions["exceptionDetails"] = exception.ToString();
        }

        // Set response details
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";

        await context.Response.WriteAsJsonAsync(problemDetails);
    }

    private static (int StatusCode, string Type, string Title) GetErrorDetails(Exception exception)
    {
        return exception switch
        {
            NotFoundException => (
                StatusCodes.Status404NotFound,
                "https://propertymanager.app/errors/not-found",
                "Resource not found"
            ),
            ConflictException => (
                StatusCodes.Status409Conflict,
                "https://propertymanager.app/errors/conflict",
                "Resource conflict"
            ),
            UnauthorizedAccessException => (
                StatusCodes.Status403Forbidden,
                "https://propertymanager.app/errors/forbidden",
                "Access forbidden"
            ),
            ArgumentException => (
                StatusCodes.Status400BadRequest,
                "https://propertymanager.app/errors/bad-request",
                "Bad request"
            ),
            DomainValidationException => (
                StatusCodes.Status400BadRequest,
                "https://tools.ietf.org/html/rfc7231#section-6.5.1",
                "Validation failed"
            ),
            FluentValidation.ValidationException => (
                StatusCodes.Status400BadRequest,
                "https://tools.ietf.org/html/rfc7231#section-6.5.1",
                "Validation failed"
            ),
            _ => (
                StatusCodes.Status500InternalServerError,
                "https://propertymanager.app/errors/internal-server-error",
                "Internal server error"
            )
        };
    }
}
