using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RunWay.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSnapshotEntregaECartaoAvulsoPedido : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PAGAMENTO_PEDIDO_cupom_id",
                table: "PAGAMENTO_PEDIDO");

            migrationBuilder.DropCheckConstraint(
                name: "chk_pagamento_origem",
                table: "PAGAMENTO_PEDIDO");

            migrationBuilder.AlterColumn<int>(
                name: "endereco_entrega_id",
                table: "PEDIDO",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "entrega_bairro",
                table: "PEDIDO",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "entrega_cep",
                table: "PEDIDO",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "entrega_cidade",
                table: "PEDIDO",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "entrega_complemento",
                table: "PEDIDO",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "entrega_estado",
                table: "PEDIDO",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "entrega_logradouro",
                table: "PEDIDO",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "entrega_numero",
                table: "PEDIDO",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "entrega_observacoes",
                table: "PEDIDO",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "entrega_pais",
                table: "PEDIDO",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "entrega_tipo_logradouro",
                table: "PEDIDO",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "entrega_tipo_residencia",
                table: "PEDIDO",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false);

            migrationBuilder.AddColumn<int>(
                name: "bandeira_id",
                table: "PAGAMENTO_PEDIDO",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cartao_nome_impresso",
                table: "PAGAMENTO_PEDIDO",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cartao_ultimos_digitos",
                table: "PAGAMENTO_PEDIDO",
                type: "character varying(4)",
                maxLength: 4,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PAGAMENTO_PEDIDO_bandeira_id",
                table: "PAGAMENTO_PEDIDO",
                column: "bandeira_id");

            migrationBuilder.CreateIndex(
                name: "uq_pagamento_pedido_cupom_troca",
                table: "PAGAMENTO_PEDIDO",
                column: "cupom_id",
                unique: true,
                filter: "forma_pagamento = 'CUPOM_TROCA'");

            migrationBuilder.AddCheckConstraint(
                name: "chk_pagamento_origem",
                table: "PAGAMENTO_PEDIDO",
                sql: "(forma_pagamento = 'CARTAO_CREDITO' AND cartao_id IS NOT NULL AND cupom_id IS NULL AND bandeira_id IS NULL AND cartao_ultimos_digitos IS NULL AND cartao_nome_impresso IS NULL)\n                   OR (forma_pagamento = 'CARTAO_CREDITO' AND cartao_id IS NULL AND cupom_id IS NULL AND bandeira_id IS NOT NULL AND cartao_ultimos_digitos IS NOT NULL AND cartao_nome_impresso IS NOT NULL)\n                   OR (forma_pagamento IN ('CUPOM_PROMOCIONAL', 'CUPOM_TROCA') AND cupom_id IS NOT NULL AND cartao_id IS NULL AND bandeira_id IS NULL AND cartao_ultimos_digitos IS NULL AND cartao_nome_impresso IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "fk_pagamento_pedido_bandeira",
                table: "PAGAMENTO_PEDIDO",
                column: "bandeira_id",
                principalTable: "BANDEIRA",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_pagamento_pedido_bandeira",
                table: "PAGAMENTO_PEDIDO");

            migrationBuilder.DropIndex(
                name: "IX_PAGAMENTO_PEDIDO_bandeira_id",
                table: "PAGAMENTO_PEDIDO");

            migrationBuilder.DropIndex(
                name: "uq_pagamento_pedido_cupom_troca",
                table: "PAGAMENTO_PEDIDO");

            migrationBuilder.DropCheckConstraint(
                name: "chk_pagamento_origem",
                table: "PAGAMENTO_PEDIDO");

            migrationBuilder.DropColumn(
                name: "entrega_bairro",
                table: "PEDIDO");

            migrationBuilder.DropColumn(
                name: "entrega_cep",
                table: "PEDIDO");

            migrationBuilder.DropColumn(
                name: "entrega_cidade",
                table: "PEDIDO");

            migrationBuilder.DropColumn(
                name: "entrega_complemento",
                table: "PEDIDO");

            migrationBuilder.DropColumn(
                name: "entrega_estado",
                table: "PEDIDO");

            migrationBuilder.DropColumn(
                name: "entrega_logradouro",
                table: "PEDIDO");

            migrationBuilder.DropColumn(
                name: "entrega_numero",
                table: "PEDIDO");

            migrationBuilder.DropColumn(
                name: "entrega_observacoes",
                table: "PEDIDO");

            migrationBuilder.DropColumn(
                name: "entrega_pais",
                table: "PEDIDO");

            migrationBuilder.DropColumn(
                name: "entrega_tipo_logradouro",
                table: "PEDIDO");

            migrationBuilder.DropColumn(
                name: "entrega_tipo_residencia",
                table: "PEDIDO");

            migrationBuilder.DropColumn(
                name: "bandeira_id",
                table: "PAGAMENTO_PEDIDO");

            migrationBuilder.DropColumn(
                name: "cartao_nome_impresso",
                table: "PAGAMENTO_PEDIDO");

            migrationBuilder.DropColumn(
                name: "cartao_ultimos_digitos",
                table: "PAGAMENTO_PEDIDO");

            migrationBuilder.AlterColumn<int>(
                name: "endereco_entrega_id",
                table: "PEDIDO",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PAGAMENTO_PEDIDO_cupom_id",
                table: "PAGAMENTO_PEDIDO",
                column: "cupom_id");

            migrationBuilder.AddCheckConstraint(
                name: "chk_pagamento_origem",
                table: "PAGAMENTO_PEDIDO",
                sql: "(cartao_id IS NOT NULL AND cupom_id IS NULL) OR (cartao_id IS NULL AND cupom_id IS NOT NULL)");
        }
    }
}
