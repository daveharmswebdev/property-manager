using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PropertyManager.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCreatedByUserIdToAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "Accounts",
                type: "uuid",
                nullable: true);

            // Backfill: set CreatedByUserId to the earliest user per account
            migrationBuilder.Sql("""
                UPDATE "Accounts" a
                SET "CreatedByUserId" = sub."Id"
                FROM (
                    SELECT DISTINCT ON ("AccountId") "Id", "AccountId"
                    FROM "AspNetUsers"
                    ORDER BY "AccountId", "CreatedAt" ASC
                ) sub
                WHERE a."Id" = sub."AccountId";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Accounts");
        }
    }
}
