namespace PropertyManager.Api.Middleware;

public class SecurityHeadersMiddleware
{
    private const string XFrameOptions = "DENY";
    private const string XContentTypeOptions = "nosniff";
    private const string ReferrerPolicy = "strict-origin-when-cross-origin";
    private const string PermissionsPolicy = "camera=(), microphone=(), geolocation=(), payment=()";
    private const string ContentSecurityPolicy =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; " +
        "connect-src 'self' https://*.ingest.sentry.io; frame-ancestors 'none'; " +
        "object-src 'none'; base-uri 'self'; form-action 'self'";

    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers["X-Frame-Options"] = XFrameOptions;
        context.Response.Headers["X-Content-Type-Options"] = XContentTypeOptions;
        context.Response.Headers["Referrer-Policy"] = ReferrerPolicy;
        context.Response.Headers["Permissions-Policy"] = PermissionsPolicy;
        context.Response.Headers["Content-Security-Policy"] = ContentSecurityPolicy;

        await _next(context);
    }
}

public static class SecurityHeadersMiddlewareExtensions
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    {
        return app.UseMiddleware<SecurityHeadersMiddleware>();
    }
}
