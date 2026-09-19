using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Bandeiras;

namespace RunWay.Api.Services;

public class BandeiraService : IBandeiraService
{
    private readonly RunWayDbContext _context;

    public BandeiraService(RunWayDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// RN0025: Lista todas as bandeiras de cartão ativas no sistema.
    /// </summary>
    public async Task<List<BandeiraResponseDto>> ListarAtivasAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Bandeiras
            .AsNoTracking()
            .Where(b => b.Ativo)
            .OrderBy(b => b.Nome)
            .Select(b => new BandeiraResponseDto
            {
                Id = b.Id,
                Nome = b.Nome
            })
            .ToListAsync(cancellationToken);
    }
}
