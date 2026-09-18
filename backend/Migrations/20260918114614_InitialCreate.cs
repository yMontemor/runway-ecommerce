using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace RunWay.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BANDEIRA",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    nome = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ativo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_bandeira", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "CLIENTE",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    codigo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    nome = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    cpf = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    genero = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    dt_nasc = table.Column<DateOnly>(type: "date", nullable: false),
                    senha_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ranking = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    ativo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cliente", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "LOG_AUDITORIA",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    entidade = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    registro_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    operacao = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    dados_alterados = table.Column<string>(type: "jsonb", nullable: false),
                    dt_hora = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    usuario_responsavel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_log_auditoria", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "CARTAO",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    cliente_id = table.Column<int>(type: "integer", nullable: false),
                    bandeira_id = table.Column<int>(type: "integer", nullable: false),
                    numero_cartao = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    nome_impresso = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    dt_validade = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    cvv = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    preferencial = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cartao", x => x.id);
                    table.ForeignKey(
                        name: "fk_cartao_bandeira",
                        column: x => x.bandeira_id,
                        principalTable: "BANDEIRA",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_cartao_cliente",
                        column: x => x.cliente_id,
                        principalTable: "CLIENTE",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ENDERECO",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    cliente_id = table.Column<int>(type: "integer", nullable: false),
                    nome = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    tipo_residencia = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    tipo_logradouro = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    logradouro = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    numero = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    complemento = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    bairro = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    cep = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    cidade = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    estado = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    pais = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    observacoes = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    residencial = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    entrega = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    cobranca = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_endereco", x => x.id);
                    table.ForeignKey(
                        name: "fk_endereco_cliente",
                        column: x => x.cliente_id,
                        principalTable: "CLIENTE",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TELEFONE",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    cliente_id = table.Column<int>(type: "integer", nullable: false),
                    tipo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ddd = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    numero = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_telefone", x => x.id);
                    table.ForeignKey(
                        name: "fk_telefone_cliente",
                        column: x => x.cliente_id,
                        principalTable: "CLIENTE",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "uq_bandeira_nome",
                table: "BANDEIRA",
                column: "nome",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CARTAO_bandeira_id",
                table: "CARTAO",
                column: "bandeira_id");

            migrationBuilder.CreateIndex(
                name: "IX_CARTAO_cliente_id",
                table: "CARTAO",
                column: "cliente_id");

            migrationBuilder.CreateIndex(
                name: "uq_cliente_codigo",
                table: "CLIENTE",
                column: "codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_cliente_cpf",
                table: "CLIENTE",
                column: "cpf",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_cliente_email",
                table: "CLIENTE",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ENDERECO_cliente_id",
                table: "ENDERECO",
                column: "cliente_id");

            migrationBuilder.CreateIndex(
                name: "uq_telefone_cliente",
                table: "TELEFONE",
                column: "cliente_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CARTAO");

            migrationBuilder.DropTable(
                name: "ENDERECO");

            migrationBuilder.DropTable(
                name: "LOG_AUDITORIA");

            migrationBuilder.DropTable(
                name: "TELEFONE");

            migrationBuilder.DropTable(
                name: "BANDEIRA");

            migrationBuilder.DropTable(
                name: "CLIENTE");
        }
    }
}
