using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PropertyManager.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMaintenanceRequestPhotos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MaintenanceRequestPhotos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    MaintenanceRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ThumbnailStorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    OriginalFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceRequestPhotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenanceRequestPhotos_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MaintenanceRequestPhotos_MaintenanceRequests_MaintenanceReq~",
                        column: x => x.MaintenanceRequestId,
                        principalTable: "MaintenanceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequestPhotos_AccountId",
                table: "MaintenanceRequestPhotos",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequestPhotos_CreatedByUserId",
                table: "MaintenanceRequestPhotos",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequestPhotos_MaintenanceRequestId_DisplayOrder",
                table: "MaintenanceRequestPhotos",
                columns: new[] { "MaintenanceRequestId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequestPhotos_MaintenanceRequestId_IsPrimary_Unique",
                table: "MaintenanceRequestPhotos",
                columns: new[] { "MaintenanceRequestId", "IsPrimary" },
                unique: true,
                filter: "\"IsPrimary\" = true");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MaintenanceRequestPhotos");
        }
    }
}
