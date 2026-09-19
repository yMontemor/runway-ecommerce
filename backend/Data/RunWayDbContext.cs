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
    }
}