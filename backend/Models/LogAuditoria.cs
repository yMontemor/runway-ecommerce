namespace RunWay.Api.Models;

public class LogAuditoria
{
    public long Id { get; set; }

    public string Entidade { get; set; } = string.Empty;

    public string RegistroId { get; set; } = string.Empty;

    public string Operacao { get; set; } = string.Empty;

    public string DadosAlterados { get; set; } = string.Empty;

    public DateTimeOffset DataHora { get; set; }

    public string UsuarioResponsavel { get; set; } = string.Empty;
}