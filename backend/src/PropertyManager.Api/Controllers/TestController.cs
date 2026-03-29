using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Test-only endpoints for E2E test data management.
/// Only available in Development environment.
/// </summary>
[ApiController]
[Route("api/v1/test")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class TestController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<TestController> _logger;

    public TestController(
        AppDbContext dbContext,
        ICurrentUser currentUser,
        IWebHostEnvironment env,
        ILogger<TestController> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _env = env;
        _logger = logger;
    }

    /// <summary>
    /// Resets all test data for the authenticated user's account.
    /// Only available in Development environment.
    /// </summary>
    [HttpPost("reset")]
    [ProducesResponseType(typeof(TestResetResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reset(CancellationToken cancellationToken)
    {
        if (!_env.IsDevelopment())
        {
            return NotFound();
        }

        var accountId = _currentUser.AccountId;
        _logger.LogInformation("Resetting test data for account {AccountId}", accountId);

        var response = new TestResetResponse();

        // Delete in FK-safe order (leaf entities first)

        // 1. WorkOrderTagAssignments (no AccountId — join through WorkOrders)
        response.WorkOrderTagAssignments = await _dbContext.WorkOrderTagAssignments
            .Where(wota => _dbContext.WorkOrders
                .IgnoreQueryFilters()
                .Where(wo => wo.AccountId == accountId)
                .Select(wo => wo.Id)
                .Contains(wota.WorkOrderId))
            .ExecuteDeleteAsync(cancellationToken);

        // 2. WorkOrderPhotos (has AccountId)
        response.WorkOrderPhotos = await _dbContext.WorkOrderPhotos
            .IgnoreQueryFilters()
            .Where(p => p.AccountId == accountId)
            .ExecuteDeleteAsync(cancellationToken);

        // 3. Notes (has AccountId)
        response.Notes = await _dbContext.Notes
            .IgnoreQueryFilters()
            .Where(n => n.AccountId == accountId)
            .ExecuteDeleteAsync(cancellationToken);

        // 4. Expenses (has AccountId)
        response.Expenses = await _dbContext.Expenses
            .IgnoreQueryFilters()
            .Where(e => e.AccountId == accountId)
            .ExecuteDeleteAsync(cancellationToken);

        // 5. Income (has AccountId)
        response.Income = await _dbContext.Income
            .IgnoreQueryFilters()
            .Where(i => i.AccountId == accountId)
            .ExecuteDeleteAsync(cancellationToken);

        // 6. WorkOrders (has AccountId)
        response.WorkOrders = await _dbContext.WorkOrders
            .IgnoreQueryFilters()
            .Where(wo => wo.AccountId == accountId)
            .ExecuteDeleteAsync(cancellationToken);

        // 7. VendorTradeTagAssignments (no AccountId — join through Persons)
        response.VendorTradeTagAssignments = await _dbContext.VendorTradeTagAssignments
            .Where(vta => _dbContext.Persons
                .IgnoreQueryFilters()
                .Where(p => p.AccountId == accountId)
                .Select(p => p.Id)
                .Contains(vta.VendorId))
            .ExecuteDeleteAsync(cancellationToken);

        // 8-9. Vendors + Persons (TPT: ExecuteDeleteAsync doesn't support TPT, so use raw SQL)
        // Deleting from Vendors first (child table), then Persons (parent table)
        response.Vendors = await _dbContext.Database.ExecuteSqlAsync(
            $"DELETE FROM \"Vendors\" WHERE \"Id\" IN (SELECT \"Id\" FROM \"Persons\" WHERE \"AccountId\" = {accountId})",
            cancellationToken);

        response.Persons = await _dbContext.Database.ExecuteSqlAsync(
            $"DELETE FROM \"Persons\" WHERE \"AccountId\" = {accountId}",
            cancellationToken);

        // 10. PropertyPhotos (has AccountId)
        response.PropertyPhotos = await _dbContext.PropertyPhotos
            .IgnoreQueryFilters()
            .Where(pp => pp.AccountId == accountId)
            .ExecuteDeleteAsync(cancellationToken);

        // 11. Receipts (has AccountId)
        response.Receipts = await _dbContext.Receipts
            .IgnoreQueryFilters()
            .Where(r => r.AccountId == accountId)
            .ExecuteDeleteAsync(cancellationToken);

        // 12. GeneratedReports (has AccountId)
        response.GeneratedReports = await _dbContext.GeneratedReports
            .IgnoreQueryFilters()
            .Where(gr => gr.AccountId == accountId)
            .ExecuteDeleteAsync(cancellationToken);

        // 13. Properties (has AccountId)
        response.Properties = await _dbContext.Properties
            .IgnoreQueryFilters()
            .Where(p => p.AccountId == accountId)
            .ExecuteDeleteAsync(cancellationToken);

        // 14. RefreshTokens (has AccountId)
        response.RefreshTokens = await _dbContext.RefreshTokens
            .IgnoreQueryFilters()
            .Where(rt => rt.AccountId == accountId)
            .ExecuteDeleteAsync(cancellationToken);

        _logger.LogInformation(
            "Test data reset complete for account {AccountId}: {TotalDeleted} entities deleted",
            accountId,
            response.TotalDeleted);

        return Ok(response);
    }
}

/// <summary>
/// Response model for test data reset, showing counts of deleted entities.
/// </summary>
public record TestResetResponse
{
    public int WorkOrderTagAssignments { get; set; }
    public int WorkOrderPhotos { get; set; }
    public int Notes { get; set; }
    public int Expenses { get; set; }
    public int Income { get; set; }
    public int WorkOrders { get; set; }
    public int VendorTradeTagAssignments { get; set; }
    public int Vendors { get; set; }
    public int Persons { get; set; }
    public int PropertyPhotos { get; set; }
    public int Receipts { get; set; }
    public int GeneratedReports { get; set; }
    public int Properties { get; set; }
    public int RefreshTokens { get; set; }
    public int TotalDeleted => WorkOrderTagAssignments + WorkOrderPhotos + Notes +
        Expenses + Income + WorkOrders + VendorTradeTagAssignments + Vendors +
        Persons + PropertyPhotos + Receipts + GeneratedReports + Properties + RefreshTokens;
}
