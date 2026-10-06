using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Cupons;
using RunWay.Api.Exceptions;
using RunWay.Api.Models;

namespace RunWay.Api.Services;

public class CupomService : ICupomService
{
    private readonly RunWayDbContext _context;

    public CupomService(RunWayDbContext context)
    {
        _context = context;
    }

    public async Task<List<CupomResponseDto>> ListarCuponsTrocaClienteAsync(string codigoCliente, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigoCliente))
        {
            throw new ValidationException("Código do cliente é obrigatório.");
        }

        var cliente = await _context.Clientes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Codigo == codigoCliente, cancellationToken);

        if (cliente == null)
        {
            throw new NotFoundException("Cliente não encontrado.");
        }

        var cupons = await _context.Cupons
            .AsNoTracking()
            .Where(c => c.Tipo == Cupom.TipoTroca && c.ClienteId == cliente.Id)
            .Where(c => !_context.PagamentosPedido.Any(pp => pp.CupomId == c.Id && pp.FormaPagamento == PagamentoPedido.FormaCupomTroca))
            .OrderBy(c => c.Id)
            .Select(c => new CupomResponseDto
            {
                Id = c.Id,
                Codigo = c.Codigo,
                Tipo = c.Tipo,
                Valor = c.Valor,
                ClienteId = c.ClienteId
            })
            .ToListAsync(cancellationToken);

        return cupons;
    }

    public async Task<CupomResponseDto> ConsultarCupomAsync(ConsultarCupomRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.CodigoCupom))
        {
            throw new ValidationException("Informe o código do cupom.");
        }

        var codigo = request.CodigoCupom.Trim().ToUpperInvariant();

        var cupom = await _context.Cupons
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Codigo == codigo, cancellationToken);

        if (cupom == null)
        {
            throw new NotFoundException($"Cupom '{codigo}' não encontrado.");
        }

        if (cupom.Tipo == Cupom.TipoTroca)
        {
            if (cupom.ClienteId.HasValue)
            {
                if (string.IsNullOrWhiteSpace(request.CodigoCliente))
                {
                    throw new ValidationException("Informe o cliente para consultar este cupom de troca.");
                }

                var cliente = await _context.Clientes
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Codigo == request.CodigoCliente, cancellationToken);

                if (cliente == null || cupom.ClienteId != cliente.Id)
                {
                    throw new ValidationException($"O cupom de troca '{codigo}' pertence a outro cliente e não pode ser utilizado.");
                }
            }

            bool jaUtilizado = await _context.PagamentosPedido
                .AnyAsync(pp => pp.CupomId == cupom.Id && pp.FormaPagamento == PagamentoPedido.FormaCupomTroca, cancellationToken);

            if (jaUtilizado)
            {
                throw new ValidationException($"O cupom de troca '{codigo}' já foi utilizado em outra compra.");
            }
        }

        return new CupomResponseDto
        {
            Id = cupom.Id,
            Codigo = cupom.Codigo,
            Tipo = cupom.Tipo,
            Valor = cupom.Valor,
            ClienteId = cupom.ClienteId
        };
    }
}
