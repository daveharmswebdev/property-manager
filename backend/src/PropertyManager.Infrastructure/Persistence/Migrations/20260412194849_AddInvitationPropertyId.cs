using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PropertyManager.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInvitationPropertyId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PropertyId",
                table: "Invitations",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_PropertyId",
                table: "Invitations",
                column: "PropertyId");

            migrationBuilder.AddForeignKey(
                name: "FK_Invitations_Properties_PropertyId",
                table: "Invitations",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Invitations_Properties_PropertyId",
                table: "Invitations");

            migrationBuilder.DropIndex(
                name: "IX_Invitations_PropertyId",
                table: "Invitations");

            migrationBuilder.DropColumn(
                name: "PropertyId",
                table: "Invitations");
        }
    }
}
