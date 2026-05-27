using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;
using PropertyManager.Infrastructure.Identity;

namespace PropertyManager.Infrastructure.Tests.Identity;

/// <summary>
/// Unit tests for <see cref="CurrentUserService"/>.
/// Story 22.1 — covers PlatformAdmin claim extraction from the JWT-derived ClaimsPrincipal (AC #4).
/// </summary>
public class CurrentUserServiceTests
{
    private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock;

    public CurrentUserServiceTests()
    {
        _httpContextAccessorMock = new Mock<IHttpContextAccessor>();
    }

    private CurrentUserService CreateService(params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, authenticationType: "Test");
        var principal = new ClaimsPrincipal(identity);
        var httpContext = new DefaultHttpContext { User = principal };
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(httpContext);
        return new CurrentUserService(_httpContextAccessorMock.Object);
    }

    [Fact]
    public void IsPlatformAdmin_WhenClaimValueIsTrue_ReturnsTrue()
    {
        var service = CreateService(new Claim("platformAdmin", "true"));

        service.IsPlatformAdmin.Should().BeTrue();
    }

    [Fact]
    public void IsPlatformAdmin_WhenClaimMissing_ReturnsFalse()
    {
        var service = CreateService(new Claim("role", "Owner"));

        service.IsPlatformAdmin.Should().BeFalse();
    }

    [Fact]
    public void IsPlatformAdmin_WhenClaimValueIsFalse_ReturnsFalse()
    {
        // Defensive — the JWT issuer omits the claim when false, but if a token were
        // hand-crafted with "false" we must NOT treat it as admin.
        var service = CreateService(new Claim("platformAdmin", "false"));

        service.IsPlatformAdmin.Should().BeFalse();
    }

    [Fact]
    public void IsPlatformAdmin_WhenClaimValueIsArbitraryString_ReturnsFalse()
    {
        // Anything other than the literal lowercase "true" must return false.
        var service = CreateService(new Claim("platformAdmin", "True"));

        service.IsPlatformAdmin.Should().BeFalse();
    }

    [Fact]
    public void IsPlatformAdmin_WhenHttpContextIsNull_ReturnsFalse()
    {
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns((HttpContext?)null);
        var service = new CurrentUserService(_httpContextAccessorMock.Object);

        service.IsPlatformAdmin.Should().BeFalse();
    }
}
