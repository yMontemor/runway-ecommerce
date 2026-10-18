using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace RunWay.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCarrinhoPersistente : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CARRINHO",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    cliente_id = table.Column<int>(type: "integer", nullable: false),
                    dt_criacao = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    dt_atualizacao = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    dt_expiracao = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_carrinho", x => x.id);
                    table.CheckConstraint("chk_carrinho_datas", "dt_expiracao >= dt_criacao");
                    table.ForeignKey(
                        name: "fk_carrinho_cliente",
                        column: x => x.cliente_id,
                        principalTable: "CLIENTE",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ITEM_CARRINHO",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    carrinho_id = table.Column<int>(type: "integer", nullable: false),
                    produto_variacao_id = table.Column<int>(type: "integer", nullable: false),
                    quantidade = table.Column<int>(type: "integer", nullable: false),
                    dt_adicionado = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_item_carrinho", x => x.id);
                    table.CheckConstraint("chk_item_carrinho_quantidade", "quantidade > 0");
                    table.ForeignKey(
                        name: "fk_item_carrinho_carrinho",
                        column: x => x.carrinho_id,
                        principalTable: "CARRINHO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_item_carrinho_produto_variacao",
                        column: x => x.produto_variacao_id,
                        principalTable: "PRODUTO_VARIACAO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "chk_estoque_quantidade_nao_negativa",
                table: "ESTOQUE",
                sql: "quantidade >= 0");

            migrationBuilder.CreateIndex(
                name: "uq_carrinho_cliente",
                table: "CARRINHO",
                column: "cliente_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ITEM_CARRINHO_produto_variacao_id",
                table: "ITEM_CARRINHO",
                column: "produto_variacao_id");

            migrationBuilder.CreateIndex(
                name: "uq_item_carrinho_variacao",
                table: "ITEM_CARRINHO",
                columns: new[] { "carrinho_id", "produto_variacao_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ITEM_CARRINHO");

            migrationBuilder.DropTable(
                name: "CARRINHO");

            migrationBuilder.DropCheckConstraint(
                name: "chk_estoque_quantidade_nao_negativa",
                table: "ESTOQUE");
        }
    }
}
