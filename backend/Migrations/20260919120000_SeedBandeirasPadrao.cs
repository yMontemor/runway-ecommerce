using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RunWay.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedBandeirasPadrao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "BANDEIRA",
                columns: new[] { "id", "ativo", "nome" },
                values: new object[,]
                {
                    { 1, true, "Visa" },
                    { 2, true, "Mastercard" },
                    { 3, true, "Elo" },
                    { 4, true, "American Express" },
                    { 5, true, "Hipercard" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "BANDEIRA",
                keyColumn: "id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "BANDEIRA",
                keyColumn: "id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "BANDEIRA",
                keyColumn: "id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "BANDEIRA",
                keyColumn: "id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "BANDEIRA",
                keyColumn: "id",
                keyValue: 5);
        }
    }
}
