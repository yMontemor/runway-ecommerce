using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace RunWay.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEstruturaProdutoEstoqueCupomPedido : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "pedido_codigo_seq");

            migrationBuilder.CreateTable(
                name: "CUPOM",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    codigo = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    tipo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    valor = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    cliente_id = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cupom", x => x.id);
                    table.ForeignKey(
                        name: "fk_cupom_cliente",
                        column: x => x.cliente_id,
                        principalTable: "CLIENTE",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PEDIDO",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    codigo = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    cliente_id = table.Column<int>(type: "integer", nullable: false),
                    endereco_entrega_id = table.Column<int>(type: "integer", nullable: false),
                    dt_pedido = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "EM PROCESSAMENTO"),
                    subtotal = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    valor_frete = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    valor_total = table.Column<decimal>(type: "numeric(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pedido", x => x.id);
                    table.ForeignKey(
                        name: "fk_pedido_cliente",
                        column: x => x.cliente_id,
                        principalTable: "CLIENTE",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pedido_endereco_entrega",
                        column: x => x.endereco_entrega_id,
                        principalTable: "ENDERECO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PRODUTO",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    codigo = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    nome = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    marca = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    categoria = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    preco = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    descricao = table.Column<string>(type: "text", nullable: false),
                    imagem_url = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ativo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_produto", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "PAGAMENTO_PEDIDO",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    pedido_id = table.Column<int>(type: "integer", nullable: false),
                    forma_pagamento = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    valor = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    cartao_id = table.Column<int>(type: "integer", nullable: true),
                    cupom_id = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pagamento_pedido", x => x.id);
                    table.CheckConstraint("chk_pagamento_origem", "(cartao_id IS NOT NULL AND cupom_id IS NULL) OR (cartao_id IS NULL AND cupom_id IS NOT NULL)");
                    table.ForeignKey(
                        name: "fk_pagamento_pedido_cartao",
                        column: x => x.cartao_id,
                        principalTable: "CARTAO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pagamento_pedido_cupom",
                        column: x => x.cupom_id,
                        principalTable: "CUPOM",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pagamento_pedido_pedido",
                        column: x => x.pedido_id,
                        principalTable: "PEDIDO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PRODUTO_VARIACAO",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    produto_id = table.Column<int>(type: "integer", nullable: false),
                    tamanho = table.Column<int>(type: "integer", nullable: false),
                    ativo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_produto_variacao", x => x.id);
                    table.ForeignKey(
                        name: "fk_produto_variacao_produto",
                        column: x => x.produto_id,
                        principalTable: "PRODUTO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ESTOQUE",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    produto_variacao_id = table.Column<int>(type: "integer", nullable: false),
                    quantidade = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_estoque", x => x.id);
                    table.ForeignKey(
                        name: "fk_estoque_produto_variacao",
                        column: x => x.produto_variacao_id,
                        principalTable: "PRODUTO_VARIACAO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ITEM_PEDIDO",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    pedido_id = table.Column<int>(type: "integer", nullable: false),
                    produto_variacao_id = table.Column<int>(type: "integer", nullable: false),
                    quantidade = table.Column<int>(type: "integer", nullable: false),
                    preco_unitario = table.Column<decimal>(type: "numeric(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_item_pedido", x => x.id);
                    table.ForeignKey(
                        name: "fk_item_pedido_pedido",
                        column: x => x.pedido_id,
                        principalTable: "PEDIDO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_item_pedido_produto_variacao",
                        column: x => x.produto_variacao_id,
                        principalTable: "PRODUTO_VARIACAO",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CUPOM_cliente_id",
                table: "CUPOM",
                column: "cliente_id");

            migrationBuilder.CreateIndex(
                name: "uq_cupom_codigo",
                table: "CUPOM",
                column: "codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_estoque_produto_variacao",
                table: "ESTOQUE",
                column: "produto_variacao_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ITEM_PEDIDO_pedido_id",
                table: "ITEM_PEDIDO",
                column: "pedido_id");

            migrationBuilder.CreateIndex(
                name: "IX_ITEM_PEDIDO_produto_variacao_id",
                table: "ITEM_PEDIDO",
                column: "produto_variacao_id");

            migrationBuilder.CreateIndex(
                name: "IX_PAGAMENTO_PEDIDO_cartao_id",
                table: "PAGAMENTO_PEDIDO",
                column: "cartao_id");

            migrationBuilder.CreateIndex(
                name: "IX_PAGAMENTO_PEDIDO_cupom_id",
                table: "PAGAMENTO_PEDIDO",
                column: "cupom_id");

            migrationBuilder.CreateIndex(
                name: "IX_PAGAMENTO_PEDIDO_pedido_id",
                table: "PAGAMENTO_PEDIDO",
                column: "pedido_id");

            migrationBuilder.CreateIndex(
                name: "IX_PEDIDO_cliente_id",
                table: "PEDIDO",
                column: "cliente_id");

            migrationBuilder.CreateIndex(
                name: "IX_PEDIDO_endereco_entrega_id",
                table: "PEDIDO",
                column: "endereco_entrega_id");

            migrationBuilder.CreateIndex(
                name: "uq_pedido_codigo",
                table: "PEDIDO",
                column: "codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_produto_codigo",
                table: "PRODUTO",
                column: "codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_produto_variacao_tamanho",
                table: "PRODUTO_VARIACAO",
                columns: new[] { "produto_id", "tamanho" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ESTOQUE");

            migrationBuilder.DropTable(
                name: "ITEM_PEDIDO");

            migrationBuilder.DropTable(
                name: "PAGAMENTO_PEDIDO");

            migrationBuilder.DropTable(
                name: "PRODUTO_VARIACAO");

            migrationBuilder.DropTable(
                name: "CUPOM");

            migrationBuilder.DropTable(
                name: "PEDIDO");

            migrationBuilder.DropTable(
                name: "PRODUTO");

            migrationBuilder.DropSequence(
                name: "pedido_codigo_seq");
        }
    }
}
