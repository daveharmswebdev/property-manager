using System.IO.Compression;
using FluentAssertions;
using PropertyManager.Infrastructure.Reports;

namespace PropertyManager.Infrastructure.Tests.Reports;

/// <summary>
/// Unit tests for ReportBundleService (AC-6.2.4, AC-6.2.5).
/// </summary>
public class ReportBundleServiceTests
{
    private readonly ReportBundleService _service;

    public ReportBundleServiceTests()
    {
        _service = new ReportBundleService();
    }

    [Fact]
    public void CreateZipBundle_MultipleFiles_CreatesValidZip()
    {
        // Arrange
        var files = new List<(string FileName, byte[] Content)>
        {
            ("Schedule-E-Property1-2024.pdf", CreateFakePdf("Property1")),
            ("Schedule-E-Property2-2024.pdf", CreateFakePdf("Property2")),
            ("Schedule-E-Property3-2024.pdf", CreateFakePdf("Property3"))
        };

        // Act
        var result = _service.CreateZipBundle(files);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBeEmpty();

        // Verify it's a valid ZIP by opening it
        using var memoryStream = new MemoryStream(result);
        using var archive = new ZipArchive(memoryStream, ZipArchiveMode.Read);
        archive.Entries.Should().HaveCount(3);
    }

    [Fact]
    public void CreateZipBundle_MultipleFiles_ContainsCorrectFilenames()
    {
        // Arrange
        var files = new List<(string FileName, byte[] Content)>
        {
            ("Schedule-E-Property1-2024.pdf", CreateFakePdf("Property1")),
            ("Schedule-E-Property2-2024.pdf", CreateFakePdf("Property2"))
        };

        // Act
        var result = _service.CreateZipBundle(files);

        // Assert
        using var memoryStream = new MemoryStream(result);
        using var archive = new ZipArchive(memoryStream, ZipArchiveMode.Read);

        var entryNames = archive.Entries.Select(e => e.Name).ToList();
        entryNames.Should().Contain("Schedule-E-Property1-2024.pdf");
        entryNames.Should().Contain("Schedule-E-Property2-2024.pdf");
    }

    [Fact]
    public void CreateZipBundle_MultipleFiles_PreservesFileContent()
    {
        // Arrange
        var content1 = CreateFakePdf("Property1");
        var content2 = CreateFakePdf("Property2");
        var files = new List<(string FileName, byte[] Content)>
        {
            ("file1.pdf", content1),
            ("file2.pdf", content2)
        };

        // Act
        var result = _service.CreateZipBundle(files);

        // Assert
        using var memoryStream = new MemoryStream(result);
        using var archive = new ZipArchive(memoryStream, ZipArchiveMode.Read);

        var entry1 = archive.GetEntry("file1.pdf");
        entry1.Should().NotBeNull();
        using var stream1 = entry1!.Open();
        using var reader1 = new MemoryStream();
        stream1.CopyTo(reader1);
        reader1.ToArray().Should().BeEquivalentTo(content1);

        var entry2 = archive.GetEntry("file2.pdf");
        entry2.Should().NotBeNull();
        using var stream2 = entry2!.Open();
        using var reader2 = new MemoryStream();
        stream2.CopyTo(reader2);
        reader2.ToArray().Should().BeEquivalentTo(content2);
    }

    [Fact]
    public void CreateZipBundle_SingleFile_CreatesValidZip()
    {
        // Arrange
        var files = new List<(string FileName, byte[] Content)>
        {
            ("Schedule-E-Property-2024.pdf", CreateFakePdf("Property"))
        };

        // Act
        var result = _service.CreateZipBundle(files);

        // Assert
        result.Should().NotBeNull();
        result.Should().NotBeEmpty();

        using var memoryStream = new MemoryStream(result);
        using var archive = new ZipArchive(memoryStream, ZipArchiveMode.Read);
        archive.Entries.Should().HaveCount(1);
    }

    [Fact]
    public void CreateZipBundle_EmptyFiles_CreatesEmptyZip()
    {
        // Arrange
        var files = new List<(string FileName, byte[] Content)>();

        // Act
        var result = _service.CreateZipBundle(files);

        // Assert
        result.Should().NotBeNull();

        using var memoryStream = new MemoryStream(result);
        using var archive = new ZipArchive(memoryStream, ZipArchiveMode.Read);
        archive.Entries.Should().BeEmpty();
    }

    [Fact]
    public void CreateZipBundle_LargeFile_CreatesCompressedZip()
    {
        // Arrange
        var largeContent = new byte[100_000]; // 100KB of zeros - highly compressible
        Array.Fill(largeContent, (byte)0x00);

        var files = new List<(string FileName, byte[] Content)>
        {
            ("large-file.pdf", largeContent)
        };

        // Act
        var result = _service.CreateZipBundle(files);

        // Assert
        result.Should().NotBeNull();
        result.Length.Should().BeLessThan(largeContent.Length); // ZIP should compress zeros well
    }

    [Fact]
    public void CreateZipBundle_FilenameWithSpaces_CreatesValidZip()
    {
        // Arrange
        var files = new List<(string FileName, byte[] Content)>
        {
            ("Schedule-E-Main House-2024.pdf", CreateFakePdf("Main House"))
        };

        // Act
        var result = _service.CreateZipBundle(files);

        // Assert
        using var memoryStream = new MemoryStream(result);
        using var archive = new ZipArchive(memoryStream, ZipArchiveMode.Read);
        archive.Entries.Should().HaveCount(1);
        archive.Entries[0].Name.Should().Be("Schedule-E-Main House-2024.pdf");
    }

    [Fact]
    public void CreateZipBundle_StartsWithZipSignature()
    {
        // Arrange
        var files = new List<(string FileName, byte[] Content)>
        {
            ("test.pdf", CreateFakePdf("Test"))
        };

        // Act
        var result = _service.CreateZipBundle(files);

        // Assert
        // ZIP files start with PK (0x50, 0x4B)
        result[0].Should().Be(0x50);
        result[1].Should().Be(0x4B);
    }

    private static byte[] CreateFakePdf(string content)
    {
        // Create a simple byte array that looks like a PDF (starts with %PDF-)
        var pdfHeader = "%PDF-1.4\n"u8.ToArray();
        var contentBytes = System.Text.Encoding.UTF8.GetBytes($"Content for {content}");
        var pdfFooter = "\n%%EOF"u8.ToArray();

        return pdfHeader.Concat(contentBytes).Concat(pdfFooter).ToArray();
    }
}
