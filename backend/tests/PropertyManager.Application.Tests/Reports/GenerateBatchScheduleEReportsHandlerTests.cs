using FluentAssertions;
using FluentValidation;
using MediatR;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Reports;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Reports;

/// <summary>
/// Unit tests for GenerateBatchScheduleEReportsHandler (AC-6.2.1, AC-6.2.3, AC-6.2.6, AC-6.2.7).
/// </summary>
public class GenerateBatchScheduleEReportsHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IMediator> _mediatorMock;
    private readonly Mock<IScheduleEPdfGenerator> _pdfGeneratorMock;
    private readonly GenerateBatchScheduleEReportsHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public GenerateBatchScheduleEReportsHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _mediatorMock = new Mock<IMediator>();
        _pdfGeneratorMock = new Mock<IScheduleEPdfGenerator>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);

        _handler = new GenerateBatchScheduleEReportsHandler(
            _dbContextMock.Object,
            _currentUserMock.Object,
            _mediatorMock.Object,
            _pdfGeneratorMock.Object
        );
    }

    [Fact]
    public async Task Handle_MultipleProperties_GeneratesAllReports()
    {
        // Arrange
        var year = 2024;
        var property1 = CreateProperty("Property 1");
        var property2 = CreateProperty("Property 2");
        var property3 = CreateProperty("Property 3");

        var propertyIds = new List<Guid> { property1.Id, property2.Id, property3.Id };
        SetupDbContext(new[] { property1, property2, property3 });
        SetupMediatorToReturnReport(property1.Id, year, 1500m, 500m);
        SetupMediatorToReturnReport(property2.Id, year, 2000m, 800m);
        SetupMediatorToReturnReport(property3.Id, year, 1000m, 300m);
        SetupPdfGenerator();

        var query = new GenerateBatchScheduleEReportsQuery(propertyIds, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Year.Should().Be(year);
        result.Results.Should().HaveCount(3);
        result.Results.Should().AllSatisfy(r => r.Success.Should().BeTrue());
        result.Results.Should().AllSatisfy(r => r.PdfBytes.Should().NotBeNull());
    }

    [Fact]
    public async Task Handle_PropertyWithNoData_GeneratesZeroReport()
    {
        // Arrange
        var year = 2024;
        var property = CreateProperty("Empty Property");
        var propertyIds = new List<Guid> { property.Id };

        SetupDbContext(new[] { property });
        SetupMediatorToReturnReport(property.Id, year, 0m, 0m);
        SetupPdfGenerator();

        var query = new GenerateBatchScheduleEReportsQuery(propertyIds, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Results.Should().HaveCount(1);
        result.Results[0].Success.Should().BeTrue();
        result.Results[0].HasData.Should().BeFalse();
        result.Results[0].PdfBytes.Should().NotBeNull();
    }

    [Fact]
    public async Task Handle_PropertyWithData_HasDataIsTrue()
    {
        // Arrange
        var year = 2024;
        var property = CreateProperty("Active Property");
        var propertyIds = new List<Guid> { property.Id };

        SetupDbContext(new[] { property });
        SetupMediatorToReturnReport(property.Id, year, 1500m, 500m);
        SetupPdfGenerator();

        var query = new GenerateBatchScheduleEReportsQuery(propertyIds, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Results.Should().HaveCount(1);
        result.Results[0].HasData.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_OnePropertyFails_OthersSucceed()
    {
        // Arrange
        var year = 2024;
        var property1 = CreateProperty("Property 1");
        var property2 = CreateProperty("Property 2");

        var propertyIds = new List<Guid> { property1.Id, property2.Id };
        SetupDbContext(new[] { property1, property2 });
        SetupMediatorToReturnReport(property1.Id, year, 1500m, 500m);
        SetupMediatorToThrowException(property2.Id, year, new InvalidOperationException("Generation failed"));
        SetupPdfGenerator();

        var query = new GenerateBatchScheduleEReportsQuery(propertyIds, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Results.Should().HaveCount(2);

        var successResult = result.Results.First(r => r.PropertyId == property1.Id);
        successResult.Success.Should().BeTrue();
        successResult.PdfBytes.Should().NotBeNull();

        var failedResult = result.Results.First(r => r.PropertyId == property2.Id);
        failedResult.Success.Should().BeFalse();
        failedResult.ErrorMessage.Should().Be("Generation failed");
        failedResult.PdfBytes.Should().BeNull();
    }

    [Fact]
    public async Task Handle_EmptyPropertyIds_ThrowsValidationException()
    {
        // Arrange
        var query = new GenerateBatchScheduleEReportsQuery(new List<Guid>(), 2024);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*At least one property ID*");
    }

    [Fact]
    public async Task Handle_PropertyNotOwnedByUser_ThrowsValidationException()
    {
        // Arrange
        var year = 2024;
        var propertyId = Guid.NewGuid();
        SetupDbContext(Array.Empty<Property>()); // Empty - no properties for this user

        var query = new GenerateBatchScheduleEReportsQuery(new List<Guid> { propertyId }, year);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*not found or do not belong to your account*");
    }

    [Fact]
    public async Task Handle_ReturnsCorrectPropertyNames()
    {
        // Arrange
        var year = 2024;
        var property1 = CreateProperty("First Property");
        var property2 = CreateProperty("Second Property");
        var propertyIds = new List<Guid> { property1.Id, property2.Id };

        SetupDbContext(new[] { property1, property2 });
        SetupMediatorToReturnReport(property1.Id, year, 1000m, 500m);
        SetupMediatorToReturnReport(property2.Id, year, 2000m, 800m);
        SetupPdfGenerator();

        var query = new GenerateBatchScheduleEReportsQuery(propertyIds, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Results.Should().Contain(r => r.PropertyName == "First Property");
        result.Results.Should().Contain(r => r.PropertyName == "Second Property");
    }

    [Fact]
    public async Task Handle_SetsGeneratedAtTimestamp()
    {
        // Arrange
        var year = 2024;
        var property = CreateProperty("Test Property");
        var propertyIds = new List<Guid> { property.Id };
        var beforeTest = DateTime.UtcNow;

        SetupDbContext(new[] { property });
        SetupMediatorToReturnReport(property.Id, year, 1000m, 500m);
        SetupPdfGenerator();

        var query = new GenerateBatchScheduleEReportsQuery(propertyIds, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.GeneratedAt.Should().BeOnOrAfter(beforeTest);
        result.GeneratedAt.Should().BeOnOrBefore(DateTime.UtcNow);
    }

    private Property CreateProperty(string name)
    {
        return new Property
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            Name = name,
            Street = "123 Test St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };
    }

    private void SetupDbContext(IEnumerable<Property> properties)
    {
        var propertiesMock = properties.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(propertiesMock.Object);
    }

    private void SetupMediatorToReturnReport(Guid propertyId, int year, decimal income, decimal expenses)
    {
        var report = new ScheduleEReportDto(
            PropertyId: propertyId,
            PropertyName: "Test Property",
            PropertyAddress: "123 Test St, Austin, TX",
            TaxYear: year,
            TotalIncome: income,
            ExpensesByCategory: new List<ScheduleELineItemDto>(),
            TotalExpenses: expenses,
            NetIncome: income - expenses,
            GeneratedAt: DateTime.UtcNow
        );

        _mediatorMock
            .Setup(m => m.Send(
                It.Is<GenerateScheduleEReportQuery>(q => q.PropertyId == propertyId && q.Year == year),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(report);
    }

    private void SetupMediatorToThrowException(Guid propertyId, int year, Exception exception)
    {
        _mediatorMock
            .Setup(m => m.Send(
                It.Is<GenerateScheduleEReportQuery>(q => q.PropertyId == propertyId && q.Year == year),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(exception);
    }

    private void SetupPdfGenerator()
    {
        _pdfGeneratorMock
            .Setup(g => g.Generate(It.IsAny<ScheduleEReportDto>()))
            .Returns(new byte[] { 0x25, 0x50, 0x44, 0x46 }); // PDF header
    }
}
