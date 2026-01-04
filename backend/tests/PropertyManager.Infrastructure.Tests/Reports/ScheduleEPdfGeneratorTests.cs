using FluentAssertions;
using PropertyManager.Application.Reports;
using PropertyManager.Infrastructure.Reports;
using QuestPDF.Infrastructure;

namespace PropertyManager.Infrastructure.Tests.Reports;

/// <summary>
/// Unit tests for ScheduleEPdfGenerator (AC-6.1.4).
/// </summary>
public class ScheduleEPdfGeneratorTests
{
    private readonly ScheduleEPdfGenerator _generator;

    public ScheduleEPdfGeneratorTests()
    {
        // Configure QuestPDF license for tests
        QuestPDF.Settings.License = LicenseType.Community;
        _generator = new ScheduleEPdfGenerator();
    }

    [Fact]
    public void Generate_ValidReport_ProducesPdfBytes()
    {
        // Arrange
        var report = CreateTestReport();

        // Act
        var result = _generator.Generate(report);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBeEmpty();
    }

    [Fact]
    public void Generate_ValidReport_StartsWithPdfHeader()
    {
        // Arrange
        var report = CreateTestReport();

        // Act
        var result = _generator.Generate(report);

        // Assert - PDF files start with "%PDF-"
        var header = System.Text.Encoding.ASCII.GetString(result, 0, 5);
        header.Should().Be("%PDF-");
    }

    [Fact]
    public void Generate_ReportWithAllCategories_ProducesPdf()
    {
        // Arrange
        var report = CreateReportWithAllCategories();

        // Act
        var result = _generator.Generate(report);

        // Assert
        result.Should().NotBeNull();
        result.Length.Should().BeGreaterThan(1000); // Reasonable size for PDF
    }

    [Fact]
    public void Generate_ReportWithNoExpenses_ProducesPdf()
    {
        // Arrange
        var report = new ScheduleEReportDto(
            PropertyId: Guid.NewGuid(),
            PropertyName: "Empty Property",
            PropertyAddress: "123 Main St, Austin, TX 78701",
            TaxYear: 2024,
            TotalIncome: 0,
            ExpensesByCategory: new List<ScheduleELineItemDto>(),
            TotalExpenses: 0,
            NetIncome: 0,
            GeneratedAt: DateTime.UtcNow
        );

        // Act
        var result = _generator.Generate(report);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBeEmpty();
    }

    [Fact]
    public void Generate_ReportWithNegativeNetIncome_ProducesPdf()
    {
        // Arrange
        var report = new ScheduleEReportDto(
            PropertyId: Guid.NewGuid(),
            PropertyName: "Money Pit",
            PropertyAddress: "123 Main St, Austin, TX 78701",
            TaxYear: 2024,
            TotalIncome: 1000m,
            ExpensesByCategory: new List<ScheduleELineItemDto>
            {
                new ScheduleELineItemDto(14, "Repairs", 5000m)
            },
            TotalExpenses: 5000m,
            NetIncome: -4000m,
            GeneratedAt: DateTime.UtcNow
        );

        // Act
        var result = _generator.Generate(report);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBeEmpty();
    }

    [Fact]
    public void Generate_ReportWithLongPropertyName_ProducesPdf()
    {
        // Arrange
        var report = new ScheduleEReportDto(
            PropertyId: Guid.NewGuid(),
            PropertyName: "This Is A Very Long Property Name That Might Cause Layout Issues",
            PropertyAddress: "123 Main St, Austin, TX 78701",
            TaxYear: 2024,
            TotalIncome: 1500m,
            ExpensesByCategory: new List<ScheduleELineItemDto>
            {
                new ScheduleELineItemDto(14, "Repairs", 500m)
            },
            TotalExpenses: 500m,
            NetIncome: 1000m,
            GeneratedAt: DateTime.UtcNow
        );

        // Act
        var result = _generator.Generate(report);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBeEmpty();
    }

    [Fact]
    public void Generate_ReportWithLargeAmounts_ProducesPdf()
    {
        // Arrange
        var report = new ScheduleEReportDto(
            PropertyId: Guid.NewGuid(),
            PropertyName: "Luxury Property",
            PropertyAddress: "1 Billionaire Way, Beverly Hills, CA 90210",
            TaxYear: 2024,
            TotalIncome: 1_000_000m,
            ExpensesByCategory: new List<ScheduleELineItemDto>
            {
                new ScheduleELineItemDto(12, "Mortgage Interest", 500_000m),
                new ScheduleELineItemDto(16, "Taxes", 150_000m),
                new ScheduleELineItemDto(9, "Insurance", 50_000m)
            },
            TotalExpenses: 700_000m,
            NetIncome: 300_000m,
            GeneratedAt: DateTime.UtcNow
        );

        // Act
        var result = _generator.Generate(report);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBeEmpty();
    }

    private ScheduleEReportDto CreateTestReport()
    {
        return new ScheduleEReportDto(
            PropertyId: Guid.NewGuid(),
            PropertyName: "Test Property",
            PropertyAddress: "123 Main St, Austin, TX 78701",
            TaxYear: 2024,
            TotalIncome: 18000m,
            ExpensesByCategory: new List<ScheduleELineItemDto>
            {
                new ScheduleELineItemDto(14, "Repairs", 500m),
                new ScheduleELineItemDto(9, "Insurance", 1200m),
                new ScheduleELineItemDto(17, "Utilities", 300m)
            },
            TotalExpenses: 2000m,
            NetIncome: 16000m,
            GeneratedAt: DateTime.UtcNow
        );
    }

    private ScheduleEReportDto CreateReportWithAllCategories()
    {
        var allCategories = new List<ScheduleELineItemDto>
        {
            new ScheduleELineItemDto(5, "Advertising", 100m),
            new ScheduleELineItemDto(6, "Auto and Travel", 200m),
            new ScheduleELineItemDto(7, "Cleaning and Maintenance", 300m),
            new ScheduleELineItemDto(8, "Commissions", 0m),
            new ScheduleELineItemDto(9, "Insurance", 1200m),
            new ScheduleELineItemDto(10, "Legal and Professional Fees", 500m),
            new ScheduleELineItemDto(11, "Management Fees", 1800m),
            new ScheduleELineItemDto(12, "Mortgage Interest", 8000m),
            new ScheduleELineItemDto(13, "Other Interest", 0m),
            new ScheduleELineItemDto(14, "Repairs", 1500m),
            new ScheduleELineItemDto(15, "Supplies", 100m),
            new ScheduleELineItemDto(16, "Taxes", 3000m),
            new ScheduleELineItemDto(17, "Utilities", 2400m),
            new ScheduleELineItemDto(18, "Depreciation", 5000m),
            new ScheduleELineItemDto(19, "Other", 50m)
        };

        return new ScheduleEReportDto(
            PropertyId: Guid.NewGuid(),
            PropertyName: "Full Report Property",
            PropertyAddress: "456 Test Ave, Dallas, TX 75201",
            TaxYear: 2024,
            TotalIncome: 36000m,
            ExpensesByCategory: allCategories,
            TotalExpenses: allCategories.Sum(c => c.Amount),
            NetIncome: 36000m - allCategories.Sum(c => c.Amount),
            GeneratedAt: DateTime.UtcNow
        );
    }
}
