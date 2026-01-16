using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PropertyManager.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixVendorTradeTagCaseInsensitiveIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop the case-sensitive unique index
            migrationBuilder.DropIndex(
                name: "IX_VendorTradeTags_AccountId_Name",
                table: "VendorTradeTags");

            // Create a case-insensitive unique index using LOWER() function
            // This ensures "Plumber" and "PLUMBER" are treated as duplicates at the database level
            migrationBuilder.Sql(
                @"CREATE UNIQUE INDEX ""IX_VendorTradeTags_AccountId_Name""
                  ON ""VendorTradeTags"" (""AccountId"", LOWER(""Name""))");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop the case-insensitive index
            migrationBuilder.DropIndex(
                name: "IX_VendorTradeTags_AccountId_Name",
                table: "VendorTradeTags");

            // Recreate the original case-sensitive unique index
            migrationBuilder.CreateIndex(
                name: "IX_VendorTradeTags_AccountId_Name",
                table: "VendorTradeTags",
                columns: new[] { "AccountId", "Name" },
                unique: true);
        }
    }
}
