using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Story 22.1 stub — proves the "CanInviteLandlords" policy works end-to-end before
/// Story 22.2 lands the real landlord-invitations controller.
/// </summary>
/// <remarks>
/// Hidden from Swagger via <see cref="ApiExplorerSettingsAttribute"/>. The stub action
/// MUST be removed (or its <c>[Authorize(Policy = "CanInviteLandlords")]</c> migrated
/// to the production endpoint) by Story 22.2.
/// </remarks>
[ApiController]
[Route("api/v1/test")]
[ApiExplorerSettings(IgnoreApi = true)]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class PlatformAdminStubController : ControllerBase
{
    [HttpGet("platform-admin-only")]
    [Authorize(Policy = "CanInviteLandlords")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public IActionResult PlatformAdminOnly() => Ok(new { ok = true });
}
