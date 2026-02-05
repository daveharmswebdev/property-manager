using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PropertyManager.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkOrderIdToExpense : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "WorkOrderId",
                table: "Expenses",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_AccountId_WorkOrderId",
                table: "Expenses",
                columns: new[] { "AccountId", "WorkOrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_WorkOrderId",
                table: "Expenses",
                column: "WorkOrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_WorkOrders_WorkOrderId",
                table: "Expenses",
                column: "WorkOrderId",
                principalTable: "WorkOrders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_WorkOrders_WorkOrderId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_AccountId_WorkOrderId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_WorkOrderId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "WorkOrderId",
                table: "Expenses");
        }
    }
}
