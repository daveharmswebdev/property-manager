using Microsoft.Extensions.Logging;
using PDFtoImage;
using PropertyManager.Application.Common.Interfaces;
using SkiaSharp;

namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// PDFtoImage-based implementation of IPdfRendererService.
/// Renders the first page of a PDF to a PNG image using PDFium.
/// </summary>
public class PdfRendererService : IPdfRendererService
{
    private readonly ILogger<PdfRendererService> _logger;

    public PdfRendererService(ILogger<PdfRendererService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<byte[]> RenderFirstPageToImageAsync(
        Stream pdfStream,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Copy stream to byte array so Task.Run closure doesn't capture the stream
            using var ms = new MemoryStream();
            await pdfStream.CopyToAsync(ms, cancellationToken);
            var pdfBytes = ms.ToArray();

            var result = await Task.Run(() =>
            {
                using var pdfMemStream = new MemoryStream(pdfBytes);
                using var bitmap = Conversion.ToImage(pdfMemStream, page: 0);
                using var data = bitmap.Encode(SKEncodedImageFormat.Png, 100);
                return data.ToArray();
            }, cancellationToken);

            _logger.LogInformation(
                "Rendered PDF first page to PNG: {Size} bytes",
                result.Length);

            return result;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to render PDF first page");
            throw new InvalidOperationException($"Unable to render PDF: {ex.Message}", ex);
        }
    }
}
