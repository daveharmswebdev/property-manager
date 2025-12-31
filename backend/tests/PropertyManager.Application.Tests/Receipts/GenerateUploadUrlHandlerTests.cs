using FluentAssertions;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Receipts;

namespace PropertyManager.Application.Tests.Receipts;

/// <summary>
/// Unit tests for GenerateUploadUrlHandler (AC-5.1.1).
/// </summary>
public class GenerateUploadUrlHandlerTests
{
    private readonly Mock<IStorageService> _storageServiceMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GenerateUploadUrlHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public GenerateUploadUrlHandlerTests()
    {
        _storageServiceMock = new Mock<IStorageService>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);

        _handler = new GenerateUploadUrlHandler(
            _storageServiceMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_GeneratesPresignedUrl()
    {
        // Arrange
        var expiresAt = DateTime.UtcNow.AddMinutes(60);
        var presignedUrl = "https://bucket.s3.amazonaws.com/presigned-url";

        _storageServiceMock
            .Setup(x => x.GeneratePresignedUploadUrlAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadUrlResult(presignedUrl, expiresAt));

        var command = new GenerateUploadUrlCommand("image/jpeg", 1024 * 1024, null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.UploadUrl.Should().Be(presignedUrl);
        result.ExpiresAt.Should().Be(expiresAt);
        result.HttpMethod.Should().Be("PUT");
    }

    [Fact]
    public async Task Handle_ValidRequest_IncludesCorrectStorageKeyFormat()
    {
        // Arrange
        var expiresAt = DateTime.UtcNow.AddMinutes(60);
        string? capturedStorageKey = null;

        _storageServiceMock
            .Setup(x => x.GeneratePresignedUploadUrlAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, string, long, CancellationToken>((key, _, _, _) => capturedStorageKey = key)
            .ReturnsAsync(new UploadUrlResult("https://example.com", expiresAt));

        var command = new GenerateUploadUrlCommand("image/jpeg", 1024 * 1024, null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert - Storage key format: {accountId}/{year}/{guid}.{extension}
        capturedStorageKey.Should().NotBeNullOrEmpty();
        capturedStorageKey.Should().StartWith($"{_testAccountId}/{DateTime.UtcNow.Year}/");
        capturedStorageKey.Should().EndWith(".jpg");
        result.StorageKey.Should().Be(capturedStorageKey);
    }

    [Theory]
    [InlineData("image/jpeg", ".jpg")]
    [InlineData("image/png", ".png")]
    [InlineData("application/pdf", ".pdf")]
    public async Task Handle_DifferentContentTypes_GeneratesCorrectExtension(string contentType, string expectedExtension)
    {
        // Arrange
        var expiresAt = DateTime.UtcNow.AddMinutes(60);

        _storageServiceMock
            .Setup(x => x.GeneratePresignedUploadUrlAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadUrlResult("https://example.com", expiresAt));

        var command = new GenerateUploadUrlCommand(contentType, 1024 * 1024, null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.StorageKey.Should().EndWith(expectedExtension);
    }

    [Fact]
    public async Task Handle_CallsStorageServiceWithCorrectParameters()
    {
        // Arrange
        var expiresAt = DateTime.UtcNow.AddMinutes(60);
        var contentType = "image/jpeg";
        var fileSizeBytes = 2048576L;

        _storageServiceMock
            .Setup(x => x.GeneratePresignedUploadUrlAsync(
                It.IsAny<string>(),
                contentType,
                fileSizeBytes,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadUrlResult("https://example.com", expiresAt));

        var command = new GenerateUploadUrlCommand(contentType, fileSizeBytes, null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _storageServiceMock.Verify(x => x.GeneratePresignedUploadUrlAsync(
            It.IsAny<string>(),
            contentType,
            fileSizeBytes,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ReturnsUniqueStorageKeyEachTime()
    {
        // Arrange
        var expiresAt = DateTime.UtcNow.AddMinutes(60);

        _storageServiceMock
            .Setup(x => x.GeneratePresignedUploadUrlAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadUrlResult("https://example.com", expiresAt));

        var command = new GenerateUploadUrlCommand("image/jpeg", 1024 * 1024, null);

        // Act
        var result1 = await _handler.Handle(command, CancellationToken.None);
        var result2 = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result1.StorageKey.Should().NotBe(result2.StorageKey);
    }
}
