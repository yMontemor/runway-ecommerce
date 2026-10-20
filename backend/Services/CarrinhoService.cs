using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Carrinho;
using RunWay.Api.Exceptions;
using RunWay.Api.Models;

namespace RunWay.Api.Services;

public class CarrinhoService : ICarrinhoService
{
    private readonly RunWayDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly int _tempoExpiracaoMinutos;
    private readonly int _alertaMinutosAntes;
    private readonly int _tempoExpiracaoProcessamentoMinutos;

    public CarrinhoService(RunWayDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
        _tempoExpiracaoMinutos = _configuration.GetValue<int>("Carrinho:TempoExpiracaoMinutos", 20);
        _alertaMinutosAntes = _configuration.GetValue<int>("Carrinho:AlertaMinutosAntes", 5);
        _tempoExpiracaoProcessamentoMinutos = _configuration.GetValue<int>("Pedido:TempoExpiracaoProcessamentoMinutos", 30);
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, List<ItemExpiradoResponseDto>> _ultimosItensExpiradosPorCarrinho = new();

    public async Task<CarrinhoResponseDto> ObterCarrinhoAsync(string codigoCliente, CancellationToken cancellationToken = default)
    {
        var cliente = await ObterClienteValidoAsync(codigoCliente, cancellationToken);
        var carrinho = await ObterQueryCarrinhoCompleto()
            .FirstOrDefaultAsync(c => c.ClienteId == cliente.Id, cancellationToken);

        if (carrinho == null)
        {
            return CriarCarrinhoVazioDto(codigoCliente);
        }

        // Verificar expiração automática por timestamp (RN0044 / RN0045 / RNF0042)
        if (carrinho.DataExpiracao <= DateTimeOffset.UtcNow)
        {
            List<ItemExpiradoResponseDto> itensExpirados;
            if (carrinho.Itens.Count > 0)
            {
                itensExpirados = carrinho.Itens.Select(i => new ItemExpiradoResponseDto
                {
                    ProdutoVariacaoId = i.ProdutoVariacaoId,
                    NomeProduto = i.ProdutoVariacao.Produto.Nome,
                    Tamanho = i.ProdutoVariacao.Tamanho,
                    Quantidade = i.Quantidade,
                    PrecoUnitario = i.ProdutoVariacao.Produto.Preco,
                    ImagemUrl = i.ProdutoVariacao.Produto.ImagemUrl,
                    Motivo = $"Reserva temporária expirada após {_tempoExpiracaoMinutos} minutos de inatividade."
                }).ToList();

                _ultimosItensExpiradosPorCarrinho[carrinho.Id] = itensExpirados;

                // Liberar itens do carrinho expirado
                _context.ItensCarrinho.RemoveRange(carrinho.Itens);
                carrinho.Itens.Clear();
                carrinho.DataAtualizacao = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }
            else
            {
                _ultimosItensExpiradosPorCarrinho.TryGetValue(carrinho.Id, out itensExpirados);
                itensExpirados ??= new List<ItemExpiradoResponseDto>();
            }

            var dtoExpirado = MapearParaDto(carrinho, codigoCliente);
            dtoExpirado.Expirado = true;
            dtoExpirado.TempoRestanteSegundos = 0;
            dtoExpirado.AlertaExpirando = false;
            dtoExpirado.MensagemExpiracao = $"Seu carrinho expirou por inatividade após {_tempoExpiracaoMinutos} minutos e as reservas de estoque foram liberadas.";
            dtoExpirado.ItensExpirados = itensExpirados;
            return dtoExpirado;
        }

        // RN0032: Revalidação de estoque na consulta do carrinho.
        // Se houver alteração real de estoque entre a montagem do carrinho e a finalização,
        // o backend ajusta automaticamente as quantidades, remove itens indisponíveis
        // e retorna avisos claros ao cliente.
        var avisosEstoque = new List<string>();
        bool houveAjusteEstoque = false;
        var itensParaRemover = new List<ItemCarrinho>();

        foreach (var item in carrinho.Itens.ToList())
        {
            int estoqueDisponivel = await CalcularDisponibilidadeInternalAsync(
                item.ProdutoVariacaoId,
                cliente.Id,
                cancellationToken);

            string nomeProd = item.ProdutoVariacao?.Produto?.Nome ?? "Produto";
            int tam = item.ProdutoVariacao?.Tamanho ?? 0;

            if (estoqueDisponivel <= 0)
            {
                itensParaRemover.Add(item);
                avisosEstoque.Add($"O produto '{nomeProd}' (Tam: {tam}) foi removido do carrinho por estar esgotado no estoque.");
                houveAjusteEstoque = true;
            }
            else if (item.Quantidade > estoqueDisponivel)
            {
                int qtdAnterior = item.Quantidade;
                item.Quantidade = estoqueDisponivel;
                avisosEstoque.Add($"A quantidade de '{nomeProd}' (Tam: {tam}) foi ajustada automaticamente de {qtdAnterior} para {estoqueDisponivel} un. devido à disponibilidade de estoque.");
                houveAjusteEstoque = true;
            }
        }

        if (itensParaRemover.Count > 0)
        {
            _context.ItensCarrinho.RemoveRange(itensParaRemover);
            foreach (var rem in itensParaRemover)
            {
                carrinho.Itens.Remove(rem);
            }
        }

        if (houveAjusteEstoque)
        {
            carrinho.DataAtualizacao = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
        }

        return MapearParaDto(carrinho, codigoCliente, avisosEstoque);
    }

    public async Task<CarrinhoResponseDto> AdicionarItemAsync(
        string codigoCliente,
        AdicionarItemCarrinhoRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
        {
            throw new ValidationException("Requisição inválida.");
        }

        if (request.Quantidade <= 0)
        {
            throw new ValidationException("A quantidade adicionada deve ser de pelo menos 1 unidade.");
        }

        var cliente = await ObterClienteValidoAsync(codigoCliente, cancellationToken);

        if (!cliente.Ativo)
        {
            throw new ValidationException("Clientes inativos não podem realizar compras ou reservar itens.");
        }

        var variacao = await _context.ProdutoVariacoes
            .Include(v => v.Produto)
            .FirstOrDefaultAsync(v => v.Id == request.ProdutoVariacaoId, cancellationToken);

        if (variacao == null || !variacao.Ativo || !variacao.Produto.Ativo)
        {
            throw new ValidationException("O produto ou tamanho selecionado não está disponível.");
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            // Bloqueio pessimista de concorrência com FOR UPDATE no PostgreSQL
            var estoque = await _context.Estoques
                .FromSqlInterpolated($"SELECT * FROM \"ESTOQUE\" WHERE produto_variacao_id = {request.ProdutoVariacaoId} FOR UPDATE")
                .FirstOrDefaultAsync(cancellationToken);

            if (estoque == null)
            {
                throw new ValidationException("Estoque não localizado para a variação informada.");
            }

            // Obter ou criar carrinho do cliente
            var carrinho = await _context.Carrinhos
                .Include(c => c.Itens)
                    .ThenInclude(i => i.ProdutoVariacao)
                        .ThenInclude(v => v.Produto)
                .FirstOrDefaultAsync(c => c.ClienteId == cliente.Id, cancellationToken);

            var agora = DateTimeOffset.UtcNow;

            if (carrinho == null)
            {
                carrinho = new Carrinho
                {
                    ClienteId = cliente.Id,
                    DataCriacao = agora,
                    DataAtualizacao = agora,
                    DataExpiracao = agora.AddMinutes(_tempoExpiracaoMinutos)
                };
                _context.Carrinhos.Add(carrinho);
                await _context.SaveChangesAsync(cancellationToken);
            }
            else if (carrinho.DataExpiracao <= agora && carrinho.Itens.Count > 0)
            {
                // Limpar itens de carrinho expirado antes de adicionar novo
                _context.ItensCarrinho.RemoveRange(carrinho.Itens);
                carrinho.Itens.Clear();
                carrinho.DataAtualizacao = agora;
                carrinho.DataExpiracao = agora.AddMinutes(_tempoExpiracaoMinutos);
            }

            // Calcular disponibilidade real (físico - pedidos em processamento - outros carrinhos válidos)
            int estoqueDisponivel = await CalcularDisponibilidadeInternalAsync(
                request.ProdutoVariacaoId,
                cliente.Id,
                cancellationToken);

            var itemExistente = carrinho.Itens.FirstOrDefault(i => i.ProdutoVariacaoId == request.ProdutoVariacaoId);
            int quantidadeJaNoCarrinho = itemExistente?.Quantidade ?? 0;
            int quantidadeTotalDesejada = quantidadeJaNoCarrinho + request.Quantidade;

            if (quantidadeTotalDesejada > estoqueDisponivel)
            {
                int adicionaisPossiveis = Math.Max(0, estoqueDisponivel - quantidadeJaNoCarrinho);
                if (adicionaisPossiveis == 0)
                {
                    throw new ValidationException(
                        $"Não há mais unidades disponíveis deste produto tamanho {variacao.Tamanho} para reserva no momento.");
                }

                string msgUnidades = adicionaisPossiveis == 1 ? "1 unidade disponível" : $"{adicionaisPossiveis} unidades disponíveis";
                throw new ValidationException(
                    $"Há apenas {msgUnidades} deste produto para reserva. Quantidade total solicitada no carrinho: {quantidadeTotalDesejada}.");
            }

            if (itemExistente != null)
            {
                itemExistente.Quantidade = quantidadeTotalDesejada;
            }
            else
            {
                var novoItem = new ItemCarrinho
                {
                    CarrinhoId = carrinho.Id,
                    ProdutoVariacaoId = variacao.Id,
                    Quantidade = request.Quantidade,
                    DataAdicionado = agora
                };
                carrinho.Itens.Add(novoItem);
                _context.ItensCarrinho.Add(novoItem);
            }

            // RN0044: O prazo deve considerar a inclusão do último item no carrinho
            carrinho.DataAtualizacao = agora;
            carrinho.DataExpiracao = agora.AddMinutes(_tempoExpiracaoMinutos);

            _ultimosItensExpiradosPorCarrinho.TryRemove(carrinho.Id, out _);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return await ObterCarrinhoAsync(codigoCliente, cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<CarrinhoResponseDto> AtualizarQuantidadeItemAsync(
        string codigoCliente,
        int produtoVariacaoId,
        int novaQuantidade,
        CancellationToken cancellationToken = default)
    {
        var cliente = await ObterClienteValidoAsync(codigoCliente, cancellationToken);

        if (novaQuantidade <= 0)
        {
            return await RemoverItemAsync(codigoCliente, produtoVariacaoId, cancellationToken);
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            // Bloqueio pessimista de concorrência com FOR UPDATE no PostgreSQL
            var estoque = await _context.Estoques
                .FromSqlInterpolated($"SELECT * FROM \"ESTOQUE\" WHERE produto_variacao_id = {produtoVariacaoId} FOR UPDATE")
                .FirstOrDefaultAsync(cancellationToken);

            if (estoque == null)
            {
                throw new ValidationException("Estoque não localizado para a variação informada.");
            }

            var carrinho = await _context.Carrinhos
                .Include(c => c.Itens)
                    .ThenInclude(i => i.ProdutoVariacao)
                        .ThenInclude(v => v.Produto)
                .FirstOrDefaultAsync(c => c.ClienteId == cliente.Id, cancellationToken);

            if (carrinho == null || carrinho.Itens.Count == 0)
            {
                throw new ValidationException("O carrinho está vazio.");
            }

            var agora = DateTimeOffset.UtcNow;
            if (carrinho.DataExpiracao <= agora)
            {
                throw new ValidationException("O tempo de reserva do carrinho expirou. Adicione os itens novamente.");
            }

            var item = carrinho.Itens.FirstOrDefault(i => i.ProdutoVariacaoId == produtoVariacaoId);
            if (item == null)
            {
                throw new NotFoundException("O item informado não foi encontrado no carrinho.");
            }

            // Se estiver aumentando a quantidade, validar disponibilidade
            if (novaQuantidade > item.Quantidade)
            {
                int estoqueDisponivel = await CalcularDisponibilidadeInternalAsync(
                    produtoVariacaoId,
                    cliente.Id,
                    cancellationToken);

                if (novaQuantidade > estoqueDisponivel)
                {
                    string msgUnidades = estoqueDisponivel == 1 ? "1 unidade disponível" : $"{estoqueDisponivel} unidades disponíveis";
                    throw new ValidationException(
                        $"Não é possível alterar a quantidade para {novaQuantidade}. Há apenas {msgUnidades} no momento.");
                }
            }

            item.Quantidade = novaQuantidade;

            // RN0044: Atualiza expiração ao alterar itens no carrinho
            carrinho.DataAtualizacao = agora;
            carrinho.DataExpiracao = agora.AddMinutes(_tempoExpiracaoMinutos);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return await ObterCarrinhoAsync(codigoCliente, cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<CarrinhoResponseDto> RemoverItemAsync(
        string codigoCliente,
        int produtoVariacaoId,
        CancellationToken cancellationToken = default)
    {
        var cliente = await ObterClienteValidoAsync(codigoCliente, cancellationToken);

        var carrinho = await _context.Carrinhos
            .Include(c => c.Itens)
            .FirstOrDefaultAsync(c => c.ClienteId == cliente.Id, cancellationToken);

        if (carrinho != null)
        {
            var item = carrinho.Itens.FirstOrDefault(i => i.ProdutoVariacaoId == produtoVariacaoId);
            if (item != null)
            {
                _context.ItensCarrinho.Remove(item);
                carrinho.Itens.Remove(item);
                carrinho.DataAtualizacao = DateTimeOffset.UtcNow;

                if (carrinho.Itens.Count == 0)
                {
                    carrinho.DataExpiracao = DateTimeOffset.UtcNow.AddMinutes(_tempoExpiracaoMinutos);
                }

                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        return await ObterCarrinhoAsync(codigoCliente, cancellationToken);
    }

    public async Task<CarrinhoResponseDto> LimparCarrinhoAsync(
        string codigoCliente,
        CancellationToken cancellationToken = default)
    {
        var cliente = await ObterClienteValidoAsync(codigoCliente, cancellationToken);

        var carrinho = await _context.Carrinhos
            .Include(c => c.Itens)
            .FirstOrDefaultAsync(c => c.ClienteId == cliente.Id, cancellationToken);

        if (carrinho != null)
        {
            _ultimosItensExpiradosPorCarrinho.TryRemove(carrinho.Id, out _);

            if (carrinho.Itens.Count > 0)
            {
                _context.ItensCarrinho.RemoveRange(carrinho.Itens);
                carrinho.Itens.Clear();
                carrinho.DataAtualizacao = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        return CriarCarrinhoVazioDto(codigoCliente);
    }

    public async Task<ExpiracaoCarrinhoResponseDto> ObterExpiracaoAsync(
        string codigoCliente,
        CancellationToken cancellationToken = default)
    {
        var cliente = await ObterClienteValidoAsync(codigoCliente, cancellationToken);

        var carrinho = await _context.Carrinhos
            .AsNoTracking()
            .Include(c => c.Itens)
            .FirstOrDefaultAsync(c => c.ClienteId == cliente.Id, cancellationToken);

        if (carrinho == null || carrinho.Itens.Count == 0)
        {
            return new ExpiracaoCarrinhoResponseDto
            {
                DataExpiracao = null,
                TempoRestanteSegundos = 0,
                AlertaExpirando = false,
                Expirado = false
            };
        }

        var agora = DateTimeOffset.UtcNow;
        bool expirado = carrinho.DataExpiracao <= agora;
        int segundosRestantes = expirado ? 0 : (int)(carrinho.DataExpiracao - agora).TotalSeconds;
        bool alertaExpirando = !expirado && segundosRestantes <= (_alertaMinutosAntes * 60);

        return new ExpiracaoCarrinhoResponseDto
        {
            DataExpiracao = carrinho.DataExpiracao,
            TempoRestanteSegundos = segundosRestantes,
            AlertaExpirando = alertaExpirando,
            Expirado = expirado,
            Mensagem = expirado ? "Carrinho expirado." : (alertaExpirando ? $"Atenção: sua reserva expira em menos de {_alertaMinutosAntes} minutos." : null)
        };
    }

    public async Task<int> ObterEstoqueDisponivelVariacaoAsync(
        int produtoVariacaoId,
        string? codigoCliente = null,
        CancellationToken cancellationToken = default)
    {
        int? clienteId = null;
        if (!string.IsNullOrWhiteSpace(codigoCliente))
        {
            var cliente = await _context.Clientes
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Codigo == codigoCliente.Trim(), cancellationToken);
            clienteId = cliente?.Id;
        }

        return await CalcularDisponibilidadeInternalAsync(produtoVariacaoId, clienteId, cancellationToken);
    }

    public async Task<Dictionary<int, int>> ObterEstoquesDisponiveisAsync(
        IEnumerable<int> produtoVariacaoIds,
        string? codigoCliente = null,
        CancellationToken cancellationToken = default)
    {
        var ids = produtoVariacaoIds.Distinct().ToList();
        var resultado = new Dictionary<int, int>();

        int? clienteId = null;
        if (!string.IsNullOrWhiteSpace(codigoCliente))
        {
            var cliente = await _context.Clientes
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Codigo == codigoCliente.Trim(), cancellationToken);
            clienteId = cliente?.Id;
        }

        foreach (var id in ids)
        {
            resultado[id] = await CalcularDisponibilidadeInternalAsync(id, clienteId, cancellationToken);
        }

        return resultado;
    }

    private async Task<int> CalcularDisponibilidadeInternalAsync(
        int produtoVariacaoId,
        int? clienteId,
        CancellationToken cancellationToken)
    {
        int estoqueFisico = await _context.Estoques
            .AsNoTracking()
            .Where(e => e.ProdutoVariacaoId == produtoVariacaoId)
            .Select(e => e.Quantidade)
            .FirstOrDefaultAsync(cancellationToken);

        var agora = DateTimeOffset.UtcNow;
        var cutoffProcessamento = agora.AddMinutes(-_tempoExpiracaoProcessamentoMinutos);

        // Pedidos em "EM PROCESSAMENTO" dentro da janela de validade bloqueiam estoque temporariamente
        int pedidosEmProcessamento = await _context.ItensPedido
            .AsNoTracking()
            .Where(i => i.ProdutoVariacaoId == produtoVariacaoId
                     && i.Pedido.Status == Pedido.StatusEmProcessamento
                     && i.Pedido.DataPedido >= cutoffProcessamento)
            .SumAsync(i => i.Quantidade, cancellationToken);

        // Carrinhos válidos e ativos de OUTROS clientes bloqueiam estoque temporariamente
        int reservasOutrosCarrinhos = await _context.ItensCarrinho
            .AsNoTracking()
            .Where(i => i.ProdutoVariacaoId == produtoVariacaoId
                     && i.Carrinho.DataExpiracao > agora
                     && (!clienteId.HasValue || i.Carrinho.ClienteId != clienteId.Value))
            .SumAsync(i => i.Quantidade, cancellationToken);

        return Math.Max(0, estoqueFisico - pedidosEmProcessamento - reservasOutrosCarrinhos);
    }

    private async Task<Cliente> ObterClienteValidoAsync(string codigoCliente, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(codigoCliente))
        {
            throw new ValidationException("Código do cliente é obrigatório.");
        }

        var cliente = await _context.Clientes
            .FirstOrDefaultAsync(c => c.Codigo == codigoCliente.Trim(), cancellationToken);

        if (cliente == null)
        {
            throw new NotFoundException($"Cliente com código '{codigoCliente}' não foi encontrado.");
        }

        return cliente;
    }

    private IQueryable<Carrinho> ObterQueryCarrinhoCompleto()
    {
        return _context.Carrinhos
            .Include(c => c.Itens)
                .ThenInclude(i => i.ProdutoVariacao)
                    .ThenInclude(v => v.Produto)
            .Include(c => c.Cliente);
    }

    private CarrinhoResponseDto MapearParaDto(Carrinho carrinho, string codigoCliente, List<string>? avisosEstoque = null)
    {
        var agora = DateTimeOffset.UtcNow;
        bool expirado = carrinho.DataExpiracao <= agora;
        int segundosRestantes = (carrinho.Itens.Count == 0 || expirado)
            ? 0
            : Math.Max(0, (int)(carrinho.DataExpiracao - agora).TotalSeconds);

        bool alertaExpirando = carrinho.Itens.Count > 0 && !expirado && segundosRestantes <= (_alertaMinutosAntes * 60);

        var itensDto = carrinho.Itens.Select(i => new ItemCarrinhoResponseDto
        {
            Id = i.Id,
            ProdutoVariacaoId = i.ProdutoVariacaoId,
            ProdutoId = i.ProdutoVariacao.ProdutoId,
            CodigoProduto = i.ProdutoVariacao.Produto.Codigo,
            NomeProduto = i.ProdutoVariacao.Produto.Nome,
            Marca = i.ProdutoVariacao.Produto.Marca,
            Categoria = i.ProdutoVariacao.Produto.Categoria,
            ImagemUrl = i.ProdutoVariacao.Produto.ImagemUrl,
            Tamanho = i.ProdutoVariacao.Tamanho,
            Quantidade = i.Quantidade,
            PrecoUnitario = i.ProdutoVariacao.Produto.Preco,
            DataAdicionado = i.DataAdicionado
        }).OrderBy(i => i.NomeProduto).ThenBy(i => i.Tamanho).ToList();

        return new CarrinhoResponseDto
        {
            Id = carrinho.Id,
            CodigoCliente = codigoCliente,
            DataCriacao = carrinho.DataCriacao,
            DataAtualizacao = carrinho.DataAtualizacao,
            DataExpiracao = carrinho.DataExpiracao,
            TempoRestanteSegundos = segundosRestantes,
            AlertaExpirando = alertaExpirando,
            Expirado = expirado,
            MensagemExpiracao = expirado ? $"Seu carrinho expirou por inatividade após {_tempoExpiracaoMinutos} minutos e as reservas de estoque foram liberadas." : null,
            QuantidadeTotalItens = itensDto.Sum(i => i.Quantidade),
            Subtotal = itensDto.Sum(i => i.Subtotal),
            Itens = itensDto,
            AvisosEstoque = avisosEstoque ?? new List<string>()
        };
    }

    private CarrinhoResponseDto CriarCarrinhoVazioDto(string codigoCliente)
    {
        var agora = DateTimeOffset.UtcNow;
        return new CarrinhoResponseDto
        {
            Id = 0,
            CodigoCliente = codigoCliente,
            DataCriacao = agora,
            DataAtualizacao = agora,
            DataExpiracao = agora.AddMinutes(_tempoExpiracaoMinutos),
            TempoRestanteSegundos = 0,
            AlertaExpirando = false,
            Expirado = false,
            QuantidadeTotalItens = 0,
            Subtotal = 0,
            Itens = new List<ItemCarrinhoResponseDto>(),
            ItensExpirados = new List<ItemExpiradoResponseDto>()
        };
    }
}
