namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Interface for bundling multiple report files into a ZIP archive.
/// Implementation in Infrastructure layer.
/// </summary>
public interface IReportBundleService
{
    /// <summary>
    /// Creates a ZIP archive containing the provided files.
    /// </summary>
    /// <param name="files">Collection of tuples containing filename and file content bytes.</param>
    /// <returns>ZIP archive as byte array.</returns>
    byte[] CreateZipBundle(IEnumerable<(string FileName, byte[] Content)> files);
}
