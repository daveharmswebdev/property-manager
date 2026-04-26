using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for VendorsController PUT endpoint (Story 21.6, AC #14-#29):
///   PUT /api/v1/vendors/{id}
///
/// Mirrors VendorsControllerCreateTests.cs / VendorsControllerDeleteTests.cs conventions.
/// Reuses CreateVendorResponse / GetAllVendorsResponse / VendorDto / PhoneNumberDto /
/// VendorTradeTagDto declared in VendorsControllerCreateTests.cs (same assembly).
/// AC-1 PUT (no auth) is covered in VendorsControllerGetTests.cs.
/// </summary>
public class VendorsControllerUpdateTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public VendorsControllerUpdateTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // Happy paths — AC-14 to AC-18 — Task 6
    // =====================================================

    [Fact]
    public async Task UpdateVendor_ValidRequest_Returns204_AndPersistsFields()
    {
        // AC-14
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Old", null, "Name");

        // Capture seeded UpdatedAt
        DateTime seededUpdatedAt;
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var seeded = await dbContext.Vendors.AsNoTracking().FirstAsync(v => v.Id == vendorId);
            seededUpdatedAt = seeded.UpdatedAt;
        }

        // Wait briefly so UpdatedAt is observably greater
        await Task.Delay(50);

        var payload = new
        {
            FirstName = "New",
            MiddleName = "M",
            LastName = "Surname",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var vendor = await dbContext.Vendors.IgnoreQueryFilters().FirstAsync(v => v.Id == vendorId);
            vendor.FirstName.Should().Be("New");
            vendor.MiddleName.Should().Be("M");
            vendor.LastName.Should().Be("Surname");
            vendor.UpdatedAt.Should().BeAfter(seededUpdatedAt);
        }
    }

    [Fact]
    public async Task UpdateVendor_ReplacesPhonesAndEmails()
    {
        // AC-15
        var ctx = await CreateOwnerContextAsync();

        // Seed vendor with two phones and one email via API
        var createPayload = new
        {
            FirstName = "Phone",
            LastName = "Owner",
            Phones = new[]
            {
                new { Number = "111-1111", Label = "Cell" },
                new { Number = "222-2222", Label = "Work" }
            },
            Emails = new[] { "old@example.com" },
            TradeTagIds = Array.Empty<Guid>()
        };
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/vendors", createPayload, ctx.AccessToken);
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<CreateVendorResponse>();
        var vendorId = created!.Id;

        // PUT with one new phone + two new emails
        var updatePayload = new
        {
            FirstName = "Phone",
            LastName = "Owner",
            Phones = new[] { new { Number = "555-9999", Label = "Mobile" } },
            Emails = new[] { "new1@example.com", "new2@example.com" },
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", updatePayload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var vendor = await dbContext.Vendors.IgnoreQueryFilters().FirstAsync(v => v.Id == vendorId);

            vendor.Phones.Should().HaveCount(1);
            vendor.Phones[0].Number.Should().Be("555-9999");
            vendor.Phones[0].Label.Should().Be("Mobile");

            vendor.Emails.Should().HaveCount(2);
            vendor.Emails.Should().BeEquivalentTo(new[] { "new1@example.com", "new2@example.com" });
        }
    }

    [Fact]
    public async Task UpdateVendor_AddsTradeTagAssignments()
    {
        // AC-16
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Tagless", null, "Vendor");

        Guid tagAId, tagBId;
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            tagAId = Guid.NewGuid();
            tagBId = Guid.NewGuid();
            dbContext.VendorTradeTags.AddRange(
                new VendorTradeTag { Id = tagAId, AccountId = ctx.AccountId, Name = "TagA", CreatedAt = DateTime.UtcNow },
                new VendorTradeTag { Id = tagBId, AccountId = ctx.AccountId, Name = "TagB", CreatedAt = DateTime.UtcNow });
            await dbContext.SaveChangesAsync();
        }

        var payload = new
        {
            FirstName = "Tagless",
            LastName = "Vendor",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = new[] { tagAId, tagBId }
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var assignments = await dbContext.VendorTradeTagAssignments
                .Where(a => a.VendorId == vendorId)
                .ToListAsync();
            assignments.Should().HaveCount(2);
            assignments.Select(a => a.TradeTagId).Should().BeEquivalentTo(new[] { tagAId, tagBId });
        }
    }

    [Fact]
    public async Task UpdateVendor_RemovesTradeTagAssignmentsNotInPayload()
    {
        // AC-17
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "PreTagged", null, "Vendor");

        Guid tagAId, tagBId;
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            tagAId = Guid.NewGuid();
            tagBId = Guid.NewGuid();
            dbContext.VendorTradeTags.AddRange(
                new VendorTradeTag { Id = tagAId, AccountId = ctx.AccountId, Name = "TagA", CreatedAt = DateTime.UtcNow },
                new VendorTradeTag { Id = tagBId, AccountId = ctx.AccountId, Name = "TagB", CreatedAt = DateTime.UtcNow });
            dbContext.VendorTradeTagAssignments.AddRange(
                new VendorTradeTagAssignment { VendorId = vendorId, TradeTagId = tagAId },
                new VendorTradeTagAssignment { VendorId = vendorId, TradeTagId = tagBId });
            await dbContext.SaveChangesAsync();
        }

        var payload = new
        {
            FirstName = "PreTagged",
            LastName = "Vendor",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = new[] { tagAId }
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var assignments = await dbContext.VendorTradeTagAssignments
                .Where(a => a.VendorId == vendorId)
                .ToListAsync();
            assignments.Should().HaveCount(1);
            assignments[0].TradeTagId.Should().Be(tagAId);
        }
    }

    [Fact]
    public async Task UpdateVendor_ClearsAllTradeTagAssignments()
    {
        // AC-18
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "ClearMe", null, "Vendor");

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var tagAId = Guid.NewGuid();
            var tagBId = Guid.NewGuid();
            dbContext.VendorTradeTags.AddRange(
                new VendorTradeTag { Id = tagAId, AccountId = ctx.AccountId, Name = "TagA", CreatedAt = DateTime.UtcNow },
                new VendorTradeTag { Id = tagBId, AccountId = ctx.AccountId, Name = "TagB", CreatedAt = DateTime.UtcNow });
            dbContext.VendorTradeTagAssignments.AddRange(
                new VendorTradeTagAssignment { VendorId = vendorId, TradeTagId = tagAId },
                new VendorTradeTagAssignment { VendorId = vendorId, TradeTagId = tagBId });
            await dbContext.SaveChangesAsync();
        }

        var payload = new
        {
            FirstName = "ClearMe",
            LastName = "Vendor",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var assignments = await dbContext.VendorTradeTagAssignments
                .Where(a => a.VendorId == vendorId)
                .ToListAsync();
            assignments.Should().BeEmpty();
        }
    }

    // =====================================================
    // Validation — AC-19 to AC-25 — Task 7
    // =====================================================

    [Fact]
    public async Task UpdateVendor_EmptyFirstName_Returns400()
    {
        // AC-19
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Has", null, "Name");

        var payload = new
        {
            FirstName = "",
            LastName = "Surname",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("FirstName");
        body.Should().Contain("First name is required");
    }

    [Fact]
    public async Task UpdateVendor_EmptyLastName_Returns400()
    {
        // AC-20
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Has", null, "Name");

        var payload = new
        {
            FirstName = "Joe",
            LastName = "",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("LastName");
        body.Should().Contain("Last name is required");
    }

    [Fact]
    public async Task UpdateVendor_FirstNameOver100Chars_Returns400()
    {
        // AC-21
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Has", null, "Name");

        var payload = new
        {
            FirstName = new string('a', 101),
            LastName = "Surname",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("First name must be 100 characters or less");
    }

    [Fact]
    public async Task UpdateVendor_LastNameOver100Chars_Returns400()
    {
        // AC-21
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Has", null, "Name");

        var payload = new
        {
            FirstName = "Joe",
            LastName = new string('b', 101),
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Last name must be 100 characters or less");
    }

    [Fact]
    public async Task UpdateVendor_MiddleNameOver100Chars_Returns400()
    {
        // AC-21
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Has", null, "Name");

        var payload = new
        {
            FirstName = "Joe",
            MiddleName = new string('c', 101),
            LastName = "Surname",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Middle name must be 100 characters or less");
    }

    [Fact]
    public async Task UpdateVendor_InvalidEmailFormat_Returns400()
    {
        // AC-22
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Has", null, "Name");

        var payload = new
        {
            FirstName = "Joe",
            LastName = "Surname",
            Phones = Array.Empty<object>(),
            Emails = new[] { "not-an-email" },
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Invalid email address format");
    }

    [Fact]
    public async Task UpdateVendor_EmptyPhoneNumber_Returns400()
    {
        // AC-23
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Has", null, "Name");

        var payload = new
        {
            FirstName = "Joe",
            LastName = "Surname",
            Phones = new[] { new { Number = "", Label = "Cell" } },
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Phone number is required");
    }

    [Fact]
    public async Task UpdateVendor_NullBody_Returns400_WithBodyRequiredMessage()
    {
        // AC-25
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Has", null, "Name");

        var request = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/vendors/{vendorId}");
        request.Headers.Add("Authorization", $"Bearer {ctx.AccessToken}");
        request.Content = new StringContent("null", System.Text.Encoding.UTF8, "application/json");

        var response = await _client.SendAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Request body is required");
    }

    // =====================================================
    // Trade-tag handler-level validation — AC-24 — Task 8
    // =====================================================

    [Fact]
    public async Task UpdateVendor_TradeTagBelongsToOtherAccount_Returns400_WithErrorsTradeTagIds()
    {
        // AC-24
        var ctxA = await CreateOwnerContextAsync();
        var ctxB = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctxA.AccessToken, "Has", null, "Name");

        Guid tagBId;
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            tagBId = Guid.NewGuid();
            dbContext.VendorTradeTags.Add(new VendorTradeTag
            {
                Id = tagBId,
                AccountId = ctxB.AccountId,
                Name = "AccountBTag",
                CreatedAt = DateTime.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }

        var payload = new
        {
            FirstName = "Joe",
            LastName = "Surname",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = new[] { tagBId }
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctxA.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("tradeTagIds");
        body.Should().Contain("Invalid trade tag IDs");
        body.Should().Contain(tagBId.ToString());
    }

    [Fact]
    public async Task UpdateVendor_NonExistentTradeTagId_Returns400()
    {
        // AC-24
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Has", null, "Name");

        var bogusTagId = Guid.NewGuid();

        var payload = new
        {
            FirstName = "Joe",
            LastName = "Surname",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = new[] { bogusTagId }
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("tradeTagIds");
        body.Should().Contain("Invalid trade tag IDs");
        body.Should().Contain(bogusTagId.ToString());
    }

    [Fact]
    public async Task UpdateVendor_PartiallyValidTradeTagIds_Returns400_WithOnlyInvalidIdsListed()
    {
        // AC-24
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Has", null, "Name");

        Guid validTagId;
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            validTagId = Guid.NewGuid();
            dbContext.VendorTradeTags.Add(new VendorTradeTag
            {
                Id = validTagId,
                AccountId = ctx.AccountId,
                Name = "ValidTag",
                CreatedAt = DateTime.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }

        var invalidTagId = Guid.NewGuid();

        var payload = new
        {
            FirstName = "Joe",
            LastName = "Surname",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = new[] { validTagId, invalidTagId }
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("tradeTagIds");
        body.Should().Contain("Invalid trade tag IDs");
        body.Should().Contain(invalidTagId.ToString());
        body.Should().NotContain(validTagId.ToString());
    }

    // =====================================================
    // Not-found and access-control — AC-26 to AC-29 — Task 9
    // =====================================================

    [Fact]
    public async Task UpdateVendor_NonExistentVendor_Returns404()
    {
        // AC-26
        var ctx = await CreateOwnerContextAsync();

        var payload = new
        {
            FirstName = "Joe",
            LastName = "Surname",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{Guid.NewGuid()}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateVendor_CrossAccount_Returns404()
    {
        // AC-27
        var ctxA = await CreateOwnerContextAsync();
        var ctxB = await CreateOwnerContextAsync();

        var vendorId = await CreateVendorAsync(ctxA.AccessToken, "Cross", null, "Account");

        var payload = new
        {
            FirstName = "Hijack",
            LastName = "Attempt",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctxB.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateVendor_SoftDeleted_Returns404()
    {
        // AC-28
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Soft", null, "Deleted");

        var deleteResponse = await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}", ctx.AccessToken);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var payload = new
        {
            FirstName = "Cant",
            LastName = "Update",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateVendor_AsContributor_Returns403()
    {
        // AC-29
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Any", null, "Vendor");

        var contribEmail = $"contrib-vendors-update-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserInAccountAsync(ctx.AccountId, contribEmail, role: "Contributor");
        var (contribToken, _) = await LoginAsync(contribEmail);

        var payload = new
        {
            FirstName = "Try",
            LastName = "Update",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, contribToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateVendor_AsTenant_Returns403()
    {
        // AC-29
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Any", null, "Vendor");

        var propertyId = await _factory.CreatePropertyInAccountAsync(ctx.AccountId);
        var tenantEmail = $"tenant-vendors-update-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(ctx.AccountId, propertyId, tenantEmail);
        var (tenantToken, _) = await LoginAsync(tenantEmail);

        var payload = new
        {
            FirstName = "Try",
            LastName = "Update",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}", payload, tenantToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // =====================================================
    // Helpers
    // =====================================================

    private async Task<OwnerContext> CreateOwnerContextAsync()
    {
        var email = $"owner-vendors-update-{Guid.NewGuid():N}@example.com";
        var (userId, accountId) = await _factory.CreateTestUserAsync(email);
        var (accessToken, _) = await LoginAsync(email);
        return new OwnerContext(accessToken, userId, accountId);
    }

    private async Task<(string AccessToken, Guid? UserId)> LoginAsync(string email, string password = "Test@123456")
    {
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, null);
    }

    private async Task<Guid> CreateVendorAsync(string accessToken, string firstName, string? middleName, string lastName)
    {
        object request = middleName is null
            ? new { FirstName = firstName, LastName = lastName }
            : new { FirstName = firstName, MiddleName = middleName, LastName = lastName };

        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<CreateVendorResponse>();
        return content!.Id;
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> PutAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> DeleteWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }

    private sealed record OwnerContext(string AccessToken, Guid UserId, Guid AccountId);
}
