namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Interface for rendering PDF pages to images.
/// Used to generate thumbnails from PDF documents.
/// </summary>
public interface IPdfRendererService
{
    /// <summary>
    /// Renders the first page of a PDF document to a PNG image.
    /// </summary>
    /// <param name="pdfStream">Stream containing the PDF document.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Byte array containing the rendered page as a PNG image.</returns>
    Task<byte[]> RenderFirstPageToImageAsync(
        Stream pdfStream,
        CancellationToken cancellationToken = default);
}
