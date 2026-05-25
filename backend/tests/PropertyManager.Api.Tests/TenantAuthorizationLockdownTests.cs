using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Tenant Authorization Lockdown regression suite (Story 20.11 / NFR-TP1, NFR-TP2, NFR-TP3).
///
/// This file is the security boundary's automated proof. Every landlord endpoint family
/// returns 403 to a Tenant access token (policy denial). Cross-property maintenance-request
/// reads return 404 (handler scoping). The authorization audit log is asserted for shape
/// and absence-of-secrets.
///
/// Pattern source: <c>MaintenanceRequestsControllerTests</c> (lines 1427–1462) and
/// <c>PermissionEnforcementTests</c> for the [Theory]/[InlineData] matrix style.
///
/// IMPORTANT: do NOT consolidate this file's helpers with other test files. The duplication
/// is intentional — this file IS the security regression artifact and should be readable
/// on its own.
/// </summary>
public class TenantAuthorizationLockdownTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public TenantAuthorizationLockdownTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // Task 3: Landlord-endpoint matrix — Tenant gets 403 (AC #1–#9)
    // =====================================================
    // Each [InlineData] row is one landlord endpoint. The policy check fires BEFORE the
    // handler resolves any id, so `Guid.NewGuid()` placeholders produce 403 (policy)
    // rather than 404 (handler). This is verified by PermissionEnforcementTests too.

    public static IEnumerable<object[]> LandlordEndpoints()
    {
        // -- Properties (5) ---------------------------------------------------------------
        yield return new object[] { "GET", "/api/v1/properties" };
        yield return new object[] { "GET", $"/api/v1/properties/{Guid.NewGuid()}" };
        yield return new object[] { "POST", "/api/v1/properties" };
        yield return new object[] { "PUT", $"/api/v1/properties/{Guid.NewGuid()}" };
        yield return new object[] { "DELETE", $"/api/v1/properties/{Guid.NewGuid()}" };

        // -- Expenses (11) ----------------------------------------------------------------
        yield return new object[] { "GET", "/api/v1/expenses" };
        yield return new object[] { "GET", $"/api/v1/expenses/{Guid.NewGuid()}" };
        yield return new object[] { "POST", "/api/v1/expenses" };
        yield return new object[] { "PUT", $"/api/v1/expenses/{Guid.NewGuid()}" };
        yield return new object[] { "DELETE", $"/api/v1/expenses/{Guid.NewGuid()}" };
        yield return new object[] { "GET", "/api/v1/expenses/totals" };
        yield return new object[] { "GET", "/api/v1/expense-categories" };
        yield return new object[] { "GET", $"/api/v1/properties/{Guid.NewGuid()}/expenses" };
        yield return new object[] { "GET", "/api/v1/expenses/check-duplicate" };
        yield return new object[] { "DELETE", $"/api/v1/expenses/{Guid.NewGuid()}/receipt" };
        yield return new object[] { "POST", $"/api/v1/expenses/{Guid.NewGuid()}/link-receipt" };

        // -- Income (7) -------------------------------------------------------------------
        yield return new object[] { "GET", "/api/v1/income" };
        yield return new object[] { "GET", $"/api/v1/income/{Guid.NewGuid()}" };
        yield return new object[] { "POST", "/api/v1/income" };
        yield return new object[] { "PUT", $"/api/v1/income/{Guid.NewGuid()}" };
        yield return new object[] { "DELETE", $"/api/v1/income/{Guid.NewGuid()}" };
        yield return new object[] { "GET", $"/api/v1/properties/{Guid.NewGuid()}/income" };
        yield return new object[] { "GET", $"/api/v1/properties/{Guid.NewGuid()}/income/total" };

        // -- Vendors (5) ------------------------------------------------------------------
        yield return new object[] { "GET", "/api/v1/vendors" };
        yield return new object[] { "GET", $"/api/v1/vendors/{Guid.NewGuid()}" };
        yield return new object[] { "POST", "/api/v1/vendors" };
        yield return new object[] { "PUT", $"/api/v1/vendors/{Guid.NewGuid()}" };
        yield return new object[] { "DELETE", $"/api/v1/vendors/{Guid.NewGuid()}" };

        // -- Vendor Trade Tags (2) --------------------------------------------------------
        yield return new object[] { "GET", "/api/v1/vendor-trade-tags" };
        yield return new object[] { "POST", "/api/v1/vendor-trade-tags" };

        // -- Vendor Photos (6) ------------------------------------------------------------
        yield return new object[] { "POST", $"/api/v1/vendors/{Guid.NewGuid()}/photos/upload-url" };
        yield return new object[] { "POST", $"/api/v1/vendors/{Guid.NewGuid()}/photos" };
        yield return new object[] { "GET", $"/api/v1/vendors/{Guid.NewGuid()}/photos" };
        yield return new object[] { "DELETE", $"/api/v1/vendors/{Guid.NewGuid()}/photos/{Guid.NewGuid()}" };
        yield return new object[] { "PUT", $"/api/v1/vendors/{Guid.NewGuid()}/photos/{Guid.NewGuid()}/primary" };
        yield return new object[] { "PUT", $"/api/v1/vendors/{Guid.NewGuid()}/photos/reorder" };

        // -- Work Orders (9) --------------------------------------------------------------
        yield return new object[] { "GET", "/api/v1/work-orders" };
        yield return new object[] { "GET", $"/api/v1/work-orders/{Guid.NewGuid()}" };
        yield return new object[] { "POST", "/api/v1/work-orders" };
        yield return new object[] { "PUT", $"/api/v1/work-orders/{Guid.NewGuid()}" };
        yield return new object[] { "DELETE", $"/api/v1/work-orders/{Guid.NewGuid()}" };
        yield return new object[] { "GET", $"/api/v1/work-orders/{Guid.NewGuid()}/expenses" };
        yield return new object[] { "POST", $"/api/v1/work-orders/{Guid.NewGuid()}/pdf" };
        yield return new object[] { "GET", $"/api/v1/properties/{Guid.NewGuid()}/work-orders" };
        yield return new object[] { "GET", $"/api/v1/vendors/{Guid.NewGuid()}/work-orders" };

        // -- Work Order Photos (6) --------------------------------------------------------
        yield return new object[] { "POST", $"/api/v1/work-orders/{Guid.NewGuid()}/photos/upload-url" };
        yield return new object[] { "POST", $"/api/v1/work-orders/{Guid.NewGuid()}/photos" };
        yield return new object[] { "GET", $"/api/v1/work-orders/{Guid.NewGuid()}/photos" };
        yield return new object[] { "DELETE", $"/api/v1/work-orders/{Guid.NewGuid()}/photos/{Guid.NewGuid()}" };
        yield return new object[] { "PUT", $"/api/v1/work-orders/{Guid.NewGuid()}/photos/{Guid.NewGuid()}/primary" };
        yield return new object[] { "PUT", $"/api/v1/work-orders/{Guid.NewGuid()}/photos/reorder" };

        // -- Work Order Tags (2) ----------------------------------------------------------
        yield return new object[] { "GET", "/api/v1/work-order-tags" };
        yield return new object[] { "POST", "/api/v1/work-order-tags" };

        // -- Reports (5) ------------------------------------------------------------------
        yield return new object[] { "POST", "/api/v1/reports/schedule-e" };
        yield return new object[] { "POST", "/api/v1/reports/schedule-e/batch" };
        yield return new object[] { "GET", "/api/v1/reports" };
        yield return new object[] { "GET", $"/api/v1/reports/{Guid.NewGuid()}" };
        yield return new object[] { "DELETE", $"/api/v1/reports/{Guid.NewGuid()}" };

        // -- Receipts (6) -----------------------------------------------------------------
        yield return new object[] { "GET", "/api/v1/receipts/unprocessed" };
        yield return new object[] { "POST", "/api/v1/receipts/upload-url" };
        yield return new object[] { "POST", $"/api/v1/receipts/{Guid.NewGuid()}/process" };
        yield return new object[] { "GET", $"/api/v1/receipts/{Guid.NewGuid()}" };
        yield return new object[] { "POST", "/api/v1/receipts" };
        yield return new object[] { "DELETE", $"/api/v1/receipts/{Guid.NewGuid()}" };

        // -- Generic Photos (2) — Story 20.11 post-evaluate gap closed --------------------
        yield return new object[] { "POST", "/api/v1/photos/upload-url" };
        yield return new object[] { "POST", "/api/v1/photos/confirm" };

        // -- Property Photos (6) ----------------------------------------------------------
        yield return new object[] { "POST", $"/api/v1/properties/{Guid.NewGuid()}/photos/upload-url" };
        yield return new object[] { "POST", $"/api/v1/properties/{Guid.NewGuid()}/photos" };
        yield return new object[] { "GET", $"/api/v1/properties/{Guid.NewGuid()}/photos" };
        yield return new object[] { "DELETE", $"/api/v1/properties/{Guid.NewGuid()}/photos/{Guid.NewGuid()}" };
        yield return new object[] { "PUT", $"/api/v1/properties/{Guid.NewGuid()}/photos/{Guid.NewGuid()}/primary" };
        yield return new object[] { "PUT", $"/api/v1/properties/{Guid.NewGuid()}/photos/reorder" };

        // -- Dashboard (1) ----------------------------------------------------------------
        yield return new object[] { "GET", "/api/v1/dashboard/totals" };

        // -- Invitations (3) --------------------------------------------------------------
        yield return new object[] { "GET", "/api/v1/invitations" };
        yield return new object[] { "POST", "/api/v1/invitations" };
        yield return new object[] { "POST", $"/api/v1/invitations/{Guid.NewGuid()}/resend" };

        // -- Account Users (3) ------------------------------------------------------------
        // Real route is `account/users` (slash), NOT `account-users` (hyphen). See AC #8 note.
        yield return new object[] { "GET", "/api/v1/account/users" };
        yield return new object[] { "PUT", $"/api/v1/account/users/{Guid.NewGuid()}/role" };
        yield return new object[] { "DELETE", $"/api/v1/account/users/{Guid.NewGuid()}" };

        // -- Maintenance Requests landlord-only (2) ---------------------------------------
        yield return new object[] { "POST", $"/api/v1/maintenance-requests/{Guid.NewGuid()}/convert" };
        yield return new object[] { "POST", $"/api/v1/maintenance-requests/{Guid.NewGuid()}/dismiss" };

        // -- Notes (4) --------------------------------------------------------------------
        yield return new object[] { "GET", $"/api/v1/notes?workOrderId={Guid.NewGuid()}" };
        yield return new object[] { "POST", "/api/v1/notes" };
        yield return new object[] { "PUT", $"/api/v1/notes/{Guid.NewGuid()}" };
        yield return new object[] { "DELETE", $"/api/v1/notes/{Guid.NewGuid()}" };

        // -- TestController (1) — Story 20.11 post-evaluate gap closed -------------------
        yield return new object[] { "POST", "/api/v1/test/reset" };
    }

    [Theory]
    [MemberData(nameof(LandlordEndpoints))]
    public async Task LandlordEndpoint_AsTenant_Returns403(string method, string url)
    {
        var ctx = await CreateTenantContextAsync();

        var response = await SendWithAuthAsync(new HttpMethod(method), url, ctx.AccessToken);

        response.StatusCode.Should().Be(
            HttpStatusCode.Forbidden,
            $"Tenant role MUST NOT be able to {method} {url} — this is a security boundary regression");
    }

    // =====================================================
    // Task 4: Tenant property-scoping on maintenance-request reads (AC #10, #11)
    // =====================================================

    [Fact]
    public async Task GetMaintenanceRequests_AsTenant_ReturnsOnlyOwnPropertyRequests()
    {
        // AC #10 — Tenant on P1 should not see requests on P2 (same account).
        var ownerEmail = $"owner-lockdown-mr-list-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId, name: "Lockdown P1");
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId, name: "Lockdown P2");

        var t1Email = $"tenant-lockdown-t1-{Guid.NewGuid():N}@example.com";
        var t1UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);

        var t2Email = $"tenant-lockdown-t2-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p2, t2Email);

        await SeedMaintenanceRequestAsync(accountId, p1, t1UserId, "P1 request");
        await SeedMaintenanceRequestAsync(accountId, p2, t2UserId, "P2 request");

        var (token, _) = await LoginAsync(t1Email);

        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/maintenance-requests", token);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<TalListResponse>();
        body.Should().NotBeNull();
        body!.TotalCount.Should().Be(1, "tenant should only see requests on their own property");
        body.Items.Should().HaveCount(1);
        body.Items[0].PropertyId.Should().Be(p1);
    }

    [Fact]
    public async Task GetMaintenanceRequestById_AsTenantOnDifferentProperty_Returns404()
    {
        // AC #11 — Regression guard against accidental policy/handler drift.
        // Note: MaintenanceRequestsControllerTests already covers this (~line 670). Re-asserting
        // here keeps the lockdown file as the single source of security regression truth.
        var ownerEmail = $"owner-lockdown-mr-byid-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId, name: "P1");
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId, name: "P2");

        var t1Email = $"tenant-byid-t1-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);

        var t2Email = $"tenant-byid-t2-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p2, t2Email);

        var requestId = await SeedMaintenanceRequestAsync(accountId, p2, t2UserId, "P2 request");

        var (token, _) = await LoginAsync(t1Email);
        var response = await SendWithAuthAsync(
            HttpMethod.Get, $"/api/v1/maintenance-requests/{requestId}", token);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetMaintenanceRequests_AsTenant_DoesNotLeakCrossAccountRequests()
    {
        // AC #10 (cross-account variant) — global AccountId query filter must hide other accounts.
        var accountAOwnerEmail = $"owner-lockdown-acctA-{Guid.NewGuid():N}@example.com";
        var (_, accountAId) = await _factory.CreateTestUserAsync(accountAOwnerEmail);
        var accountAPropertyId = await _factory.CreatePropertyInAccountAsync(accountAId, name: "AcctA Property");
        var tenantAEmail = $"tenantA-{Guid.NewGuid():N}@example.com";
        var tenantAUserId = await _factory.CreateTenantUserInAccountAsync(accountAId, accountAPropertyId, tenantAEmail);
        await SeedMaintenanceRequestAsync(accountAId, accountAPropertyId, tenantAUserId, "Account A request");

        var accountBOwnerEmail = $"owner-lockdown-acctB-{Guid.NewGuid():N}@example.com";
        var (_, accountBId) = await _factory.CreateTestUserAsync(accountBOwnerEmail);
        var accountBPropertyId = await _factory.CreatePropertyInAccountAsync(accountBId, name: "AcctB Property");
        var tenantBEmail = $"tenantB-{Guid.NewGuid():N}@example.com";
        var tenantBUserId = await _factory.CreateTenantUserInAccountAsync(accountBId, accountBPropertyId, tenantBEmail);
        await SeedMaintenanceRequestAsync(accountBId, accountBPropertyId, tenantBUserId, "Account B request");

        var (tokenA, _) = await LoginAsync(tenantAEmail);

        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/maintenance-requests", tokenA);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<TalListResponse>();
        body.Should().NotBeNull();
        body!.TotalCount.Should().Be(1, "tenant in Account A must not see Account B's requests");
        body.Items[0].PropertyId.Should().Be(accountAPropertyId);
    }

    // =====================================================
    // Task 5: Maintenance-request photo property-scoping (AC #12)
    // =====================================================

    [Fact]
    public async Task GetMaintenanceRequestPhotos_AsTenantOnDifferentProperty_Returns404()
    {
        var ownerEmail = $"owner-lockdown-photos-get-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId, name: "Photo-P1");
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId, name: "Photo-P2");

        var t1Email = $"tenant-photo-t1-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);

        var t2Email = $"tenant-photo-t2-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p2, t2Email);

        var mrId = await SeedMaintenanceRequestAsync(accountId, p2, t2UserId);

        var (token, _) = await LoginAsync(t1Email);
        var response = await SendWithAuthAsync(
            HttpMethod.Get, $"/api/v1/maintenance-requests/{mrId}/photos", token);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateUploadUrl_AsTenantOnDifferentProperty_Returns404()
    {
        var ownerEmail = $"owner-lockdown-upload-url-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId, name: "Upload-P1");
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId, name: "Upload-P2");

        var t1Email = $"tenant-upload-t1-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);

        var t2Email = $"tenant-upload-t2-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p2, t2Email);

        var mrId = await SeedMaintenanceRequestAsync(accountId, p2, t2UserId);

        var (token, _) = await LoginAsync(t1Email);
        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{mrId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "x.jpg" },
            token);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletePhoto_AsTenantOnDifferentProperty_Returns404()
    {
        var ownerEmail = $"owner-lockdown-delete-photo-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId, name: "Del-P1");
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId, name: "Del-P2");

        var t1Email = $"tenant-del-t1-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);

        var t2Email = $"tenant-del-t2-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p2, t2Email);

        var mrId = await SeedMaintenanceRequestAsync(accountId, p2, t2UserId);
        var photoId = await SeedMaintenanceRequestPhotoAsync(accountId, mrId);

        var (token, _) = await LoginAsync(t1Email);
        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{mrId}/photos/{photoId}", token);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetMaintenanceRequestPhotos_AsTenantOnSameProperty_Returns200()
    {
        // Positive control — tenant on their own property's MR can list photos.
        var ownerEmail = $"owner-lockdown-photo-same-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var tenantEmail = $"tenant-photo-same-{Guid.NewGuid():N}@example.com";
        var tenantUserId = await _factory.CreateTenantUserInAccountAsync(accountId, propertyId, tenantEmail);

        var mrId = await SeedMaintenanceRequestAsync(accountId, propertyId, tenantUserId);

        var (token, _) = await LoginAsync(tenantEmail);
        var response = await SendWithAuthAsync(
            HttpMethod.Get, $"/api/v1/maintenance-requests/{mrId}/photos", token);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // =====================================================
    // Task 6: Landlord cross-account isolation regression (AC #13)
    // =====================================================

    [Fact]
    public async Task GetMaintenanceRequestById_AsLandlordOnDifferentAccount_Returns404()
    {
        // AC #13 — Re-asserts the global AccountId query filter for landlords.
        // Equivalent assertion exists in MaintenanceRequestsControllerTests; keeping it here
        // gives the lockdown file a self-contained cross-account regression beachhead.
        var accountAOwnerEmail = $"owner-lockdown-cross-A-{Guid.NewGuid():N}@example.com";
        var (_, accountAId) = await _factory.CreateTestUserAsync(accountAOwnerEmail);
        var accountAPropertyId = await _factory.CreatePropertyInAccountAsync(accountAId);
        var accountATenantEmail = $"tenantA-cross-{Guid.NewGuid():N}@example.com";
        var accountATenantUserId = await _factory.CreateTenantUserInAccountAsync(
            accountAId, accountAPropertyId, accountATenantEmail);
        var accountAMrId = await SeedMaintenanceRequestAsync(accountAId, accountAPropertyId, accountATenantUserId);

        var accountBOwnerEmail = $"owner-lockdown-cross-B-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(accountBOwnerEmail);

        var (accountBOwnerToken, _) = await LoginAsync(accountBOwnerEmail);
        var response = await SendWithAuthAsync(
            HttpMethod.Get, $"/api/v1/maintenance-requests/{accountAMrId}", accountBOwnerToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // Post-evaluation fix (2026-05-19): ReceiptHub SignalR negotiate must reject Tenant.
    // The hub broadcasts to account-{accountId} groups including landlord receipt notifications.
    // =====================================================

    [Fact]
    public async Task ReceiptHub_Negotiate_AsTenant_Returns403()
    {
        // Tenants must not be able to negotiate a SignalR connection to the receipts hub.
        // The CanAccessReceipts policy on ReceiptHub yields 403 at the negotiate request.
        var ctx = await CreateTenantContextAsync();

        var request = new HttpRequestMessage(
            HttpMethod.Post,
            "/hubs/receipts/negotiate?negotiateVersion=1");
        request.Headers.Add("Authorization", $"Bearer {ctx.AccessToken}");

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(
            HttpStatusCode.Forbidden,
            "Tenant role MUST NOT be able to negotiate a connection to ReceiptHub — it would join the landlord's receipt group");
    }

    // =====================================================
    // Task 7: Authorization audit log assertion (AC #14)
    // =====================================================

    [Fact]
    public async Task Authorization_Denied_EmitsStructuredAuditLog()
    {
        // Use a custom factory that registers an in-memory logger provider so we can
        // capture the LogWarning emitted by AddPermissionPolicy on policy denial.
        // The base PropertyManagerWebApplicationFactory already manages the Postgres
        // testcontainer + DI graph; we extend it to add the logger.
        var capturingProvider = new ListLoggerProvider();

        using var factoryWithLogs = _factory.WithWebHostBuilder(builder =>
        {
            // Replace the DI-resolved ILoggerFactory with one that ONLY uses our in-memory
            // provider. Program.cs calls `builder.Host.UseSerilog()` which normally takes
            // over the factory, but services registered later in WAF's ConfigureServices
            // (which runs AFTER builder.Build) wins because it replaces the registration.
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ILoggerFactory>();
                services.RemoveAll<ILoggerProvider>();
                services.AddSingleton<ILoggerProvider>(capturingProvider);
                services.AddSingleton<ILoggerFactory>(_ =>
                {
                    var factory = new LoggerFactory();
                    factory.AddProvider(capturingProvider);
                    return factory;
                });
                services.AddSingleton(typeof(ILogger<>), typeof(Logger<>));
            });
        });
        var client = factoryWithLogs.CreateClient();

        var ctx = await CreateTenantContextAsync();

        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/expenses", ctx.AccessToken, client);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // Find the authorization-audit entry.
        var auditEntry = capturingProvider.Entries.FirstOrDefault(e =>
            e.Category == "PropertyManager.Authorization.Audit"
            && e.Level == LogLevel.Warning
            && e.Message.Contains("Authorization denied"));

        var diagnostics = string.Join("\n  - ",
            capturingProvider.Entries.Select(e => $"[{e.Level}] {e.Category}: {e.Message}").Take(40));
        auditEntry.Should().NotBeNull(
            $"authorization denial MUST emit a structured warning entry per NFR-TP3. Captured entries:\n  - {diagnostics}");

        // Structured fields — match the named placeholders in Program.cs (LogWarning).
        auditEntry!.State["UserId"]?.ToString().Should().Be(ctx.UserId.ToString());
        auditEntry.State["AccountId"]?.ToString().Should().Be(ctx.AccountId.ToString());
        auditEntry.State["Role"]?.ToString().Should().Be("Tenant");
        auditEntry.State["Method"]?.ToString().Should().Be("GET");
        auditEntry.State["Path"]?.ToString().Should().Be("/api/v1/expenses");
        auditEntry.State["Policy"]?.ToString().Should().Be("CanAccessExpenses");

        // Sanity: the log line MUST NOT contain the JWT or the tenant's password.
        var fullMessage = auditEntry.Message + " | " + string.Join(" ",
            auditEntry.State.Select(kvp => $"{kvp.Key}={kvp.Value}"));
        fullMessage.Should().NotContain("Bearer ", "JWT must never appear in audit logs");
        fullMessage.Should().NotContain("Test@123456", "passwords must never appear in audit logs");
        fullMessage.Should().NotContain(ctx.AccessToken, "the access token must never appear in audit logs");
    }

    // =====================================================
    // Helpers — local to this file (do NOT extract a shared helper per story 20.11)
    // =====================================================

    private async Task<TenantContext> CreateTenantContextAsync()
    {
        var ownerEmail = $"owner-lockdown-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        var tenantEmail = $"tenant-lockdown-{Guid.NewGuid():N}@example.com";
        var tenantUserId = await _factory.CreateTenantUserInAccountAsync(accountId, propertyId, tenantEmail);

        var (accessToken, _) = await LoginAsync(tenantEmail);
        return new TenantContext(accessToken, tenantUserId, accountId, propertyId);
    }

    private sealed record TenantContext(string AccessToken, Guid UserId, Guid AccountId, Guid PropertyId);

    private async Task<(string AccessToken, Guid? UserId)> LoginAsync(string email, string password = "Test@123456")
    {
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<TalLoginResponse>();
        return (loginContent!.AccessToken, null);
    }

    private async Task<Guid> SeedMaintenanceRequestAsync(
        Guid accountId,
        Guid propertyId,
        Guid submittedByUserId,
        string description = "lockdown seeded")
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var entity = new MaintenanceRequest
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = propertyId,
            SubmittedByUserId = submittedByUserId,
            Description = description,
            Status = MaintenanceRequestStatus.Submitted
        };
        dbContext.MaintenanceRequests.Add(entity);
        await dbContext.SaveChangesAsync();
        return entity.Id;
    }

    private async Task<Guid> SeedMaintenanceRequestPhotoAsync(
        Guid accountId,
        Guid maintenanceRequestId)
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var photo = new MaintenanceRequestPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            MaintenanceRequestId = maintenanceRequestId,
            StorageKey = $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg",
            OriginalFileName = "lockdown.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            DisplayOrder = 0,
            IsPrimary = true
        };
        dbContext.MaintenanceRequestPhotos.Add(photo);
        await dbContext.SaveChangesAsync();
        return photo.Id;
    }

    private async Task<HttpResponseMessage> SendWithAuthAsync(
        HttpMethod method, string url, string token, HttpClient? client = null)
    {
        client ??= _client;
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Authorization", $"Bearer {token}");
        if (method == HttpMethod.Post || method == HttpMethod.Put)
        {
            request.Content = JsonContent.Create(new { });
        }
        return await client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {token}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> DeleteWithAuthAsync(string url, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Add("Authorization", $"Bearer {token}");
        return await _client.SendAsync(request);
    }
}

