using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PropertyManager.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantPropertyId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PropertyId",
                table: "AspNetUsers",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_PropertyId",
                table: "AspNetUsers",
                column: "PropertyId");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Properties_PropertyId",
                table: "AspNetUsers",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Properties_PropertyId",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_PropertyId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "PropertyId",
                table: "AspNetUsers");
        }
    }
}
