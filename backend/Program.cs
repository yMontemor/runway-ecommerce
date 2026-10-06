using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("RunWayDatabase")
    ?? throw new InvalidOperationException(
        "A connection string 'RunWayDatabase' não foi configurada.");

builder.Services.AddDbContext<RunWayDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddControllers();

builder.Services.AddScoped<RunWay.Api.Services.IClienteService, RunWay.Api.Services.ClienteService>();
builder.Services.AddScoped<RunWay.Api.Services.IBandeiraService, RunWay.Api.Services.BandeiraService>();
builder.Services.AddScoped<RunWay.Api.Services.IAuditoriaService, RunWay.Api.Services.AuditoriaService>();
builder.Services.AddScoped<RunWay.Api.Services.IProdutoService, RunWay.Api.Services.ProdutoService>();
builder.Services.AddScoped<RunWay.Api.Services.IFreteService, RunWay.Api.Services.FreteService>();
builder.Services.AddScoped<RunWay.Api.Services.ICupomService, RunWay.Api.Services.CupomService>();
builder.Services.AddScoped<RunWay.Api.Services.IPagamentoService, RunWay.Api.Services.PagamentoService>();
builder.Services.AddScoped<RunWay.Api.Services.IPedidoService, RunWay.Api.Services.PedidoService>();

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

app.MapControllers();

app.Run();