// =====================================================
// In-memory log provider used by the audit-log assertion.
// =====================================================

internal sealed class ListLoggerProvider : ILoggerProvider
{
    public List<LoggedEntry> Entries { get; } = new();
    private readonly object _lock = new();

    public ILogger CreateLogger(string categoryName) => new ListLogger(categoryName, Entries, _lock);

    public void Dispose() { }

    private sealed class ListLogger : ILogger
    {
        private readonly string _category;
        private readonly List<LoggedEntry> _entries;
        private readonly object _lock;

        public ListLogger(string category, List<LoggedEntry> entries, object @lock)
        {
            _category = category;
            _entries = entries;
            _lock = @lock;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            var message = formatter(state, exception);
            var dict = new Dictionary<string, object?>();
            if (state is IReadOnlyList<KeyValuePair<string, object?>> kvps)
            {
                foreach (var kvp in kvps)
                {
                    dict[kvp.Key] = kvp.Value;
                }
            }
            lock (_lock)
            {
                _entries.Add(new LoggedEntry(_category, logLevel, message, dict));
            }
        }
    }
}

internal sealed record LoggedEntry(
    string Category,
    LogLevel Level,
    string Message,
    IReadOnlyDictionary<string, object?> State);

// =====================================================
// Response records scoped to this file (TalXxx = TenantAuthorizationLockdown).
// =====================================================

file record TalLoginResponse(string AccessToken, int ExpiresIn);

file record TalListResponse(IReadOnlyList<TalMrDto> Items, int TotalCount);

file record TalMrDto(Guid Id, Guid PropertyId, string PropertyName);
