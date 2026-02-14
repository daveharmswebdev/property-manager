using FluentAssertions;
using Microsoft.AspNetCore.Http;
using PropertyManager.Api.Middleware;

namespace PropertyManager.Api.Tests.Middleware;

public class SecurityHeadersMiddlewareTests
{
    private readonly DefaultHttpContext _httpContext;
    private readonly SecurityHeadersMiddleware _middleware;
    private bool _nextCalled;

    public SecurityHeadersMiddlewareTests()
    {
        _httpContext = new DefaultHttpContext();
        _httpContext.Response.Body = new MemoryStream();
        _nextCalled = false;

        RequestDelegate next = _ =>
        {
            _nextCalled = true;
            return Task.CompletedTask;
        };

        _middleware = new SecurityHeadersMiddleware(next);
    }

    [Fact]
    public async Task InvokeAsync_AddsXFrameOptionsDeny()
    {
        await _middleware.InvokeAsync(_httpContext);

        _httpContext.Response.Headers["X-Frame-Options"].ToString().Should().Be("DENY");
    }

    [Fact]
    public async Task InvokeAsync_AddsXContentTypeOptionsNosniff()
    {
        await _middleware.InvokeAsync(_httpContext);

        _httpContext.Response.Headers["X-Content-Type-Options"].ToString().Should().Be("nosniff");
    }

    [Fact]
    public async Task InvokeAsync_AddsReferrerPolicy()
    {
        await _middleware.InvokeAsync(_httpContext);

        _httpContext.Response.Headers["Referrer-Policy"].ToString().Should().Be("strict-origin-when-cross-origin");
    }

    [Fact]
    public async Task InvokeAsync_AddsPermissionsPolicy()
    {
        await _middleware.InvokeAsync(_httpContext);

        _httpContext.Response.Headers["Permissions-Policy"].ToString()
            .Should().Be("camera=(), microphone=(), geolocation=(), payment=()");
    }

    [Fact]
    public async Task InvokeAsync_AddsContentSecurityPolicy()
    {
        await _middleware.InvokeAsync(_httpContext);

        var csp = _httpContext.Response.Headers["Content-Security-Policy"].ToString();
        csp.Should().Contain("default-src 'self'");
        csp.Should().Contain("script-src 'self'");
        csp.Should().Contain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
        csp.Should().Contain("font-src 'self' https://fonts.gstatic.com");
        csp.Should().Contain("img-src 'self' data: blob:");
        csp.Should().Contain("connect-src 'self' https://*.ingest.sentry.io");
        csp.Should().Contain("frame-ancestors 'none'");
        csp.Should().Contain("object-src 'none'");
    }

    [Fact]
    public async Task InvokeAsync_CallsNextMiddleware()
    {
        await _middleware.InvokeAsync(_httpContext);

        _nextCalled.Should().BeTrue();
    }
}
