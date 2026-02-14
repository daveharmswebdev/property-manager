using System.Net;
using FluentAssertions;

namespace PropertyManager.Api.Tests;

public class CorsIntegrationTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;

    public CorsIntegrationTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Request_FromAllowedOrigin_ReturnsAccessControlAllowOriginHeader()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health");
        request.Headers.Add("Origin", "http://localhost:4200");

        // Act
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.GetValues("Access-Control-Allow-Origin")
            .Should().Contain("http://localhost:4200");
    }

    [Fact]
    public async Task Request_FromAllowedOrigin_ReturnsAccessControlAllowCredentialsHeader()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health");
        request.Headers.Add("Origin", "http://localhost:4200");

        // Act
        var response = await client.SendAsync(request);

        // Assert
        response.Headers.GetValues("Access-Control-Allow-Credentials")
            .Should().Contain("true");
    }

    [Fact]
    public async Task Preflight_FromAllowedOrigin_ReturnsAllowedMethodsAndHeaders()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/health");
        request.Headers.Add("Origin", "http://localhost:4200");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "Authorization, Content-Type");

        // Act
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var allowMethods = response.Headers.GetValues("Access-Control-Allow-Methods").First();
        allowMethods.Should().Contain("GET");
        allowMethods.Should().Contain("POST");
        allowMethods.Should().Contain("PUT");
        allowMethods.Should().Contain("DELETE");
        allowMethods.Should().Contain("OPTIONS");

        var allowHeaders = response.Headers.GetValues("Access-Control-Allow-Headers").First();
        allowHeaders.Should().Contain("Authorization");
        allowHeaders.Should().Contain("Content-Type");
    }

    [Fact]
    public async Task Request_FromDisallowedOrigin_DoesNotReturnCorsHeaders()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health");
        request.Headers.Add("Origin", "https://evil-site.com");

        // Act
        var response = await client.SendAsync(request);

        // Assert — server still processes the request (CORS is browser-enforced), but no CORS headers
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.Contains("Access-Control-Allow-Origin").Should().BeFalse();
    }

    [Fact]
    public async Task Preflight_FromDisallowedOrigin_DoesNotReturnCorsHeaders()
    {
        // Arrange — AC #2: preflight OPTIONS from disallowed origin
        var client = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/health");
        request.Headers.Add("Origin", "https://evil-site.com");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "Authorization, Content-Type");

        // Act
        var response = await client.SendAsync(request);

        // Assert — no CORS headers means browser will block the cross-origin request
        response.Headers.Contains("Access-Control-Allow-Origin").Should().BeFalse();
        response.Headers.Contains("Access-Control-Allow-Methods").Should().BeFalse();
    }

    [Fact]
    public async Task Request_WithNoOriginHeader_SucceedsNormally()
    {
        // Arrange - no Origin header (same-origin or server-to-server)
        var client = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health");

        // Act
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
