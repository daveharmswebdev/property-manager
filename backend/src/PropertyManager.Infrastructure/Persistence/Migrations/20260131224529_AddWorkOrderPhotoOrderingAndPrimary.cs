using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PropertyManager.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkOrderPhotoOrderingAndPrimary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkOrderPhotos_WorkOrderId",
                table: "WorkOrderPhotos");

            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "WorkOrderPhotos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsPrimary",
                table: "WorkOrderPhotos",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderPhotos_WorkOrderId_DisplayOrder",
                table: "WorkOrderPhotos",
                columns: new[] { "WorkOrderId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderPhotos_WorkOrderId_IsPrimary_Unique",
                table: "WorkOrderPhotos",
                columns: new[] { "WorkOrderId", "IsPrimary" },
                unique: true,
                filter: "\"IsPrimary\" = true");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkOrderPhotos_WorkOrderId_DisplayOrder",
                table: "WorkOrderPhotos");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrderPhotos_WorkOrderId_IsPrimary_Unique",
                table: "WorkOrderPhotos");

            migrationBuilder.DropColumn(
                name: "DisplayOrder",
                table: "WorkOrderPhotos");

            migrationBuilder.DropColumn(
                name: "IsPrimary",
                table: "WorkOrderPhotos");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderPhotos_WorkOrderId",
                table: "WorkOrderPhotos",
                column: "WorkOrderId");
        }
    }
}
