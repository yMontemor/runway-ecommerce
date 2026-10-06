using Microsoft.EntityFrameworkCore;
using RunWay.Api.Models;

namespace RunWay.Api.Data;

public class RunWayDbContext : DbContext
{
    public RunWayDbContext(DbContextOptions<RunWayDbContext> options)
        : base(options)
    {
    }

    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<Telefone> Telefones => Set<Telefone>();
    public DbSet<Endereco> Enderecos => Set<Endereco>();
    public DbSet<Bandeira> Bandeiras => Set<Bandeira>();
    public DbSet<Cartao> Cartoes => Set<Cartao>();
    public DbSet<LogAuditoria> LogsAuditoria => Set<LogAuditoria>();
    public DbSet<Produto> Produtos => Set<Produto>();
    public DbSet<ProdutoVariacao> ProdutoVariacoes => Set<ProdutoVariacao>();
    public DbSet<Estoque> Estoques => Set<Estoque>();
    public DbSet<Cupom> Cupons => Set<Cupom>();
    public DbSet<Pedido> Pedidos => Set<Pedido>();
    public DbSet<ItemPedido> ItensPedido => Set<ItemPedido>();
    public DbSet<PagamentoPedido> PagamentosPedido => Set<PagamentoPedido>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ==========================================
        // SEQUÊNCIA PARA CÓDIGO ÚNICO DO CLIENTE (RNF0035)
        // ==========================================
        modelBuilder.HasSequence<long>("cliente_codigo_seq")
            .StartsAt(1)
            .IncrementsBy(1);

        // ==========================================
        // SEQUÊNCIA PARA CÓDIGO ÚNICO DO PEDIDO
        // ==========================================
        modelBuilder.HasSequence<long>("pedido_codigo_seq")
            .StartsAt(1)
            .IncrementsBy(1);

