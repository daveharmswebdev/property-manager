using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using PropertyManager.Infrastructure.Storage;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Metadata.Profiles.Exif;

namespace PropertyManager.Infrastructure.Tests.Storage;

public class ImageSharpThumbnailServiceTests
{
    private readonly ImageSharpThumbnailService _sut;
    private readonly Mock<ILogger<ImageSharpThumbnailService>> _loggerMock;

    public ImageSharpThumbnailServiceTests()
    {
        _loggerMock = new Mock<ILogger<ImageSharpThumbnailService>>();
        _sut = new ImageSharpThumbnailService(_loggerMock.Object);
    }

    [Fact]
    public async Task GenerateThumbnailAsync_JpegLandscape_ResizesToFitWithinBounds()
    {
        // Arrange - 800x600 landscape JPEG
        using var inputStream = CreateTestImage(800, 600, JpegFormat.Instance);

        // Act
        var result = await _sut.GenerateThumbnailAsync(inputStream, 300, 300);

        // Assert
        result.Should().NotBeEmpty();
        using var thumbnail = Image.Load(result);
        thumbnail.Width.Should().Be(300); // Width limited
        thumbnail.Height.Should().Be(225); // Height maintains aspect ratio (600/800 * 300)
    }

    [Fact]
    public async Task GenerateThumbnailAsync_JpegPortrait_ResizesToFitWithinBounds()
    {
        // Arrange - 600x800 portrait JPEG
        using var inputStream = CreateTestImage(600, 800, JpegFormat.Instance);

        // Act
        var result = await _sut.GenerateThumbnailAsync(inputStream, 300, 300);

        // Assert
        result.Should().NotBeEmpty();
        using var thumbnail = Image.Load(result);
        thumbnail.Width.Should().Be(225); // Width maintains aspect ratio (600/800 * 300)
        thumbnail.Height.Should().Be(300); // Height limited
    }

    [Fact]
    public async Task GenerateThumbnailAsync_PngInput_ConvertsToJpeg()
    {
        // Arrange - PNG input
        using var inputStream = CreateTestImage(400, 400, PngFormat.Instance);

        // Act
        var result = await _sut.GenerateThumbnailAsync(inputStream, 300, 300);

        // Assert
        result.Should().NotBeEmpty();

        // Verify it's a valid JPEG by checking the magic bytes
        result[0].Should().Be(0xFF);
        result[1].Should().Be(0xD8);
    }

    [Fact]
    public async Task GenerateThumbnailAsync_SquareImage_MaintainsSquare()
    {
        // Arrange - 500x500 square
        using var inputStream = CreateTestImage(500, 500, JpegFormat.Instance);

        // Act
        var result = await _sut.GenerateThumbnailAsync(inputStream, 300, 300);

        // Assert
        using var thumbnail = Image.Load(result);
        thumbnail.Width.Should().Be(300);
        thumbnail.Height.Should().Be(300);
    }

    [Fact]
    public async Task GenerateThumbnailAsync_TinyImage_DoesNotUpscale()
    {
        // Arrange - 100x100 image smaller than thumbnail target
        using var inputStream = CreateTestImage(100, 100, JpegFormat.Instance);

        // Act
        var result = await _sut.GenerateThumbnailAsync(inputStream, 300, 300);

        // Assert
        using var thumbnail = Image.Load(result);
        thumbnail.Width.Should().Be(100); // Should not upscale
        thumbnail.Height.Should().Be(100);
    }

    [Fact]
    public async Task GenerateThumbnailAsync_ImageWithExif_StripsMetadata()
    {
        // Arrange - Create image with EXIF data
        using var inputStream = CreateTestImageWithExif(400, 400);

        // Act
        var result = await _sut.GenerateThumbnailAsync(inputStream, 300, 300);

        // Assert
        using var thumbnail = Image.Load(result);
        thumbnail.Metadata.ExifProfile.Should().BeNull();
    }

    [Fact]
    public async Task GenerateThumbnailAsync_VeryWideImage_ResizesCorrectly()
    {
        // Arrange - 1200x400 very wide image
        using var inputStream = CreateTestImage(1200, 400, JpegFormat.Instance);

        // Act
        var result = await _sut.GenerateThumbnailAsync(inputStream, 300, 300);

        // Assert
        using var thumbnail = Image.Load(result);
        thumbnail.Width.Should().Be(300); // Width limited
        thumbnail.Height.Should().Be(100); // Height maintains aspect ratio (400/1200 * 300)
    }

    [Fact]
    public async Task GenerateThumbnailAsync_VeryTallImage_ResizesCorrectly()
    {
        // Arrange - 400x1200 very tall image
        using var inputStream = CreateTestImage(400, 1200, JpegFormat.Instance);

        // Act
        var result = await _sut.GenerateThumbnailAsync(inputStream, 300, 300);

        // Assert
        using var thumbnail = Image.Load(result);
        thumbnail.Width.Should().Be(100); // Width maintains aspect ratio (400/1200 * 300)
        thumbnail.Height.Should().Be(300); // Height limited
    }

    [Fact]
    public async Task GenerateThumbnailAsync_CorruptedStream_ThrowsException()
    {
        // Arrange
        using var corruptedStream = new MemoryStream(new byte[] { 0x00, 0x01, 0x02, 0x03 });

        // Act & Assert
        await FluentActions.Invoking(() => _sut.GenerateThumbnailAsync(corruptedStream, 300, 300))
            .Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Unable to process image*");
    }

    [Fact]
    public async Task GenerateThumbnailAsync_EmptyStream_ThrowsException()
    {
        // Arrange
        using var emptyStream = new MemoryStream();

        // Act & Assert
        await FluentActions.Invoking(() => _sut.GenerateThumbnailAsync(emptyStream, 300, 300))
            .Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Unable to process image*");
    }

    private static MemoryStream CreateTestImage(int width, int height, SixLabors.ImageSharp.Formats.IImageFormat format)
    {
        using var image = new Image<Rgba32>(width, height);

        // Fill with a gradient so it's not just blank
        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                image[x, y] = new Rgba32(
                    (byte)(x * 255 / width),
                    (byte)(y * 255 / height),
                    128);
            }
        }

        var stream = new MemoryStream();
        if (format is JpegFormat)
        {
            image.SaveAsJpeg(stream);
        }
        else if (format is PngFormat)
        {
            image.SaveAsPng(stream);
        }
        stream.Position = 0;
        return stream;
    }

    private static MemoryStream CreateTestImageWithExif(int width, int height)
    {
        using var image = new Image<Rgba32>(width, height);

        // Add EXIF data
        var exifProfile = new ExifProfile();
        exifProfile.SetValue(ExifTag.Make, "TestCamera");
        exifProfile.SetValue(ExifTag.Model, "TestModel");
        exifProfile.SetValue(ExifTag.GPSLatitude, new Rational[] { new Rational(40, 1), new Rational(42, 1), new Rational(46, 1) });
        image.Metadata.ExifProfile = exifProfile;

        var stream = new MemoryStream();
        image.SaveAsJpeg(stream);
        stream.Position = 0;
        return stream;
    }
}
