using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("RunWayDatabase")
    ?? throw new InvalidOperationException(
        "A connection string 'RunWayDatabase' não foi configurada.");

var csb = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);

if (builder.Environment.IsEnvironment("Testing"))
{
    if (!string.Equals(csb.Database, "runway_test", StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            $"[BLOQUEIO DE SEGURANÇA] O ambiente Testing exige conexão obrigatória com o banco 'runway_test'. Banco configurado: '{csb.Database}'. Inicialização abortada para evitar contaminação do banco principal.");
    }

    if (string.IsNullOrWhiteSpace(csb.Password))
    {
        var pgPassword = Environment.GetEnvironmentVariable("PGPASSWORD");
        csb.Password = !string.IsNullOrWhiteSpace(pgPassword) ? pgPassword : "123";
        connectionString = csb.ConnectionString;
    }
}

builder.Services.AddDbContext<RunWayDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddControllers();

builder.Services.AddScoped<RunWay.Api.Services.IClienteService, RunWay.Api.Services.ClienteService>();
builder.Services.AddScoped<RunWay.Api.Services.IBandeiraService, RunWay.Api.Services.BandeiraService>();
builder.Services.AddScoped<RunWay.Api.Services.IAuditoriaService, RunWay.Api.Services.AuditoriaService>();
builder.Services.AddScoped<RunWay.Api.Services.ICarrinhoService, RunWay.Api.Services.CarrinhoService>();
builder.Services.AddScoped<RunWay.Api.Services.IProdutoService, RunWay.Api.Services.ProdutoService>();
builder.Services.AddScoped<RunWay.Api.Services.IFreteService, RunWay.Api.Services.FreteService>();
builder.Services.AddScoped<RunWay.Api.Services.ICupomService, RunWay.Api.Services.CupomService>();
builder.Services.AddScoped<RunWay.Api.Services.IPagamentoService, RunWay.Api.Services.PagamentoService>();
builder.Services.AddScoped<RunWay.Api.Services.IPedidoService, RunWay.Api.Services.PedidoService>();
builder.Services.AddScoped<RunWay.Api.Services.ITrocaService, RunWay.Api.Services.TrocaService>();
builder.Services.AddScoped<RunWay.Api.Services.IAnaliseService, RunWay.Api.Services.AnaliseService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("RunWayFrontendPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("RunWayFrontendPolicy");

app.MapGet("/api/health", async (RunWayDbContext dbContext, CancellationToken cancellationToken) =>
{
    var databaseName = dbContext.Database.GetDbConnection().Database;
    try
    {
        var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
        if (!canConnect)
        {
            return Results.Json(
                new
                {
                    status = "unhealthy",
                    banco = databaseName,
                    conectado = false,
                    timestampUtc = DateTimeOffset.UtcNow
                },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        return Results.Ok(new
        {
            status = "ok",
            banco = databaseName,
            conectado = true,
            timestampUtc = DateTimeOffset.UtcNow
        });
    }
    catch (Exception)
    {
        return Results.Json(
            new
            {
                status = "unhealthy",
                banco = databaseName,
                conectado = false,
                erro = "Falha ao verificar conectividade com o banco de dados.",
                timestampUtc = DateTimeOffset.UtcNow
            },
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapControllers();

app.Run();