        // ==========================================
        // CLIENTE
        // ==========================================
        modelBuilder.Entity<Cliente>(entity =>
        {
            entity.ToTable("CLIENTE");

            entity.HasKey(c => c.Id).HasName("pk_cliente");
            entity.Property(c => c.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(c => c.Codigo)
                .HasColumnName("codigo")
                .HasMaxLength(20)
                .IsRequired();
            entity.HasIndex(c => c.Codigo)
                .IsUnique()
                .HasDatabaseName("uq_cliente_codigo");

            entity.Property(c => c.Nome)
                .HasColumnName("nome")
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(c => c.Email)
                .HasColumnName("email")
                .HasMaxLength(255)
                .IsRequired();
            entity.HasIndex(c => c.Email)
                .IsUnique()
                .HasDatabaseName("uq_cliente_email");

            entity.Property(c => c.Cpf)
                .HasColumnName("cpf")
                .HasMaxLength(11)
                .IsRequired();
            entity.HasIndex(c => c.Cpf)
                .IsUnique()
                .HasDatabaseName("uq_cliente_cpf");

            entity.Property(c => c.Genero)
                .HasColumnName("genero")
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(c => c.DataNascimento)
                .HasColumnName("dt_nasc")
                .HasColumnType("date")
                .IsRequired();

            entity.Property(c => c.SenhaHash)
                .HasColumnName("senha_hash")
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(c => c.Ranking)
                .HasColumnName("ranking")
                .HasDefaultValue(1)
                .IsRequired();

            entity.Property(c => c.Ativo)
                .HasColumnName("ativo")
                .HasDefaultValue(true)
                .IsRequired();

            // Relacionamento 1:1 CLIENTE -> TELEFONE
            entity.HasOne(c => c.Telefone)
                .WithOne(t => t.Cliente)
                .HasForeignKey<Telefone>(t => t.ClienteId)
                .HasConstraintName("fk_telefone_cliente")
                .OnDelete(DeleteBehavior.Restrict);

            // Relacionamento 1:N CLIENTE -> ENDERECO
            entity.HasMany(c => c.Enderecos)
                .WithOne(e => e.Cliente)
                .HasForeignKey(e => e.ClienteId)
                .HasConstraintName("fk_endereco_cliente")
                .OnDelete(DeleteBehavior.Restrict);

            // Relacionamento 1:N CLIENTE -> CARTAO
            entity.HasMany(c => c.Cartoes)
                .WithOne(ca => ca.Cliente)
                .HasForeignKey(ca => ca.ClienteId)
                .HasConstraintName("fk_cartao_cliente")
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ==========================================
        // TELEFONE
        // ==========================================
        modelBuilder.Entity<Telefone>(entity =>
        {
            entity.ToTable("TELEFONE");

            entity.HasKey(t => t.Id).HasName("pk_telefone");
            entity.Property(t => t.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(t => t.ClienteId)
                .HasColumnName("cliente_id")
                .IsRequired();
            entity.HasIndex(t => t.ClienteId)
                .IsUnique()
                .HasDatabaseName("uq_telefone_cliente");

            entity.Property(t => t.Tipo)
                .HasColumnName("tipo")
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(t => t.Ddd)
                .HasColumnName("ddd")
                .HasMaxLength(2)
                .IsRequired();

            entity.Property(t => t.Numero)
                .HasColumnName("numero")
                .HasMaxLength(9)
                .IsRequired();
        });

        // ==========================================
        // ENDERECO
        // ==========================================
        modelBuilder.Entity<Endereco>(entity =>
        {
            entity.ToTable("ENDERECO");

            entity.HasKey(e => e.Id).HasName("pk_endereco");
            entity.Property(e => e.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(e => e.ClienteId)
                .HasColumnName("cliente_id")
                .IsRequired();

            entity.Property(e => e.Nome)
                .HasColumnName("nome")
                .HasMaxLength(80)
                .IsRequired();

            entity.Property(e => e.TipoResidencia)
                .HasColumnName("tipo_residencia")
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(e => e.TipoLogradouro)
                .HasColumnName("tipo_logradouro")
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(e => e.Logradouro)
                .HasColumnName("logradouro")
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(e => e.Numero)
                .HasColumnName("numero")
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(e => e.Complemento)
                .HasColumnName("complemento")
                .HasMaxLength(100)
                .IsRequired(false);

            entity.Property(e => e.Bairro)
                .HasColumnName("bairro")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(e => e.Cep)
                .HasColumnName("cep")
                .HasMaxLength(8)
                .IsRequired();

            entity.Property(e => e.Cidade)
                .HasColumnName("cidade")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(e => e.Estado)
                .HasColumnName("estado")
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(e => e.Pais)
                .HasColumnName("pais")
                .HasMaxLength(60)
                .IsRequired();

            entity.Property(e => e.Observacoes)
                .HasColumnName("observacoes")
                .HasMaxLength(255)
                .IsRequired(false);

            entity.Property(e => e.Residencial)
                .HasColumnName("residencial")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(e => e.Entrega)
                .HasColumnName("entrega")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(e => e.Cobranca)
                .HasColumnName("cobranca")
                .HasDefaultValue(false)
                .IsRequired();
        });

        // ==========================================
        // BANDEIRA
        // ==========================================
        modelBuilder.Entity<Bandeira>(entity =>
        {
            entity.ToTable("BANDEIRA");

            entity.HasKey(b => b.Id).HasName("pk_bandeira");
            entity.Property(b => b.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(b => b.Nome)
                .HasColumnName("nome")
                .HasMaxLength(30)
                .IsRequired();
            entity.HasIndex(b => b.Nome)
                .IsUnique()
                .HasDatabaseName("uq_bandeira_nome");

            entity.Property(b => b.Ativo)
                .HasColumnName("ativo")
                .HasDefaultValue(true)
                .IsRequired();

            // Relacionamento 1:N BANDEIRA -> CARTAO
            entity.HasMany(b => b.Cartoes)
                .WithOne(c => c.Bandeira)
                .HasForeignKey(c => c.BandeiraId)
                .HasConstraintName("fk_cartao_bandeira")
                .OnDelete(DeleteBehavior.Restrict);

            // Seed inicial de bandeiras oficiais do RunWay (Decisão de Projeto / RN0025)
            entity.HasData(
                new Bandeira { Id = 1, Nome = "Visa", Ativo = true },
                new Bandeira { Id = 2, Nome = "Mastercard", Ativo = true },
                new Bandeira { Id = 3, Nome = "Elo", Ativo = true },
                new Bandeira { Id = 4, Nome = "American Express", Ativo = true },
                new Bandeira { Id = 5, Nome = "Hipercard", Ativo = true }
            );
        });

        // ==========================================
        // CARTAO
        // ==========================================
        modelBuilder.Entity<Cartao>(entity =>
        {
            entity.ToTable("CARTAO");

            entity.HasKey(c => c.Id).HasName("pk_cartao");
            entity.Property(c => c.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(c => c.ClienteId)
                .HasColumnName("cliente_id")
                .IsRequired();

            entity.Property(c => c.BandeiraId)
                .HasColumnName("bandeira_id")
                .IsRequired();

            entity.Property(c => c.NumeroCartao)
                .HasColumnName("numero_cartao")
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(c => c.NomeImpresso)
                .HasColumnName("nome_impresso")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(c => c.DataValidade)
                .HasColumnName("dt_validade")
                .HasMaxLength(7)
                .IsRequired();

            entity.Property(c => c.Cvv)
                .HasColumnName("cvv")
                .HasMaxLength(4)
                .IsRequired();

            entity.Property(c => c.Preferencial)
                .HasColumnName("preferencial")
                .HasDefaultValue(false)
                .IsRequired();
        });

        // ==========================================
        // LOG_AUDITORIA (independente)
        // ==========================================
        modelBuilder.Entity<LogAuditoria>(entity =>
        {
            entity.ToTable("LOG_AUDITORIA");

            entity.HasKey(l => l.Id).HasName("pk_log_auditoria");
            entity.Property(l => l.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(l => l.Entidade)
                .HasColumnName("entidade")
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(l => l.RegistroId)
                .HasColumnName("registro_id")
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(l => l.Operacao)
                .HasColumnName("operacao")
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(l => l.DadosAlterados)
                .HasColumnName("dados_alterados")
                .HasColumnType("jsonb")
                .IsRequired();

            entity.Property(l => l.DataHora)
                .HasColumnName("dt_hora")
                .HasColumnType("timestamp with time zone")
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .IsRequired();

            entity.Property(l => l.UsuarioResponsavel)
                .HasColumnName("usuario_responsavel")
                .HasMaxLength(100)
                .IsRequired();
        });

        // ==========================================
        // PRODUTO
        // ==========================================
        modelBuilder.Entity<Produto>(entity =>
        {
            entity.ToTable("PRODUTO");

            entity.HasKey(p => p.Id).HasName("pk_produto");
            entity.Property(p => p.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(p => p.Codigo)
                .HasColumnName("codigo")
                .HasMaxLength(50)
                .IsRequired();
            entity.HasIndex(p => p.Codigo)
                .IsUnique()
                .HasDatabaseName("uq_produto_codigo");

            entity.Property(p => p.Nome)
                .HasColumnName("nome")
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(p => p.Marca)
                .HasColumnName("marca")
                .HasMaxLength(60)
                .IsRequired();

            entity.Property(p => p.Categoria)
                .HasColumnName("categoria")
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(p => p.Preco)
                .HasColumnName("preco")
                .HasColumnType("numeric(10,2)")
                .IsRequired();

            entity.Property(p => p.Descricao)
                .HasColumnName("descricao")
                .HasColumnType("text")
                .IsRequired();

            entity.Property(p => p.ImagemUrl)
                .HasColumnName("imagem_url")
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(p => p.Ativo)
                .HasColumnName("ativo")
                .HasDefaultValue(true)
                .IsRequired();

            entity.HasMany(p => p.Variacoes)
                .WithOne(v => v.Produto)
                .HasForeignKey(v => v.ProdutoId)
                .HasConstraintName("fk_produto_variacao_produto")
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ==========================================
        // PRODUTO_VARIACAO
        // ==========================================
        modelBuilder.Entity<ProdutoVariacao>(entity =>
        {
            entity.ToTable("PRODUTO_VARIACAO");

            entity.HasKey(v => v.Id).HasName("pk_produto_variacao");
            entity.Property(v => v.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(v => v.ProdutoId)
                .HasColumnName("produto_id")
                .IsRequired();

            entity.Property(v => v.Tamanho)
                .HasColumnName("tamanho")
                .IsRequired();

            entity.Property(v => v.Ativo)
                .HasColumnName("ativo")
                .HasDefaultValue(true)
                .IsRequired();

            entity.HasIndex(v => new { v.ProdutoId, v.Tamanho })
                .IsUnique()
                .HasDatabaseName("uq_produto_variacao_tamanho");

            entity.HasOne(v => v.Estoque)
                .WithOne(e => e.ProdutoVariacao)
                .HasForeignKey<Estoque>(e => e.ProdutoVariacaoId)
                .HasConstraintName("fk_estoque_produto_variacao")
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(v => v.ItensPedido)
                .WithOne(i => i.ProdutoVariacao)
                .HasForeignKey(i => i.ProdutoVariacaoId)
                .HasConstraintName("fk_item_pedido_produto_variacao")
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ==========================================
        // ESTOQUE
        // ==========================================
        modelBuilder.Entity<Estoque>(entity =>
        {
            entity.ToTable("ESTOQUE");

            entity.HasKey(e => e.Id).HasName("pk_estoque");
            entity.Property(e => e.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(e => e.ProdutoVariacaoId)
                .HasColumnName("produto_variacao_id")
                .IsRequired();
            entity.HasIndex(e => e.ProdutoVariacaoId)
                .IsUnique()
                .HasDatabaseName("uq_estoque_produto_variacao");

            entity.Property(e => e.Quantidade)
                .HasColumnName("quantidade")
                .HasDefaultValue(0)
                .IsRequired();
        });

        // ==========================================
        // CUPOM
        // ==========================================
        modelBuilder.Entity<Cupom>(entity =>
        {
            entity.ToTable("CUPOM");

            entity.HasKey(c => c.Id).HasName("pk_cupom");
            entity.Property(c => c.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(c => c.Codigo)
                .HasColumnName("codigo")
                .HasMaxLength(50)
                .IsRequired();
            entity.HasIndex(c => c.Codigo)
                .IsUnique()
                .HasDatabaseName("uq_cupom_codigo");

            entity.Property(c => c.Tipo)
                .HasColumnName("tipo")
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(c => c.Valor)
                .HasColumnName("valor")
                .HasColumnType("numeric(10,2)")
                .IsRequired();

            entity.Property(c => c.ClienteId)
                .HasColumnName("cliente_id")
                .IsRequired(false);

            entity.HasOne(c => c.Cliente)
                .WithMany()
                .HasForeignKey(c => c.ClienteId)
                .HasConstraintName("fk_cupom_cliente")
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(c => c.Pagamentos)
                .WithOne(p => p.Cupom)
                .HasForeignKey(p => p.CupomId)
                .HasConstraintName("fk_pagamento_pedido_cupom")
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ==========================================
        // PEDIDO
        // ==========================================
        modelBuilder.Entity<Pedido>(entity =>
        {
            entity.ToTable("PEDIDO");

            entity.HasKey(p => p.Id).HasName("pk_pedido");
            entity.Property(p => p.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(p => p.Codigo)
                .HasColumnName("codigo")
                .HasMaxLength(30)
                .IsRequired();
            entity.HasIndex(p => p.Codigo)
                .IsUnique()
                .HasDatabaseName("uq_pedido_codigo");

            entity.Property(p => p.ClienteId)
                .HasColumnName("cliente_id")
                .IsRequired();

            entity.Property(p => p.EnderecoEntregaId)
                .HasColumnName("endereco_entrega_id")
                .IsRequired(false);

            entity.Property(p => p.DataPedido)
                .HasColumnName("dt_pedido")
                .HasColumnType("timestamp with time zone")
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .IsRequired();

            entity.Property(p => p.Status)
                .HasColumnName("status")
                .HasMaxLength(30)
                .HasDefaultValue(Pedido.StatusEmProcessamento)
                .IsRequired();

            entity.Property(p => p.Subtotal)
                .HasColumnName("subtotal")
                .HasColumnType("numeric(10,2)")
                .IsRequired();

            entity.Property(p => p.ValorFrete)
                .HasColumnName("valor_frete")
                .HasColumnType("numeric(10,2)")
                .IsRequired();

            entity.Property(p => p.ValorTotal)
                .HasColumnName("valor_total")
                .HasColumnType("numeric(10,2)")
                .IsRequired();

            // Snapshot histórico do endereço de entrega
            entity.Property(p => p.EntregaTipoResidencia)
                .HasColumnName("entrega_tipo_residencia")
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(p => p.EntregaTipoLogradouro)
                .HasColumnName("entrega_tipo_logradouro")
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(p => p.EntregaLogradouro)
                .HasColumnName("entrega_logradouro")
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(p => p.EntregaNumero)
                .HasColumnName("entrega_numero")
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(p => p.EntregaComplemento)
                .HasColumnName("entrega_complemento")
                .HasMaxLength(100)
                .IsRequired(false);

            entity.Property(p => p.EntregaBairro)
                .HasColumnName("entrega_bairro")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(p => p.EntregaCep)
                .HasColumnName("entrega_cep")
                .HasMaxLength(8)
                .IsRequired();

            entity.Property(p => p.EntregaCidade)
                .HasColumnName("entrega_cidade")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(p => p.EntregaEstado)
                .HasColumnName("entrega_estado")
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(p => p.EntregaPais)
                .HasColumnName("entrega_pais")
                .HasMaxLength(60)
                .IsRequired();

            entity.Property(p => p.EntregaObservacoes)
                .HasColumnName("entrega_observacoes")
                .HasMaxLength(255)
                .IsRequired(false);

            entity.HasOne(p => p.Cliente)
                .WithMany()
                .HasForeignKey(p => p.ClienteId)
                .HasConstraintName("fk_pedido_cliente")
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.EnderecoEntrega)
                .WithMany()
                .HasForeignKey(p => p.EnderecoEntregaId)
                .HasConstraintName("fk_pedido_endereco_entrega")
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(p => p.Itens)
                .WithOne(i => i.Pedido)
                .HasForeignKey(i => i.PedidoId)
                .HasConstraintName("fk_item_pedido_pedido")
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(p => p.Pagamentos)
                .WithOne(pg => pg.Pedido)
                .HasForeignKey(pg => pg.PedidoId)
                .HasConstraintName("fk_pagamento_pedido_pedido")
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ==========================================
        // ITEM_PEDIDO
        // ==========================================
        modelBuilder.Entity<ItemPedido>(entity =>
        {
            entity.ToTable("ITEM_PEDIDO");

            entity.HasKey(i => i.Id).HasName("pk_item_pedido");
            entity.Property(i => i.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(i => i.PedidoId)
                .HasColumnName("pedido_id")
                .IsRequired();

            entity.Property(i => i.ProdutoVariacaoId)
                .HasColumnName("produto_variacao_id")
                .IsRequired();

            entity.Property(i => i.Quantidade)
                .HasColumnName("quantidade")
                .IsRequired();

            entity.Property(i => i.PrecoUnitario)
                .HasColumnName("preco_unitario")
                .HasColumnType("numeric(10,2)")
                .IsRequired();
        });

        // ==========================================
        // PAGAMENTO_PEDIDO
        // ==========================================
        modelBuilder.Entity<PagamentoPedido>(entity =>
        {
            entity.ToTable("PAGAMENTO_PEDIDO", t =>
            {
                t.HasCheckConstraint(
                    "chk_pagamento_origem",
                    @"(forma_pagamento = 'CARTAO_CREDITO' AND cartao_id IS NOT NULL AND cupom_id IS NULL AND bandeira_id IS NULL AND cartao_ultimos_digitos IS NULL AND cartao_nome_impresso IS NULL)
                   OR (forma_pagamento = 'CARTAO_CREDITO' AND cartao_id IS NULL AND cupom_id IS NULL AND bandeira_id IS NOT NULL AND cartao_ultimos_digitos IS NOT NULL AND cartao_nome_impresso IS NOT NULL)
                   OR (forma_pagamento IN ('CUPOM_PROMOCIONAL', 'CUPOM_TROCA') AND cupom_id IS NOT NULL AND cartao_id IS NULL AND bandeira_id IS NULL AND cartao_ultimos_digitos IS NULL AND cartao_nome_impresso IS NULL)");
            });

            entity.HasKey(pg => pg.Id).HasName("pk_pagamento_pedido");
            entity.Property(pg => pg.Id)
                .HasColumnName("id")
                .UseIdentityAlwaysColumn();

            entity.Property(pg => pg.PedidoId)
                .HasColumnName("pedido_id")
                .IsRequired();

            entity.Property(pg => pg.FormaPagamento)
                .HasColumnName("forma_pagamento")
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(pg => pg.Valor)
                .HasColumnName("valor")
                .HasColumnType("numeric(10,2)")
                .IsRequired();

            entity.Property(pg => pg.CartaoId)
                .HasColumnName("cartao_id")
                .IsRequired(false);

            entity.Property(pg => pg.BandeiraId)
                .HasColumnName("bandeira_id")
                .IsRequired(false);

            entity.Property(pg => pg.CartaoUltimosDigitos)
                .HasColumnName("cartao_ultimos_digitos")
                .HasMaxLength(4)
                .IsRequired(false);

            entity.Property(pg => pg.CartaoNomeImpresso)
                .HasColumnName("cartao_nome_impresso")
                .HasMaxLength(100)
                .IsRequired(false);

            entity.Property(pg => pg.CupomId)
                .HasColumnName("cupom_id")
                .IsRequired(false);

            // Índice único parcial para garantir uso único concorrente de cupom de troca
            entity.HasIndex(pg => pg.CupomId)
                .IsUnique()
                .HasFilter("forma_pagamento = 'CUPOM_TROCA'")
                .HasDatabaseName("uq_pagamento_pedido_cupom_troca");

            entity.HasOne(pg => pg.Cartao)
                .WithMany()
                .HasForeignKey(pg => pg.CartaoId)
                .HasConstraintName("fk_pagamento_pedido_cartao")
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(pg => pg.Bandeira)
                .WithMany()
                .HasForeignKey(pg => pg.BandeiraId)
                .HasConstraintName("fk_pagamento_pedido_bandeira")
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}