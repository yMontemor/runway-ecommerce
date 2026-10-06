using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Produtos;

namespace RunWay.Api.Services;

public class ProdutoService : IProdutoService
{
    private readonly RunWayDbContext _context;

    public ProdutoService(RunWayDbContext context)
    {
        _context = context;
    }

    public async Task<List<ProdutoResponseDto>> ListarAtivosAsync(CancellationToken cancellationToken = default)
    {
        var produtos = await _context.Produtos
            .AsNoTracking()
            .Where(p => p.Ativo)
            .Include(p => p.Variacoes.Where(v => v.Ativo))
                .ThenInclude(v => v.Estoque)
            .OrderBy(p => p.Id)
            .ToListAsync(cancellationToken);

        return produtos.Select(p => MapearParaDto(p)).ToList();
    }

    public async Task<ProdutoResponseDto?> ObterPorIdOuCodigoAsync(string idOuCodigo, CancellationToken cancellationToken = default)
    {
        bool isNumericId = int.TryParse(idOuCodigo, out int id);

        var produto = await _context.Produtos
            .AsNoTracking()
            .Where(p => p.Ativo && ((isNumericId && p.Id == id) || p.Codigo == idOuCodigo))
            .Include(p => p.Variacoes.Where(v => v.Ativo))
                .ThenInclude(v => v.Estoque)
            .FirstOrDefaultAsync(cancellationToken);

        return produto == null ? null : MapearParaDto(produto);
    }

    public async Task<ValidacaoEstoqueResponseDto> ValidarEstoqueAsync(ValidacaoEstoqueRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null || request.Itens == null || request.Itens.Count == 0)
        {
            return new ValidacaoEstoqueResponseDto
            {
                Valido = true,
                Mensagem = "Nenhum item informado para validação."
            };
        }

        var variacaoIds = request.Itens.Select(i => i.ProdutoVariacaoId).Distinct().ToList();

        var variacoesDb = await _context.ProdutoVariacoes
            .AsNoTracking()
            .Include(v => v.Produto)
            .Include(v => v.Estoque)
            .Where(v => variacaoIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, cancellationToken);

        var resultadoItens = new List<ItemValidacaoEstoqueResponseDto>();
        bool todosValidos = true;

        foreach (var item in request.Itens)
        {
            if (!variacoesDb.TryGetValue(item.ProdutoVariacaoId, out var variacao) || !variacao.Ativo || (variacao.Produto != null && !variacao.Produto.Ativo))
            {
                todosValidos = false;
                resultadoItens.Add(new ItemValidacaoEstoqueResponseDto
                {
                    ProdutoVariacaoId = item.ProdutoVariacaoId,
                    NomeProduto = variacao?.Produto?.Nome ?? "Produto",
                    Tamanho = variacao?.Tamanho ?? 0,
                    QuantidadeSolicitada = item.Quantidade,
                    QuantidadeDisponivel = 0,
                    Disponivel = false,
                    Mensagem = "Este tamanho está indisponível no momento."
                });
                continue;
            }

            int estoqueDisponivel = variacao.Estoque?.Quantidade ?? 0;
            string nomeProduto = variacao.Produto?.Nome ?? "Produto";

            if (item.Quantidade <= 0)
            {
                todosValidos = false;
                resultadoItens.Add(new ItemValidacaoEstoqueResponseDto
                {
                    ProdutoVariacaoId = item.ProdutoVariacaoId,
                    NomeProduto = nomeProduto,
                    Tamanho = variacao.Tamanho,
                    QuantidadeSolicitada = item.Quantidade,
                    QuantidadeDisponivel = estoqueDisponivel,
                    Disponivel = false,
                    Mensagem = "A quantidade deve ser de pelo menos 1 unidade."
                });
            }
            else if (estoqueDisponivel <= 0)
            {
                todosValidos = false;
                resultadoItens.Add(new ItemValidacaoEstoqueResponseDto
                {
                    ProdutoVariacaoId = item.ProdutoVariacaoId,
                    NomeProduto = nomeProduto,
                    Tamanho = variacao.Tamanho,
                    QuantidadeSolicitada = item.Quantidade,
                    QuantidadeDisponivel = 0,
                    Disponivel = false,
                    Mensagem = "Este tamanho está esgotado no momento."
                });
            }
            else if (item.Quantidade > estoqueDisponivel)
            {
                todosValidos = false;
                string mensagemEstoque = estoqueDisponivel == 1
                    ? "Há apenas 1 unidade disponível deste produto."
                    : $"Há apenas {estoqueDisponivel} unidades disponíveis deste produto.";

                resultadoItens.Add(new ItemValidacaoEstoqueResponseDto
                {
                    ProdutoVariacaoId = item.ProdutoVariacaoId,
                    NomeProduto = nomeProduto,
                    Tamanho = variacao.Tamanho,
                    QuantidadeSolicitada = item.Quantidade,
                    QuantidadeDisponivel = estoqueDisponivel,
                    Disponivel = false,
                    Mensagem = mensagemEstoque
                });
            }
            else
            {
                resultadoItens.Add(new ItemValidacaoEstoqueResponseDto
                {
                    ProdutoVariacaoId = item.ProdutoVariacaoId,
                    NomeProduto = nomeProduto,
                    Tamanho = variacao.Tamanho,
                    QuantidadeSolicitada = item.Quantidade,
                    QuantidadeDisponivel = estoqueDisponivel,
                    Disponivel = true,
                    Mensagem = "Item disponível em estoque."
                });
            }
        }

        string mensagemGeral;
        if (todosValidos)
        {
            mensagemGeral = "Todos os itens estão disponíveis em estoque.";
        }
        else if (resultadoItens.Count == 1)
        {
            mensagemGeral = resultadoItens[0].Mensagem;
        }
        else
        {
            var primeiroInvalido = resultadoItens.FirstOrDefault(i => !i.Disponivel);
            mensagemGeral = primeiroInvalido != null 
                ? $"{primeiroInvalido.NomeProduto} (Tamanho {primeiroInvalido.Tamanho}): {primeiroInvalido.Mensagem}"
                : "Alguns itens no carrinho não possuem estoque suficiente.";
        }

        return new ValidacaoEstoqueResponseDto
        {
            Valido = todosValidos,
            Mensagem = mensagemGeral,
            Itens = resultadoItens
        };
    }

    private static ProdutoResponseDto MapearParaDto(Models.Produto p)
    {
        return new ProdutoResponseDto
        {
            Id = p.Id,
            Codigo = p.Codigo,
            Nome = p.Nome,
            Marca = p.Marca,
            Categoria = p.Categoria,
            Preco = p.Preco,
            Descricao = p.Descricao,
            ImagemUrl = p.ImagemUrl,
            Ativo = p.Ativo,
            Variacoes = p.Variacoes
                .Where(v => v.Ativo)
                .OrderBy(v => v.Tamanho)
                .Select(v => new ProdutoVariacaoResponseDto
                {
                    Id = v.Id,
                    ProdutoId = v.ProdutoId,
                    Tamanho = v.Tamanho,
                    QuantidadeEstoque = v.Estoque?.Quantidade ?? 0,
                    Ativo = v.Ativo
                })
                .ToList()
        };
    }
}
