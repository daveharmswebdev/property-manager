using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;
using PropertyManager.Domain.ValueObjects;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for GenerateWorkOrderPdfQueryHandler (AC #1-#5).
/// </summary>
public class GenerateWorkOrderPdfHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IIdentityService> _identityServiceMock;
    private readonly Mock<IWorkOrderPdfGenerator> _pdfGeneratorMock;
    private readonly GenerateWorkOrderPdfQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public GenerateWorkOrderPdfHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _identityServiceMock = new Mock<IIdentityService>();
        _pdfGeneratorMock = new Mock<IWorkOrderPdfGenerator>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);

        _handler = new GenerateWorkOrderPdfQueryHandler(
            _dbContextMock.Object,
            _currentUserMock.Object,
            _identityServiceMock.Object,
            _pdfGeneratorMock.Object
        );
    }

    /// <summary>
    /// Test 7.1: Valid work order returns PDF bytes (AC #1, #2).
    /// </summary>
    [Fact]
    public async Task Handle_ValidWorkOrder_ReturnsPdfBytes()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateFullWorkOrder(workOrderId);
        var notes = CreateNotes(workOrderId, 2);
        var expenses = CreateExpenses(workOrderId, 2);

        SetupDbContext(workOrder, notes, expenses);
        SetupIdentityService();
        SetupPdfGenerator();

        var query = new GenerateWorkOrderPdfQuery(workOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.PdfBytes.Should().NotBeNull();
        result.PdfBytes.Should().NotBeEmpty();
        result.FileName.Should().StartWith("WorkOrder-");
        result.FileName.Should().EndWith(".pdf");
        _pdfGeneratorMock.Verify(g => g.Generate(It.IsAny<WorkOrderPdfReportDto>()), Times.Once);
    }

    /// <summary>
    /// Test 7.2: Non-existent work order throws NotFoundException (AC #4).
    /// </summary>
    [Fact]
    public async Task Handle_NonExistentWorkOrder_ThrowsNotFoundException()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        SetupEmptyWorkOrders();

        var query = new GenerateWorkOrderPdfQuery(workOrderId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    /// <summary>
    /// Test 7.3: Work order with no vendor (DIY) generates successfully (AC #2).
    /// </summary>
    [Fact]
    public async Task Handle_DiyWorkOrder_GeneratesSuccessfully()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateDiyWorkOrder(workOrderId);
        var notes = new List<Note>();
        var expenses = new List<Expense>();

        SetupDbContext(workOrder, notes, expenses);
        SetupIdentityService();
        SetupPdfGenerator();

        var query = new GenerateWorkOrderPdfQuery(workOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.PdfBytes.Should().NotBeEmpty();
        _pdfGeneratorMock.Verify(g => g.Generate(It.Is<WorkOrderPdfReportDto>(
            dto => dto.IsDiy == true && dto.Vendor == null)), Times.Once);
    }

    /// <summary>
    /// Test 7.4: Work order with no notes/expenses generates successfully (AC #2).
    /// </summary>
    [Fact]
    public async Task Handle_NoNotesNoExpenses_GeneratesSuccessfully()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateFullWorkOrder(workOrderId);
        var notes = new List<Note>();
        var expenses = new List<Expense>();

        SetupDbContext(workOrder, notes, expenses);
        SetupIdentityService();
        SetupPdfGenerator();

        var query = new GenerateWorkOrderPdfQuery(workOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.PdfBytes.Should().NotBeEmpty();
        _pdfGeneratorMock.Verify(g => g.Generate(It.Is<WorkOrderPdfReportDto>(
            dto => dto.Notes.Count == 0 && dto.Expenses.Count == 0)), Times.Once);
    }

    /// <summary>
    /// Test 7.5: Work order with photos includes photo count note (AC #3).
    /// </summary>
    [Fact]
    public async Task Handle_WorkOrderWithPhotos_IncludesPhotoCount()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateFullWorkOrder(workOrderId);
        workOrder.Photos = new List<WorkOrderPhoto>
        {
            new() { Id = Guid.NewGuid(), WorkOrderId = workOrderId, OriginalFileName = "photo1.jpg", StorageKey = "key1", FileSizeBytes = 1024, ContentType = "image/jpeg" },
            new() { Id = Guid.NewGuid(), WorkOrderId = workOrderId, OriginalFileName = "photo2.jpg", StorageKey = "key2", FileSizeBytes = 2048, ContentType = "image/jpeg" },
            new() { Id = Guid.NewGuid(), WorkOrderId = workOrderId, OriginalFileName = "photo3.jpg", StorageKey = "key3", FileSizeBytes = 3072, ContentType = "image/jpeg" }
        };
        var notes = new List<Note>();
        var expenses = new List<Expense>();

        SetupDbContext(workOrder, notes, expenses);
        SetupIdentityService();
        SetupPdfGenerator();

        var query = new GenerateWorkOrderPdfQuery(workOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        _pdfGeneratorMock.Verify(g => g.Generate(It.Is<WorkOrderPdfReportDto>(
            dto => dto.PhotoCount == 3)), Times.Once);
    }

    /// <summary>
    /// Test 7.6: PDF generator output is valid (non-empty byte array).
    /// </summary>
    [Fact]
    public async Task Handle_PdfGeneratorOutput_IsNonEmptyByteArray()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateFullWorkOrder(workOrderId);
        var expectedPdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D }; // %PDF-

        SetupDbContext(workOrder, new List<Note>(), new List<Expense>());
        SetupIdentityService();
        _pdfGeneratorMock.Setup(g => g.Generate(It.IsAny<WorkOrderPdfReportDto>()))
            .Returns(expectedPdfBytes);

        var query = new GenerateWorkOrderPdfQuery(workOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.PdfBytes.Should().HaveCount(5);
        result.PdfBytes.Should().BeEquivalentTo(expectedPdfBytes);
    }

    [Fact]
    public async Task Handle_MapsVendorContactInfo_Correctly()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateFullWorkOrder(workOrderId);

        SetupDbContext(workOrder, new List<Note>(), new List<Expense>());
        SetupIdentityService();
        SetupPdfGenerator();

        var query = new GenerateWorkOrderPdfQuery(workOrderId);

        // Act
        await _handler.Handle(query, CancellationToken.None);

        // Assert
        _pdfGeneratorMock.Verify(g => g.Generate(It.Is<WorkOrderPdfReportDto>(dto =>
            dto.Vendor != null &&
            dto.Vendor.Name == "John Doe" &&
            dto.Vendor.Phone == "555-1234" &&
            dto.Vendor.Email == "john@example.com" &&
            dto.Vendor.TradeTags == "Plumbing, Electrical"
        )), Times.Once);
    }

    [Fact]
    public async Task Handle_MapsPropertyAddress_Correctly()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateFullWorkOrder(workOrderId);

        SetupDbContext(workOrder, new List<Note>(), new List<Expense>());
        SetupIdentityService();
        SetupPdfGenerator();

        var query = new GenerateWorkOrderPdfQuery(workOrderId);

        // Act
        await _handler.Handle(query, CancellationToken.None);

        // Assert
        _pdfGeneratorMock.Verify(g => g.Generate(It.Is<WorkOrderPdfReportDto>(dto =>
            dto.PropertyName == "Oak Street Duplex" &&
            dto.PropertyAddress == "123 Oak St, Austin, TX 78701"
        )), Times.Once);
    }

    [Fact]
    public async Task Handle_FileNameSanitized_Correctly()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateFullWorkOrder(workOrderId);

        SetupDbContext(workOrder, new List<Note>(), new List<Expense>());
        SetupIdentityService();
        SetupPdfGenerator();

        var query = new GenerateWorkOrderPdfQuery(workOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.FileName.Should().Contain("Oak-Street-Duplex");
        result.FileName.Should().NotContainAny("&", "#", "%");
    }

    // --- Helper Methods ---

    private WorkOrder CreateFullWorkOrder(Guid workOrderId)
    {
        var vendor = new Vendor
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            FirstName = "John",
            LastName = "Doe",
            Phones = new List<PhoneNumber> { new("555-1234", "Mobile") },
            Emails = new List<string> { "john@example.com" },
            TradeTagAssignments = new List<VendorTradeTagAssignment>
            {
                new() { TradeTag = new VendorTradeTag { Name = "Plumbing" } },
                new() { TradeTag = new VendorTradeTag { Name = "Electrical" } }
            }
        };

        var category = new ExpenseCategory { Id = Guid.NewGuid(), Name = "Maintenance" };
        var tag1 = new WorkOrderTag { Id = Guid.NewGuid(), Name = "Urgent" };
        var tag2 = new WorkOrderTag { Id = Guid.NewGuid(), Name = "Plumbing" };

        return new WorkOrder
        {
            Id = workOrderId,
            AccountId = _testAccountId,
            CreatedByUserId = _testUserId,
            Description = "Fix leaking faucet in kitchen",
            Status = WorkOrderStatus.Assigned,
            CreatedAt = new DateTime(2026, 1, 15, 10, 0, 0, DateTimeKind.Utc),
            Property = new Property
            {
                Id = Guid.NewGuid(),
                AccountId = _testAccountId,
                Name = "Oak Street Duplex",
                Street = "123 Oak St",
                City = "Austin",
                State = "TX",
                ZipCode = "78701"
            },
            Vendor = vendor,
            VendorId = vendor.Id,
            Category = category,
            CategoryId = category.Id,
            TagAssignments = new List<WorkOrderTagAssignment>
            {
                new() { Tag = tag1 },
                new() { Tag = tag2 }
            },
            Photos = new List<WorkOrderPhoto>()
        };
    }

    private WorkOrder CreateDiyWorkOrder(Guid workOrderId)
    {
        return new WorkOrder
        {
            Id = workOrderId,
            AccountId = _testAccountId,
            CreatedByUserId = _testUserId,
            Description = "Paint bedroom walls",
            Status = WorkOrderStatus.Reported,
            CreatedAt = new DateTime(2026, 2, 1, 10, 0, 0, DateTimeKind.Utc),
            VendorId = null,
            Vendor = null,
            Property = new Property
            {
                Id = Guid.NewGuid(),
                AccountId = _testAccountId,
                Name = "Elm House",
                Street = "456 Elm St",
                City = "Austin",
                State = "TX",
                ZipCode = "78702"
            },
            TagAssignments = new List<WorkOrderTagAssignment>(),
            Photos = new List<WorkOrderPhoto>()
        };
    }

    private List<Note> CreateNotes(Guid workOrderId, int count)
    {
        return Enumerable.Range(1, count).Select(i => new Note
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            EntityType = "WorkOrder",
            EntityId = workOrderId,
            Content = $"Note {i} content",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow.AddHours(-count + i)
        }).ToList();
    }

    private List<Expense> CreateExpenses(Guid workOrderId, int count)
    {
        return Enumerable.Range(1, count).Select(i => new Expense
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = Guid.NewGuid(),
            WorkOrderId = workOrderId,
            Amount = 50.00m * i,
            Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-i)),
            Description = $"Expense {i}",
            CategoryId = Guid.NewGuid(),
            Category = new ExpenseCategory { Name = "Parts" },
            CreatedByUserId = _testUserId
        }).ToList();
    }

    private void SetupDbContext(WorkOrder workOrder, List<Note> notes, List<Expense> expenses)
    {
        var workOrders = new List<WorkOrder> { workOrder };
        var workOrdersMock = workOrders.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(workOrdersMock.Object);

        var notesMock = notes.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Notes).Returns(notesMock.Object);

        var expensesMock = expenses.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Expenses).Returns(expensesMock.Object);
    }

    private void SetupEmptyWorkOrders()
    {
        var workOrders = new List<WorkOrder>();
        var workOrdersMock = workOrders.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(workOrdersMock.Object);
    }

    private void SetupIdentityService()
    {
        _identityServiceMock
            .Setup(x => x.GetUserDisplayNamesAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, string> { { _testUserId, "Test User" } });
    }

    private void SetupPdfGenerator()
    {
        _pdfGeneratorMock
            .Setup(g => g.Generate(It.IsAny<WorkOrderPdfReportDto>()))
            .Returns(new byte[] { 0x25, 0x50, 0x44, 0x46 }); // PDF header bytes
    }
}
