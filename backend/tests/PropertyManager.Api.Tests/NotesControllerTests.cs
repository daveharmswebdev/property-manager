using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for NotesController (AC #4, #5, #6, #7, #8).
/// Tests CRUD operations for notes including validation, authorization, and multi-tenancy.
/// </summary>
public class NotesControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public NotesControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // GET /api/v1/notes Tests (AC #4, #8)
    // =====================================================

    [Fact]
    public async Task GetNotes_Unauthorized_Returns401()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/notes?entityType=WorkOrder&entityId=" + Guid.NewGuid());

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetNotes_ReturnsEmptyForNoNotes()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var entityId = Guid.NewGuid();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/notes?entityType=WorkOrder&entityId={entityId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<GetNotesResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().BeEmpty();
        content.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetNotes_ReturnsNotesForEntity()
    {
        // Arrange
        var (accessToken, workOrderId) = await CreateUserWithWorkOrderAsync();

        // Create a note
        var createRequest = new
        {
            EntityType = "WorkOrder",
            EntityId = workOrderId,
            Content = "Test note for work order"
        };
        await PostAsJsonWithAuthAsync("/api/v1/notes", createRequest, accessToken);

        // Act
        var response = await GetWithAuthAsync($"/api/v1/notes?entityType=WorkOrder&entityId={workOrderId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<GetNotesResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(1);
        content.TotalCount.Should().Be(1);
        content.Items[0].Content.Should().Be("Test note for work order");
    }

    [Fact]
    public async Task GetNotes_SortsByCreatedAtDesc()
    {
        // Arrange
        var (accessToken, workOrderId) = await CreateUserWithWorkOrderAsync();

        // Create notes
        await PostAsJsonWithAuthAsync("/api/v1/notes", new
        {
            EntityType = "WorkOrder",
            EntityId = workOrderId,
            Content = "First note"
        }, accessToken);

        await Task.Delay(100); // Small delay to ensure different timestamps

        await PostAsJsonWithAuthAsync("/api/v1/notes", new
        {
            EntityType = "WorkOrder",
            EntityId = workOrderId,
            Content = "Second note"
        }, accessToken);

        // Act
        var response = await GetWithAuthAsync($"/api/v1/notes?entityType=WorkOrder&entityId={workOrderId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<GetNotesResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(2);
        content.Items[0].Content.Should().Be("Second note"); // Newest first
        content.Items[1].Content.Should().Be("First note");
    }

    // =====================================================
    // POST /api/v1/notes Tests (AC #5, #7)
    // =====================================================

    [Fact]
    public async Task CreateNote_Unauthorized_Returns401()
    {
        // Arrange
        var request = new
        {
            EntityType = "WorkOrder",
            EntityId = Guid.NewGuid(),
            Content = "Test note"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/notes", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateNote_ValidRequest_Returns201WithId()
    {
        // Arrange
        var (accessToken, workOrderId) = await CreateUserWithWorkOrderAsync();

        var request = new
        {
            EntityType = "WorkOrder",
            EntityId = workOrderId,
            Content = "Created note content"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/notes", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var content = await response.Content.ReadFromJsonAsync<CreateNoteResponse>();
        content.Should().NotBeNull();
        content!.Id.Should().NotBe(Guid.Empty);

        // Verify Location header
        response.Headers.Location.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateNote_EmptyContent_Returns400()
    {
        // Arrange (AC #7)
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            EntityType = "WorkOrder",
            EntityId = Guid.NewGuid(),
            Content = ""
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/notes", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateNote_InvalidEntityType_Returns400()
    {
        // Arrange (AC #7)
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            EntityType = "InvalidType",
            EntityId = Guid.NewGuid(),
            Content = "Valid content"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/notes", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateNote_SetsTimestamps()
    {
        // Arrange
        var (accessToken, workOrderId) = await CreateUserWithWorkOrderAsync();

        var request = new
        {
            EntityType = "WorkOrder",
            EntityId = workOrderId,
            Content = "Timestamp test note"
        };

        var beforeCreate = DateTime.UtcNow;

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/notes", request, accessToken);
        var content = await response.Content.ReadFromJsonAsync<CreateNoteResponse>();

        var afterCreate = DateTime.UtcNow;

        // Assert - verify in database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var note = await dbContext.Notes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(n => n.Id == content!.Id);

        note.Should().NotBeNull();
        note!.CreatedAt.Should().BeAfter(beforeCreate.AddSeconds(-1));
        note.CreatedAt.Should().BeBefore(afterCreate.AddSeconds(1));
    }

    // =====================================================
    // DELETE /api/v1/notes/{id} Tests (AC #6)
    // =====================================================

    [Fact]
    public async Task DeleteNote_Unauthorized_Returns401()
    {
        // Act
        var response = await _client.DeleteAsync($"/api/v1/notes/{Guid.NewGuid()}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteNote_ExistingNote_Returns204()
    {
        // Arrange
        var (accessToken, workOrderId) = await CreateUserWithWorkOrderAsync();

        // Create a note
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/notes", new
        {
            EntityType = "WorkOrder",
            EntityId = workOrderId,
            Content = "Note to delete"
        }, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateNoteResponse>();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/notes/{createContent!.Id}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteNote_SetsDeletedAt()
    {
        // Arrange
        var (accessToken, workOrderId) = await CreateUserWithWorkOrderAsync();

        // Create a note
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/notes", new
        {
            EntityType = "WorkOrder",
            EntityId = workOrderId,
            Content = "Note for soft delete test"
        }, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateNoteResponse>();

        var beforeDelete = DateTime.UtcNow;

        // Act
        await DeleteWithAuthAsync($"/api/v1/notes/{createContent!.Id}", accessToken);

        var afterDelete = DateTime.UtcNow;

        // Assert - verify soft delete in database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var note = await dbContext.Notes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(n => n.Id == createContent.Id);

        note.Should().NotBeNull();
        note!.DeletedAt.Should().NotBeNull();
        note.DeletedAt.Should().BeAfter(beforeDelete.AddSeconds(-1));
        note.DeletedAt.Should().BeBefore(afterDelete.AddSeconds(1));
    }

    [Fact]
    public async Task DeleteNote_NonExistent_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentId = Guid.NewGuid();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/notes/{nonExistentId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteNote_ExcludedFromGetResults()
    {
        // Arrange
        var (accessToken, workOrderId) = await CreateUserWithWorkOrderAsync();

        // Create two notes
        await PostAsJsonWithAuthAsync("/api/v1/notes", new
        {
            EntityType = "WorkOrder",
            EntityId = workOrderId,
            Content = "Note to keep"
        }, accessToken);

        var deleteResponse = await PostAsJsonWithAuthAsync("/api/v1/notes", new
        {
            EntityType = "WorkOrder",
            EntityId = workOrderId,
            Content = "Note to delete"
        }, accessToken);
        var deleteContent = await deleteResponse.Content.ReadFromJsonAsync<CreateNoteResponse>();

        // Delete one
        await DeleteWithAuthAsync($"/api/v1/notes/{deleteContent!.Id}", accessToken);

        // Act
        var response = await GetWithAuthAsync($"/api/v1/notes?entityType=WorkOrder&entityId={workOrderId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<GetNotesResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Content.Should().Be("Note to keep");
    }

    [Fact]
    public async Task CrossAccountAccess_IsBlocked()
    {
        // Arrange - Create note with user 1
        var (accessToken1, workOrderId1) = await CreateUserWithWorkOrderAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // User 1 creates a note
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/notes", new
        {
            EntityType = "WorkOrder",
            EntityId = workOrderId1,
            Content = "User 1 note"
        }, accessToken1);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateNoteResponse>();

        // Act - User 2 tries to get notes for User 1's work order
        var getResponse = await GetWithAuthAsync($"/api/v1/notes?entityType=WorkOrder&entityId={workOrderId1}", accessToken2);

        // Assert - Should return empty (not see User 1's notes)
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var getContent = await getResponse.Content.ReadFromJsonAsync<GetNotesResponse>();
        getContent!.Items.Should().BeEmpty();

        // Act - User 2 tries to delete User 1's note
        var deleteResponse = await DeleteWithAuthAsync($"/api/v1/notes/{createContent!.Id}", accessToken2);

        // Assert - Should return 404 (not found, not forbidden)
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
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

    private async Task<(string AccessToken, Guid WorkOrderId)> CreateUserWithWorkOrderAsync()
    {
        var email = $"notes-test-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        // Create a property first
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

        // Create a work order
        var workOrderRequest = new
        {
            PropertyId = propertyContent!.Id,
            Description = "Test work order"
        };
        var workOrderResponse = await PostAsJsonWithAuthAsync("/api/v1/work-orders", workOrderRequest, accessToken);
        var workOrderContent = await workOrderResponse.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();

        return (accessToken, workOrderContent!.Id);
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

    private async Task<HttpResponseMessage> DeleteWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }
}

// =====================================================
// Response DTOs (Note-specific, others are in shared files)
// =====================================================

public record CreateNoteResponse(Guid Id);

public record GetNotesResponse(IReadOnlyList<NoteListItemDto> Items, int TotalCount);

public record NoteListItemDto(
    Guid Id,
    string EntityType,
    Guid EntityId,
    string Content,
    Guid CreatedByUserId,
    string CreatedByUserName,
    DateTime CreatedAt
);
