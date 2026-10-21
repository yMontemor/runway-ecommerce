using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace RunWay.Api.Filters;

/// <summary>
/// Filtro de autorização para o perfil Administrador (Cartão 04 / RF0055).
/// Valida a credencial administrativa de demonstração fornecida via cabeçalho HTTP
/// (Authorization: Bearer <chave> ou X-Admin-Key) contra a configuração segura do servidor.
/// Retorna HTTP 401 Unauthorized se a credencial estiver ausente ou for inválida.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AdminAuthorizeAttribute : Attribute, IAsyncActionFilter
{
    public const string HeaderAuthorization = "Authorization";
    public const string HeaderAdminKey = "X-Admin-Key";
    public const string BearerPrefix = "Bearer ";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var configuration = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();

        // Obtém a chave configurada no ambiente do servidor (variável de ambiente, UserSecrets ou appsettings)
        var expectedKey = configuration["RunWay:AdminSecretKey"];
        if (string.IsNullOrWhiteSpace(expectedKey))
        {
            expectedKey = configuration["RUNWAY_ADMIN_KEY"];
        }
        if (string.IsNullOrWhiteSpace(expectedKey))
        {
            expectedKey = Environment.GetEnvironmentVariable("RUNWAY_ADMIN_KEY")
                       ?? Environment.GetEnvironmentVariable("RunWay__AdminSecretKey");
        }

        // Extrai a credencial do cabeçalho da requisição
        string? providedKey = null;

        var authHeader = context.HttpContext.Request.Headers[HeaderAuthorization].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(authHeader))
        {
            if (authHeader.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase))
            {
                providedKey = authHeader.Substring(BearerPrefix.Length).Trim();
            }
            else
            {
                providedKey = authHeader.Trim();
            }
        }

        if (string.IsNullOrWhiteSpace(providedKey))
        {
            providedKey = context.HttpContext.Request.Headers[HeaderAdminKey].FirstOrDefault()?.Trim();
        }

        // Se o servidor não tiver chave configurada ou a chave fornecida for nula/vazia/divergente: 401 Unauthorized
        if (string.IsNullOrWhiteSpace(expectedKey) ||
            string.IsNullOrWhiteSpace(providedKey) ||
            !string.Equals(expectedKey, providedKey, StringComparison.Ordinal))
        {
            context.Result = new UnauthorizedObjectResult(new
            {
                erro = "Acesso não autorizado. Credencial administrativa ausente ou inválida (RF0055)."
            });
            return;
        }

        await next();
    }
}
