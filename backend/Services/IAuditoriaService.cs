namespace RunWay.Api.Services;

/// <summary>
/// RNF0012: Contrato do serviço de auditoria de operações de escrita (Inserção e Alteração).
/// Registra data, hora, usuário responsável e dados alterados na tabela LOG_AUDITORIA.
/// Os métodos adicionam a entidade ao DbContext sem chamar SaveChangesAsync() para
/// garantir atomicidade com a operação principal no mesmo commit.
/// </summary>
public interface IAuditoriaService
{
    /// <summary>
    /// Registra uma operação de auditoria de forma assíncrona adicionando ao DbContext.
    /// Não invoca SaveChangesAsync() para preservar a atomicidade com a transação principal.
    /// </summary>
    Task RegistrarAsync(
        string entidade,
        string registroId,
        string operacao,
        object? dadosAnteriores,
        object? dadosNovos,
        string usuarioResponsavel = "ADMIN",
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Registra uma operação de auditoria adicionando sincronamente ao DbContext.
    /// Não invoca SaveChangesAsync() para preservar a atomicidade com a transação principal.
    /// </summary>
    void Registrar(
        string entidade,
        string registroId,
        string operacao,
        object? dadosAnteriores,
        object? dadosNovos,
        string usuarioResponsavel = "ADMIN");
}
