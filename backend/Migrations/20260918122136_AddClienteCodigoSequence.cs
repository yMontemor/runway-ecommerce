using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RunWay.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddClienteCodigoSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "cliente_codigo_seq");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropSequence(
                name: "cliente_codigo_seq");
        }
    }
}
