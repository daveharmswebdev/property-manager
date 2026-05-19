using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for WorkOrdersController.
/// Tests CRUD operations for work orders including validation, authorization, and multi-tenancy.
/// </summary>
public class WorkOrdersControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public WorkOrdersControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // GET /api/v1/work-orders Tests
    // =====================================================

    [Fact]
    public async Task GetAllWorkOrders_WithoutAuth_Returns401()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/work-orders");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetAllWorkOrders_WithAuth_ReturnsEmptyList()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Act
        var response = await GetWithAuthAsync("/api/v1/work-orders", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetAllWorkOrdersResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().BeEmpty();
        content.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetAllWorkOrders_WithWorkOrders_ReturnsList()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Create a work order
        var createRequest = new
        {
            PropertyId = propertyId,
            Description = "Fix leaky faucet"
        };
        await PostAsJsonWithAuthAsync("/api/v1/work-orders", createRequest, accessToken);

        // Act
        var response = await GetWithAuthAsync("/api/v1/work-orders", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetAllWorkOrdersResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(1);
        content.TotalCount.Should().Be(1);
        content.Items[0].Description.Should().Be("Fix leaky faucet");
    }

    [Fact]
    public async Task GetAllWorkOrders_WithStatusFilter_ReturnsFilteredResults()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Create work orders with different statuses
        await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Reported work order",
            Status = "Reported"
        }, accessToken);

        await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Completed work order",
            Status = "Completed"
        }, accessToken);

        // Act
        var response = await GetWithAuthAsync("/api/v1/work-orders?status=Completed", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetAllWorkOrdersResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Description.Should().Be("Completed work order");
    }

    [Fact]
    public async Task GetAllWorkOrders_WithInvalidStatusFilter_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Act
        var response = await GetWithAuthAsync("/api/v1/work-orders?status=InvalidStatus", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetAllWorkOrders_WithPropertyIdFilter_ReturnsFilteredResults()
    {
        // Arrange
        var email = $"workorder-filter-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        // Create two properties
        var prop1Response = await PostAsJsonWithAuthAsync("/api/v1/properties", new
        {
            Name = "Property 1",
            Street = "123 First Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        }, accessToken);
        var prop1 = await prop1Response.Content.ReadFromJsonAsync<CreatePropertyResponse>();

        var prop2Response = await PostAsJsonWithAuthAsync("/api/v1/properties", new
        {
            Name = "Property 2",
            Street = "456 Second Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78702"
        }, accessToken);
        var prop2 = await prop2Response.Content.ReadFromJsonAsync<CreatePropertyResponse>();

        // Create work orders for each property
        await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = prop1!.Id,
            Description = "Work order for Property 1"
        }, accessToken);

        await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = prop2!.Id,
            Description = "Work order for Property 2"
        }, accessToken);

        // Act
        var response = await GetWithAuthAsync($"/api/v1/work-orders?propertyId={prop1.Id}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetAllWorkOrdersResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Description.Should().Be("Work order for Property 1");
    }

    [Fact]
    public async Task GetAllWorkOrders_OnlyReturnsOwnWorkOrders()
    {
        // Arrange - Create work orders with two different users
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var (accessToken2, propertyId2) = await CreateUserWithPropertyAsync();

        // User 1 creates a work order
        await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId1,
            Description = "User 1 work order"
        }, accessToken1);

        // User 2 creates a work order
        await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId2,
            Description = "User 2 work order"
        }, accessToken2);

        // Act - User 1 gets their work orders
        var response = await GetWithAuthAsync("/api/v1/work-orders", accessToken1);

        // Assert - Should only see User 1's work order
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetAllWorkOrdersResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Description.Should().Be("User 1 work order");
    }

    // =====================================================
    // POST /api/v1/work-orders Tests
    // =====================================================

    [Fact]
    public async Task CreateWorkOrder_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new
        {
            PropertyId = Guid.NewGuid(),
            Description = "Test work order"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/work-orders", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateWorkOrder_WithValidData_Returns201WithId()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var request = new
        {
            PropertyId = propertyId,
            Description = "Fix broken window"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-orders", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();
        content.Should().NotBeNull();
        content!.Id.Should().NotBe(Guid.Empty);

        // Verify Location header is present
        response.Headers.Location.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateWorkOrder_WithAllFields_Returns201()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var request = new
        {
            PropertyId = propertyId,
            Description = "Complete work order with all fields",
            Status = "Assigned"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-orders", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();
        content.Should().NotBeNull();

        // Verify the work order was created correctly
        var getResponse = await GetWithAuthAsync($"/api/v1/work-orders/{content!.Id}", accessToken);
        var workOrder = await getResponse.Content.ReadFromJsonAsync<WorkOrderDetailDto>();
        workOrder.Should().NotBeNull();
        workOrder!.Description.Should().Be("Complete work order with all fields");
        workOrder.Status.Should().Be("Assigned");
    }

    [Fact]
    public async Task CreateWorkOrder_DefaultsToReportedStatus()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var request = new
        {
            PropertyId = propertyId,
            Description = "Work order without status"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-orders", request, accessToken);
        var content = await response.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        // Verify status defaults to Reported
        var getResponse = await GetWithAuthAsync($"/api/v1/work-orders/{content!.Id}", accessToken);
        var workOrder = await getResponse.Content.ReadFromJsonAsync<WorkOrderDetailDto>();

        // Assert
        workOrder!.Status.Should().Be("Reported");
    }

    [Fact]
    public async Task CreateWorkOrder_WithMissingPropertyId_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            PropertyId = Guid.Empty,
            Description = "Test work order"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-orders", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateWorkOrder_WithMissingDescription_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var request = new
        {
            PropertyId = propertyId,
            Description = ""
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-orders", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateWorkOrder_WithNonExistentPropertyId_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            PropertyId = Guid.NewGuid(),
            Description = "Test work order"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-orders", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreateWorkOrder_WithInvalidStatus_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var request = new
        {
            PropertyId = propertyId,
            Description = "Test work order",
            Status = "InvalidStatus"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-orders", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateWorkOrder_SetsTimestamps()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var request = new
        {
            PropertyId = propertyId,
            Description = "Timestamp test work order"
        };

        var beforeCreate = DateTime.UtcNow;

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-orders", request, accessToken);
        var content = await response.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        var afterCreate = DateTime.UtcNow;

        // Assert
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var workOrder = await dbContext.WorkOrders
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(w => w.Id == content!.Id);

        workOrder.Should().NotBeNull();
        workOrder!.CreatedAt.Should().BeAfter(beforeCreate.AddSeconds(-1));
        workOrder.CreatedAt.Should().BeBefore(afterCreate.AddSeconds(1));
    }

    // =====================================================
    // GET /api/v1/work-orders/{id} Tests
    // =====================================================

    [Fact]
    public async Task GetWorkOrderById_WithoutAuth_Returns401()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();

        // Act
        var response = await _client.GetAsync($"/api/v1/work-orders/{workOrderId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetWorkOrderById_ValidId_Returns200WithDetail()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var createRequest = new
        {
            PropertyId = propertyId,
            Description = "Detail test work order"
        };
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", createRequest, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<WorkOrderDetailDto>();
        content.Should().NotBeNull();
        content!.Id.Should().Be(createContent.Id);
        content.Description.Should().Be("Detail test work order");
        content.Status.Should().Be("Reported");
    }

    [Fact]
    public async Task GetWorkOrderById_NonExistentId_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentId = Guid.NewGuid();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/work-orders/{nonExistentId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetWorkOrderById_OtherAccountWorkOrder_Returns404()
    {
        // Arrange - Create work order with user 1, try to access with user 2
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // User 1 creates a work order
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId1,
            Description = "User 1 work order"
        }, accessToken1);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        // Act - User 2 tries to access User 1's work order
        var response = await GetWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", accessToken2);

        // Assert - Should return 404 (not 403) to prevent data leakage
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // PUT /api/v1/work-orders/{id} Tests
    // =====================================================

    [Fact]
    public async Task UpdateWorkOrder_WithoutAuth_Returns401()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var request = new
        {
            Description = "Updated description",
            Status = "Completed"
        };

        // Act
        var response = await _client.PutAsJsonAsync($"/api/v1/work-orders/{workOrderId}", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateWorkOrder_ValidData_Returns204()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Original description"
        }, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        var updateRequest = new
        {
            Description = "Updated description",
            Status = "Completed"
        };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", updateRequest, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task UpdateWorkOrder_ValidData_UpdatesAllFields()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Original"
        }, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        var updateRequest = new
        {
            Description = "Updated description",
            Status = "Completed"
        };

        // Act
        await PutAsJsonWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", updateRequest, accessToken);

        // Verify
        var getResponse = await GetWithAuthAsync($"/api/v1/work-orders/{createContent.Id}", accessToken);
        var workOrder = await getResponse.Content.ReadFromJsonAsync<WorkOrderDetailDto>();

        // Assert
        workOrder.Should().NotBeNull();
        workOrder!.Description.Should().Be("Updated description");
        workOrder.Status.Should().Be("Completed");
    }

    [Fact]
    public async Task UpdateWorkOrder_NonExistentId_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentId = Guid.NewGuid();

        var updateRequest = new
        {
            Description = "Updated",
            Status = "Completed"
        };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/work-orders/{nonExistentId}", updateRequest, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateWorkOrder_OtherAccountWorkOrder_Returns404()
    {
        // Arrange
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // User 1 creates a work order
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId1,
            Description = "User 1 work order"
        }, accessToken1);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        // User 2 tries to update User 1's work order
        var updateRequest = new
        {
            Description = "Hacked description",
            Status = "Completed"
        };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", updateRequest, accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateWorkOrder_InvalidStatus_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Test work order"
        }, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        var updateRequest = new
        {
            Description = "Updated",
            Status = "InvalidStatus"
        };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", updateRequest, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateWorkOrder_EmptyDescription_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Test work order"
        }, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        var updateRequest = new
        {
            Description = "",
            Status = "Completed"
        };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", updateRequest, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // =====================================================
    // PUT /api/v1/work-orders/{id} — Story 20.10 resolution sync (AC #1, #2, #4, #7, #10)
    // =====================================================

    [Fact]
    public async Task UpdateWorkOrder_StatusToCompleted_WithLinkedRequest_MarksRequestResolved()
    {
        // AC #1, #5 — landlord completes a WO linked to an InProgress MR → MR is Resolved.
        var (accessToken, propertyId, accountId, userId) = await CreateUserPropertyAndCaptureContextAsync();
        var workOrderId = await CreateWorkOrderAsync(accessToken, propertyId, status: "Reported");
        var requestId = await SeedMaintenanceRequestLinkedToAsync(
            accountId, propertyId, userId, workOrderId, MaintenanceRequestStatus.InProgress);

        var updateRequest = new { Description = "Job done", Status = "Completed" };

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{workOrderId}", updateRequest, accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var wo = await db.WorkOrders.IgnoreQueryFilters().FirstAsync(w => w.Id == workOrderId);
        wo.Status.Should().Be(WorkOrderStatus.Completed);
        var mr = await db.MaintenanceRequests.IgnoreQueryFilters().FirstAsync(m => m.Id == requestId);
        mr.Status.Should().Be(MaintenanceRequestStatus.Resolved);
    }

    [Fact]
    public async Task UpdateWorkOrder_StatusToCompleted_NoLinkedRequest_StillSucceeds()
    {
        // AC #4 — unlinked WO completion is unaffected.
        var (accessToken, propertyId, _, _) = await CreateUserPropertyAndCaptureContextAsync();
        var workOrderId = await CreateWorkOrderAsync(accessToken, propertyId, status: "Assigned");

        var updateRequest = new { Description = "Job done", Status = "Completed" };

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{workOrderId}", updateRequest, accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var wo = await db.WorkOrders.IgnoreQueryFilters().FirstAsync(w => w.Id == workOrderId);
        wo.Status.Should().Be(WorkOrderStatus.Completed);
    }

    [Fact]
    public async Task UpdateWorkOrder_StatusToAssigned_DoesNotModifyLinkedRequest()
    {
        // AC #2 — non-Completed transitions leave the linked MR untouched.
        var (accessToken, propertyId, accountId, userId) = await CreateUserPropertyAndCaptureContextAsync();
        var workOrderId = await CreateWorkOrderAsync(accessToken, propertyId, status: "Reported");
        var requestId = await SeedMaintenanceRequestLinkedToAsync(
            accountId, propertyId, userId, workOrderId, MaintenanceRequestStatus.InProgress);

        var updateRequest = new { Description = "Reassigning", Status = "Assigned" };

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{workOrderId}", updateRequest, accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var wo = await db.WorkOrders.IgnoreQueryFilters().FirstAsync(w => w.Id == workOrderId);
        wo.Status.Should().Be(WorkOrderStatus.Assigned);
        var mr = await db.MaintenanceRequests.IgnoreQueryFilters().FirstAsync(m => m.Id == requestId);
        mr.Status.Should().Be(MaintenanceRequestStatus.InProgress);
    }

    [Fact]
    public async Task UpdateWorkOrder_NoOpStatusCompleted_DoesNotRetransitionRequest()
    {
        // AC #3 — Completed → Completed is gated out; linked Resolved MR is not touched.
        var (accessToken, propertyId, accountId, userId) = await CreateUserPropertyAndCaptureContextAsync();
        // Create a WO and seed it as Completed directly via DbContext so we don't have to
        // first complete it through the handler (which would itself trigger the sync).
        var workOrderId = await CreateWorkOrderAsync(accessToken, propertyId, status: "Reported");
        var requestId = await SeedMaintenanceRequestLinkedToAsync(
            accountId, propertyId, userId, workOrderId, MaintenanceRequestStatus.Resolved);

        using (var seedScope = _factory.Services.CreateScope())
        {
            var seedDb = seedScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var seedWo = await seedDb.WorkOrders.IgnoreQueryFilters().FirstAsync(w => w.Id == workOrderId);
            seedWo.Status = WorkOrderStatus.Completed;
            await seedDb.SaveChangesAsync();
        }

        var updateRequest = new { Description = "Tag tweak", Status = "Completed" };

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{workOrderId}", updateRequest, accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var wo = await db.WorkOrders.IgnoreQueryFilters().FirstAsync(w => w.Id == workOrderId);
        wo.Status.Should().Be(WorkOrderStatus.Completed);
        wo.Description.Should().Be("Tag tweak");
        var mr = await db.MaintenanceRequests.IgnoreQueryFilters().FirstAsync(m => m.Id == requestId);
        mr.Status.Should().Be(MaintenanceRequestStatus.Resolved);
    }

    [Fact]
    public async Task UpdateWorkOrder_StatusToCompleted_LinkedRequestDismissed_Returns400_RollsBackWO()
    {
        // AC #7 — Dismissed MR cannot transition to Resolved; entire SaveChanges rolls back.
        var (accessToken, propertyId, accountId, userId) = await CreateUserPropertyAndCaptureContextAsync();
        var workOrderId = await CreateWorkOrderAsync(accessToken, propertyId, status: "Assigned");
        var requestId = await SeedMaintenanceRequestLinkedToAsync(
            accountId, propertyId, userId, workOrderId, MaintenanceRequestStatus.Dismissed);

        var updateRequest = new { Description = "Should not stick", Status = "Completed" };

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{workOrderId}", updateRequest, accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Dismissed").And.Contain("Resolved");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var wo = await db.WorkOrders.IgnoreQueryFilters().FirstAsync(w => w.Id == workOrderId);
        wo.Status.Should().Be(WorkOrderStatus.Assigned);
        wo.Description.Should().NotBe("Should not stick");
        var mr = await db.MaintenanceRequests.IgnoreQueryFilters().FirstAsync(m => m.Id == requestId);
        mr.Status.Should().Be(MaintenanceRequestStatus.Dismissed);
    }

    [Fact]
    public async Task UpdateWorkOrder_StatusToCompleted_AsTenant_Returns403()
    {
        // AC #10 — Tenant role cannot reach the sync code path (CanManageWorkOrders denies).
        var ownerEmail = $"owner-{Guid.NewGuid():N}@example.com";
        var (_, ownerAccountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var (ownerToken, _) = await LoginUserAsync(ownerEmail);

        var propertyId = await _factory.CreatePropertyInAccountAsync(ownerAccountId);
        var workOrderId = await CreateWorkOrderAsync(ownerToken, propertyId, status: "Assigned");

        var tenantEmail = $"tenant-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(ownerAccountId, propertyId, tenantEmail);
        var (tenantToken, _) = await LoginUserAsync(tenantEmail);

        var updateRequest = new { Description = "Forbidden", Status = "Completed" };

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{workOrderId}", updateRequest, tenantToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateWorkOrder_StatusToCompleted_LinkedRequestFromDifferentAccount_DoesNotMutateCrossAccount()
    {
        // Multi-tenancy — Owner A's WO completion must not touch Owner B's MR (even though
        // the MR's WorkOrderId is forged to match A's WO id).
        var (ownerAToken, propertyAId, accountAId, userAId) = await CreateUserPropertyAndCaptureContextAsync();
        var workOrderId = await CreateWorkOrderAsync(ownerAToken, propertyAId, status: "Reported");
        var ownAccountRequestId = await SeedMaintenanceRequestLinkedToAsync(
            accountAId, propertyAId, userAId, workOrderId, MaintenanceRequestStatus.InProgress);

        // Owner B (different account) — forge an MR with B's accountId but A's WorkOrderId.
        var ownerBEmail = $"owner-b-{Guid.NewGuid():N}@example.com";
        var (_, accountBId) = await _factory.CreateTestUserAsync(ownerBEmail);
        var propertyBId = await _factory.CreatePropertyInAccountAsync(accountBId);
        var userBId = Guid.NewGuid();
        var crossAccountRequestId = await SeedMaintenanceRequestLinkedToAsync(
            accountBId, propertyBId, userBId, workOrderId, MaintenanceRequestStatus.InProgress);

        var updateRequest = new { Description = "Done", Status = "Completed" };

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{workOrderId}", updateRequest, ownerAToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ownMr = await db.MaintenanceRequests.IgnoreQueryFilters()
            .FirstAsync(m => m.Id == ownAccountRequestId);
        ownMr.Status.Should().Be(MaintenanceRequestStatus.Resolved);
        var crossMr = await db.MaintenanceRequests.IgnoreQueryFilters()
            .FirstAsync(m => m.Id == crossAccountRequestId);
        crossMr.Status.Should().Be(MaintenanceRequestStatus.InProgress);
    }

    // =====================================================
    // DELETE /api/v1/work-orders/{id} Tests
    // =====================================================

    [Fact]
    public async Task DeleteWorkOrder_WithoutAuth_Returns401()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();

        // Act
        var response = await _client.DeleteAsync($"/api/v1/work-orders/{workOrderId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteWorkOrder_ValidId_Returns204()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Work order to delete"
        }, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteWorkOrder_ValidId_SetsDeletedAt()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Work order for soft delete test"
        }, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        var beforeDelete = DateTime.UtcNow;

        // Act
        await DeleteWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", accessToken);

        var afterDelete = DateTime.UtcNow;

        // Assert - verify soft delete in database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var workOrder = await dbContext.WorkOrders
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(w => w.Id == createContent.Id);

        workOrder.Should().NotBeNull();
        workOrder!.DeletedAt.Should().NotBeNull();
        workOrder.DeletedAt.Should().BeAfter(beforeDelete.AddSeconds(-1));
        workOrder.DeletedAt.Should().BeBefore(afterDelete.AddSeconds(1));
    }

    [Fact]
    public async Task DeleteWorkOrder_NonExistentId_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentId = Guid.NewGuid();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/work-orders/{nonExistentId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteWorkOrder_OtherAccountWorkOrder_Returns404()
    {
        // Arrange
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // User 1 creates a work order
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId1,
            Description = "User 1 work order"
        }, accessToken1);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        // Act - User 2 tries to delete User 1's work order
        var response = await DeleteWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteWorkOrder_AlreadyDeleted_Returns404()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Double delete test"
        }, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        // Delete once
        await DeleteWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", accessToken);

        // Act - Try to delete again
        var response = await DeleteWithAuthAsync($"/api/v1/work-orders/{createContent.Id}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteWorkOrder_ExcludedFromGetAll()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Create two work orders
        await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Work order to keep"
        }, accessToken);

        var deleteResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Work order to delete"
        }, accessToken);
        var deleteContent = await deleteResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        // Delete one
        await DeleteWithAuthAsync($"/api/v1/work-orders/{deleteContent!.Id}", accessToken);

        // Act
        var response = await GetWithAuthAsync("/api/v1/work-orders", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<GetAllWorkOrdersResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Description.Should().Be("Work order to keep");
    }

    [Fact]
    public async Task DeleteWorkOrder_GetByIdReturns404()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Work order to delete"
        }, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        // Delete it
        await DeleteWithAuthAsync($"/api/v1/work-orders/{createContent!.Id}", accessToken);

        // Act - Try to get deleted work order
        var response = await GetWithAuthAsync($"/api/v1/work-orders/{createContent.Id}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // GET /api/v1/properties/{propertyId}/work-orders Tests
    // =====================================================

    [Fact]
    public async Task GetWorkOrdersByProperty_WithoutAuth_Returns401()
    {
        // Arrange
        var propertyId = Guid.NewGuid();

        // Act
        var response = await _client.GetAsync($"/api/v1/properties/{propertyId}/work-orders");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetWorkOrdersByProperty_ValidProperty_ReturnsWorkOrders()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Create work orders
        await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Work order 1"
        }, accessToken);

        await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Work order 2"
        }, accessToken);

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/work-orders", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetWorkOrdersByPropertyResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(2);
        content.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetWorkOrdersByProperty_WithLimit_ReturnsLimitedResults()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Create multiple work orders
        for (int i = 1; i <= 5; i++)
        {
            await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
            {
                PropertyId = propertyId,
                Description = $"Work order {i}"
            }, accessToken);
        }

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/work-orders?limit=3", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetWorkOrdersByPropertyResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(3);
        content.TotalCount.Should().Be(5); // Total count should still be 5
    }

    [Fact]
    public async Task GetWorkOrdersByProperty_EmptyProperty_ReturnsEmptyList()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Act - No work orders created
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/work-orders", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetWorkOrdersByPropertyResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().BeEmpty();
        content.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetWorkOrdersByProperty_OtherAccountProperty_ReturnsEmpty()
    {
        // Arrange
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // User 1 creates a work order
        await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId1,
            Description = "User 1 work order"
        }, accessToken1);

        // Act - User 2 tries to get User 1's property work orders
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId1}/work-orders", accessToken2);

        // Assert - Should return empty list (property filter won't match any for User 2)
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetWorkOrdersByPropertyResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().BeEmpty();
    }

    // =====================================================
    // Helper Methods
    // =====================================================

    private async Task<string> GetAccessTokenAsync()
    {
        var email = $"test-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        return accessToken;
    }

    private async Task<(string AccessToken, Guid UserId)> RegisterAndLoginAsync(string email)
    {
        var password = "Test@123456";

        // Create user directly in database
        var (userId, _) = await _factory.CreateTestUserAsync(email, password);

        // Login
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, userId);
    }

    private async Task<(string AccessToken, Guid PropertyId)> CreateUserWithPropertyAsync()
    {
        var email = $"workorder-test-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        // Create a property
        var propertyRequest = new
        {
            Name = "Test Property",
            Street = "123 Test Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };
        var propertyResponse = await PostAsJsonWithAuthAsync("/api/v1/properties", propertyRequest, accessToken);
        var propertyContent = await propertyResponse.Content.ReadFromJsonAsync<CreatePropertyResponse>();

        return (accessToken, propertyContent!.Id);
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> GetWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
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

    /// <summary>
    /// Owner registration helper that ALSO exposes the freshly-created AccountId and UserId
    /// (RegisterAndLoginAsync only returns the access token / user id). Used by the Story 20.10
    /// integration tests which need to seed a linked MaintenanceRequest directly.
    /// </summary>
    private async Task<(string AccessToken, Guid PropertyId, Guid AccountId, Guid UserId)>
        CreateUserPropertyAndCaptureContextAsync()
    {
        var email = $"workorder-sync-{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";
        var (userId, accountId) = await _factory.CreateTestUserAsync(email, password);

        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        var accessToken = loginContent!.AccessToken;

        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        return (accessToken, propertyId, accountId, userId);
    }

    private async Task<(string AccessToken, Guid? UserId)> LoginUserAsync(
        string email, string password = "Test@123456")
    {
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, null);
    }

    private async Task<Guid> CreateWorkOrderAsync(string accessToken, Guid propertyId, string status)
    {
        var createResponse = await PostAsJsonWithAuthAsync(
            "/api/v1/work-orders",
            new { PropertyId = propertyId, Description = "Test WO", Status = status },
            accessToken);
        createResponse.EnsureSuccessStatusCode();
        var content = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();
        return content!.Id;
    }

    /// <summary>
    /// Direct-DB seed of a MaintenanceRequest linked to an existing WorkOrder.
    /// Mirrors <c>MaintenanceRequestsControllerTests.SeedMaintenanceRequestAsync</c>, but
    /// adds the <c>WorkOrderId</c> link so the Story 20.10 sync block sees it.
    /// </summary>
    private async Task<Guid> SeedMaintenanceRequestLinkedToAsync(
        Guid accountId,
        Guid propertyId,
        Guid submittedByUserId,
        Guid workOrderId,
        MaintenanceRequestStatus status)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var entity = new MaintenanceRequest
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = propertyId,
            SubmittedByUserId = submittedByUserId,
            WorkOrderId = workOrderId,
            Description = "seeded for sync test",
            Status = status
        };

        db.MaintenanceRequests.Add(entity);
        await db.SaveChangesAsync();
        return entity.Id;
    }
}

// =====================================================
// Response DTOs
// =====================================================

public record CreateWorkOrderResponse(Guid Id);

public record GetAllWorkOrdersResponse(IReadOnlyList<WorkOrderListItemDto> Items, int TotalCount);

public record GetWorkOrdersByPropertyResponse(IReadOnlyList<WorkOrderListItemDto> Items, int TotalCount);

public record WorkOrderListItemDto(
    Guid Id,
    string Description,
    string Status,
    Guid PropertyId,
    string PropertyName,
    string? CategoryName,
    string? VendorName,
    bool IsDiy,
    DateTime CreatedAt
);

public record WorkOrderDetailDto(
    Guid Id,
    string Description,
    string Status,
    Guid PropertyId,
    string PropertyName,
    Guid? CategoryId,
    string? CategoryName,
    Guid? VendorId,
    string? VendorName,
    bool IsDiy,
    IReadOnlyList<WorkOrderTagDto>? Tags,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record WorkOrderTagDto(Guid Id, string Name);
