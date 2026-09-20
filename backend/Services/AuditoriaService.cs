using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using RunWay.Api.Data;
using RunWay.Api.Models;

namespace RunWay.Api.Services;

/// <summary>
/// RNF0012: Implementação do serviço explícito de auditoria de operações de escrita.
/// Persiste logs na tabela LOG_AUDITORIA sem utilizar interceptores ou triggers.
/// Não chama SaveChangesAsync() internamente para garantir atomicidade transacional com o chamador.
/// </summary>
public class AuditoriaService : IAuditoriaService
{
    private readonly RunWayDbContext _context;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        WriteIndented = false
    };

    private class PayloadAuditoria
    {
        [JsonPropertyName("dadosAnteriores")]
        public object? DadosAnteriores { get; set; }

        [JsonPropertyName("dadosNovos")]
        public object? DadosNovos { get; set; }
    }

    public AuditoriaService(RunWayDbContext context)
    {
        _context = context;
    }

    public async Task RegistrarAsync(
        string entidade,
        string registroId,
        string operacao,
        object? dadosAnteriores,
        object? dadosNovos,
        string usuarioResponsavel = "ADMIN",
        CancellationToken cancellationToken = default)
    {
        var log = CriarLogAuditoria(entidade, registroId, operacao, dadosAnteriores, dadosNovos, usuarioResponsavel);
        await _context.LogsAuditoria.AddAsync(log, cancellationToken);
    }

    public void Registrar(
        string entidade,
        string registroId,
        string operacao,
        object? dadosAnteriores,
        object? dadosNovos,
        string usuarioResponsavel = "ADMIN")
    {
        var log = CriarLogAuditoria(entidade, registroId, operacao, dadosAnteriores, dadosNovos, usuarioResponsavel);
        _context.LogsAuditoria.Add(log);
    }

    private static LogAuditoria CriarLogAuditoria(
        string entidade,
        string registroId,
        string operacao,
        object? dadosAnteriores,
        object? dadosNovos,
        string usuarioResponsavel)
    {
        var payload = new PayloadAuditoria
        {
            DadosAnteriores = dadosAnteriores,
            DadosNovos = dadosNovos
        };

        var json = JsonSerializer.Serialize(payload, JsonOptions);

        return new LogAuditoria
        {
            Entidade = entidade.Trim().ToUpperInvariant(),
            RegistroId = registroId.Trim(),
            Operacao = operacao.Trim().ToUpperInvariant(),
            DadosAlterados = json,
            DataHora = DateTimeOffset.UtcNow,
            UsuarioResponsavel = string.IsNullOrWhiteSpace(usuarioResponsavel) ? "ADMIN" : usuarioResponsavel.Trim()
        };
    }
}
