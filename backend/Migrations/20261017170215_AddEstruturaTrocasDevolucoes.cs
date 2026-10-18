using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace RunWay.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEstruturaTrocasDevolucoes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "troca_codigo_seq");

            migrationBuilder.CreateTable(
                name: "TROCA",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    codigo = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    pedido_id = table.Column<int>(type: "integer", nullable: false),
                    cliente_id = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "EM TROCA"),
                    tipo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "PARCIAL"),
                    motivo = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    valor_total = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    dt_solicitacao = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    dt_autorizacao = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    admin_autorizacao = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    dt_recebimento = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    admin_recebimento = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    retornou_ao_estoque = table.Column<bool>(type: "boolean", nullable: true),
                    cupom_id = table.Column<int>(type: "integer", nullable: true),
                    notificacao_cliente = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    dt_notificacao = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_troca", x => x.id);
                    table.ForeignKey(
                        name: "fk_troca_cliente",
                        column: x => x.cliente_id,
                        principalTable: "CLIENTE",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_troca_cupom",
                        column: x => x.cupom_id,
                        principalTable: "CUPOM",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_troca_pedido",
                        column: x => x.pedido_id,
                        principalTable: "PEDIDO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ITEM_TROCA",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    troca_id = table.Column<int>(type: "integer", nullable: false),
                    item_pedido_id = table.Column<int>(type: "integer", nullable: false),
                    produto_variacao_id = table.Column<int>(type: "integer", nullable: false),
                    quantidade = table.Column<int>(type: "integer", nullable: false),
                    preco_unitario = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    subtotal = table.Column<decimal>(type: "numeric(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_item_troca", x => x.id);
                    table.ForeignKey(
                        name: "fk_item_troca_item_pedido",
                        column: x => x.item_pedido_id,
                        principalTable: "ITEM_PEDIDO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_item_troca_produto_variacao",
                        column: x => x.produto_variacao_id,
                        principalTable: "PRODUTO_VARIACAO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_item_troca_troca",
                        column: x => x.troca_id,
                        principalTable: "TROCA",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ITEM_TROCA_item_pedido_id",
                table: "ITEM_TROCA",
                column: "item_pedido_id");

            migrationBuilder.CreateIndex(
                name: "IX_ITEM_TROCA_produto_variacao_id",
                table: "ITEM_TROCA",
                column: "produto_variacao_id");

            migrationBuilder.CreateIndex(
                name: "IX_ITEM_TROCA_troca_id",
                table: "ITEM_TROCA",
                column: "troca_id");

            migrationBuilder.CreateIndex(
                name: "IX_TROCA_cliente_id",
                table: "TROCA",
                column: "cliente_id");

            migrationBuilder.CreateIndex(
                name: "IX_TROCA_cupom_id",
                table: "TROCA",
                column: "cupom_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TROCA_pedido_id",
                table: "TROCA",
                column: "pedido_id");

            migrationBuilder.CreateIndex(
                name: "uq_troca_codigo",
                table: "TROCA",
                column: "codigo",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ITEM_TROCA");

            migrationBuilder.DropTable(
                name: "TROCA");

            migrationBuilder.DropSequence(
                name: "troca_codigo_seq");
        }
    }
}
