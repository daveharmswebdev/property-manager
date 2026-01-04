using System.IO.Compression;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Infrastructure.Reports;

/// <summary>
/// Service for bundling multiple report files into a ZIP archive.
/// Uses System.IO.Compression.ZipArchive for in-memory ZIP creation.
/// </summary>
public class ReportBundleService : IReportBundleService
{
    /// <inheritdoc />
    public byte[] CreateZipBundle(IEnumerable<(string FileName, byte[] Content)> files)
    {
        using var memoryStream = new MemoryStream();

        using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var (fileName, content) in files)
            {
                var entry = archive.CreateEntry(fileName, CompressionLevel.Optimal);
                using var entryStream = entry.Open();
                entryStream.Write(content, 0, content.Length);
            }
        }

        return memoryStream.ToArray();
    }
}
