using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Trocas;
using RunWay.Api.Exceptions;
using RunWay.Api.Models;

namespace RunWay.Api.Services;

public class TrocaService : ITrocaService
{
    private readonly RunWayDbContext _context;
    private readonly IAuditoriaService _auditoriaService;

    public TrocaService(
        RunWayDbContext context,
        IAuditoriaService auditoriaService)
    {
        _context = context;
        _auditoriaService = auditoriaService;
    }

    public async Task<TrocaResponseDto> SolicitarTrocaAsync(
        SolicitarTrocaRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
        {
            throw new ValidationException("Requisição inválida.");
        }

        if (string.IsNullOrWhiteSpace(request.CodigoCliente))
        {
            throw new ValidationException("Código do cliente é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(request.CodigoPedido))
        {
            throw new ValidationException("Código do pedido é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(request.Motivo))
        {
            throw new ValidationException("Motivo da solicitação de troca é obrigatório.");
        }

        if (request.Itens == null || request.Itens.Count == 0)
        {
            throw new ValidationException("Informe pelo menos um item para solicitação de troca.");
        }

        // Validação de duplicidade de itens na requisição
        var itensDuplicados = request.Itens
            .GroupBy(i => i.ItemPedidoId)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        if (itensDuplicados.Count > 0)
        {
            throw new ValidationException("O mesmo item do pedido não pode ser informado mais de uma vez na solicitação.");
        }

        foreach (var item in request.Itens)
        {
            if (item.Quantidade <= 0)
            {
                throw new ValidationException("A quantidade solicitada para troca deve ser de pelo menos 1 unidade.");
            }
        }

        // 1. Validar existência e estado do cliente
        var cliente = await _context.Clientes
            .FirstOrDefaultAsync(c => c.Codigo == request.CodigoCliente.Trim(), cancellationToken);

        if (cliente == null)
        {
            throw new NotFoundException($"Cliente com código '{request.CodigoCliente}' não foi encontrado.");
        }

        if (!cliente.Ativo)
        {
            throw new ValidationException("Clientes inativos não podem solicitar trocas.");
        }

        // 2. Validar pedido e status ENTREGUE (RN0043)
        var pedido = await _context.Pedidos
            .Include(p => p.Cliente)
            .Include(p => p.Itens)
                .ThenInclude(i => i.ProdutoVariacao)
                    .ThenInclude(pv => pv.Produto)
            .FirstOrDefaultAsync(p => p.Codigo == request.CodigoPedido.Trim(), cancellationToken);

        if (pedido == null)
        {
            throw new NotFoundException($"Pedido com código '{request.CodigoPedido}' não foi encontrado.");
        }

        if (pedido.ClienteId != cliente.Id)
        {
            throw new ValidationException("O pedido informado não pertence ao cliente autenticado.");
        }

        // RN0043: Somente pedidos ENTREGUES podem receber solicitação de troca
        if (pedido.Status != Pedido.StatusEntregue && pedido.Status != Pedido.StatusEmTroca)
        {
            throw new ValidationException(
                $"Apenas pedidos com status '{Pedido.StatusEntregue}' podem receber solicitação de troca (RN0043). Status atual do pedido: '{pedido.Status}'.");
        }

        // 3. Validar itens pertencentes ao pedido e quantidades elegíveis
        var itensPedidoDict = pedido.Itens.ToDictionary(i => i.Id);
        decimal valorTotalTroca = 0m;
        var itensTrocaParaInserir = new List<ItemTroca>();

        foreach (var itemReq in request.Itens)
        {
            if (!itensPedidoDict.TryGetValue(itemReq.ItemPedidoId, out var itemPedidoDb))
            {
                throw new ValidationException($"Item com identificador {itemReq.ItemPedidoId} não pertence ao pedido '{pedido.Codigo}'.");
            }

            // Quantidade já em processo de troca ativa ou já trocada para este item
            int quantidadeJaEmTroca = await _context.ItensTroca
                .Where(it => it.ItemPedidoId == itemPedidoDb.Id && it.Troca.Status != Troca.StatusTrocaRecusada)
                .SumAsync(it => it.Quantidade, cancellationToken);

            int quantidadeElegivel = itemPedidoDb.Quantidade - quantidadeJaEmTroca;

            if (quantidadeElegivel <= 0)
            {
                throw new ValidationException(
                    $"Todas as unidades do produto '{itemPedidoDb.ProdutoVariacao.Produto.Nome}' (Tam: {itemPedidoDb.ProdutoVariacao.Tamanho}) já possuem solicitação de troca ativa ou foram trocadas.");
            }

            if (itemReq.Quantidade > quantidadeElegivel)
            {
                throw new ValidationException(
                    $"A quantidade solicitada ({itemReq.Quantidade}) para o produto '{itemPedidoDb.ProdutoVariacao.Produto.Nome}' (Tam: {itemPedidoDb.ProdutoVariacao.Tamanho}) excede a quantidade elegível ({quantidadeElegivel}).");
            }

            decimal subtotalItem = itemPedidoDb.PrecoUnitario * itemReq.Quantidade;
            valorTotalTroca += subtotalItem;

            itensTrocaParaInserir.Add(new ItemTroca
            {
                ItemPedidoId = itemPedidoDb.Id,
                ProdutoVariacaoId = itemPedidoDb.ProdutoVariacaoId,
                Quantidade = itemReq.Quantidade,
                PrecoUnitario = itemPedidoDb.PrecoUnitario,
                Subtotal = subtotalItem
            });
        }

        // 4. Determinação de Troca Total vs Parcial (RN0041)
        int totalUnidadesPedido = pedido.Itens.Sum(i => i.Quantidade);
        int totalUnidadesJaEmTroca = await _context.ItensTroca
            .Where(it => it.ItemPedido.PedidoId == pedido.Id && it.Troca.Status != Troca.StatusTrocaRecusada)
            .SumAsync(it => it.Quantidade, cancellationToken);

        int totalUnidadesSolicitadasAgora = request.Itens.Sum(i => i.Quantidade);
        bool ehTrocaTotal = (totalUnidadesJaEmTroca + totalUnidadesSolicitadasAgora) == totalUnidadesPedido;
        string tipoTroca = ehTrocaTotal ? Troca.TipoTotal : Troca.TipoParcial;

        // =========================================================================
        // 5. TRANSAÇÃO ATÔMICA DE PERSISTÊNCIA DA TROCA
        // =========================================================================
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            // Próximo código único da troca via sequence troca_codigo_seq
            var seqVal = await _context.Database
                .SqlQueryRaw<long>("SELECT nextval('troca_codigo_seq') AS \"Value\"")
                .FirstAsync(cancellationToken);

            string codigoTroca = $"TR-2026-{seqVal:D4}";

            var troca = new Troca
            {
                Codigo = codigoTroca,
                PedidoId = pedido.Id,
                ClienteId = cliente.Id,
                Status = Troca.StatusEmTroca,
                Tipo = tipoTroca,
                Motivo = request.Motivo.Trim(),
                ValorTotal = valorTotalTroca,
                DataSolicitacao = DateTimeOffset.UtcNow,
                Itens = itensTrocaParaInserir
            };

            _context.Trocas.Add(troca);

            // RN0041: Se a solicitação abranger a totalidade dos itens da compra, o pedido principal também passa a EM TROCA
            string? statusAnteriorPedido = null;
            if (ehTrocaTotal && pedido.Status != Pedido.StatusEmTroca)
            {
                statusAnteriorPedido = pedido.Status;
                pedido.Status = Pedido.StatusEmTroca;

                await _auditoriaService.RegistrarAsync(
                    entidade: "PEDIDO",
                    registroId: pedido.Codigo,
                    operacao: "STATUS_EM_TROCA",
                    dadosAnteriores: new { status = statusAnteriorPedido },
                    dadosNovos: new { status = pedido.Status, motivo = "Troca total solicitada para todos os itens do pedido" },
                    usuarioResponsavel: $"Cliente {cliente.Nome} ({cliente.Codigo})",
                    cancellationToken: cancellationToken);
            }

            await _auditoriaService.RegistrarAsync(
                entidade: "TROCA",
                registroId: troca.Codigo,
                operacao: "SOLICITAR_TROCA",
                dadosAnteriores: null,
                dadosNovos: new
                {
                    trocaCodigo = troca.Codigo,
                    pedidoCodigo = pedido.Codigo,
                    clienteCodigo = cliente.Codigo,
                    tipo = troca.Tipo,
                    status = troca.Status,
                    valorTotal = troca.ValorTotal,
                    motivo = troca.Motivo,
                    totalItens = troca.Itens.Count
                },
                usuarioResponsavel: $"Cliente {cliente.Nome} ({cliente.Codigo})",
                cancellationToken: cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return await ObterTrocaPorCodigoAsync(troca.Codigo, cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<List<TrocaResponseDto>> ListarTrocasPorClienteAsync(
        string codigoCliente,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigoCliente))
        {
            throw new ValidationException("Código do cliente é obrigatório.");
        }

        var trocas = await ObterQueryTrocasCompleta()
            .Where(t => t.Cliente.Codigo == codigoCliente.Trim())
            .OrderByDescending(t => t.DataSolicitacao)
            .ToListAsync(cancellationToken);

        return trocas.Select(MapearParaResponseDto).ToList();
    }

    public async Task<List<TrocaResponseDto>> ListarTrocasAdminAsync(
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var query = ObterQueryTrocasCompleta();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusNorm = NormalizarStatusTroca(status);
            query = query.Where(t => t.Status == statusNorm);
        }

        var trocas = await query
            .OrderByDescending(t => t.DataSolicitacao)
            .ToListAsync(cancellationToken);

        return trocas.Select(MapearParaResponseDto).ToList();
    }

    public async Task<TrocaResponseDto> ObterTrocaPorCodigoAsync(
        string codigoTroca,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigoTroca))
        {
            throw new ValidationException("Código da troca é obrigatório.");
        }

        var troca = await ObterQueryTrocasCompleta()
            .FirstOrDefaultAsync(t => t.Codigo == codigoTroca.Trim(), cancellationToken);

        if (troca == null)
        {
            throw new NotFoundException($"Troca com código '{codigoTroca}' não foi encontrada.");
        }

        return MapearParaResponseDto(troca);
    }

    public async Task<TrocaResponseDto> AutorizarTrocaAsync(
        string codigoTroca,
        AutorizarTrocaRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigoTroca))
        {
            throw new ValidationException("Código da troca é obrigatório.");
        }

        var troca = await _context.Trocas
            .Include(t => t.Pedido)
            .Include(t => t.Cliente)
            .FirstOrDefaultAsync(t => t.Codigo == codigoTroca.Trim(), cancellationToken);

        if (troca == null)
        {
            throw new NotFoundException($"Troca com código '{codigoTroca}' não foi encontrada.");
        }

        if (troca.Status != Troca.StatusEmTroca)
        {
            throw new ValidationException(
                $"A troca '{codigoTroca}' está com status '{troca.Status}'. Apenas solicitações com status '{Troca.StatusEmTroca}' podem ser autorizadas ou recusadas.");
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var agora = DateTimeOffset.UtcNow;
            string usuarioAdmin = request?.UsuarioResponsavel ?? "Administrador";

            if (request == null || request.Autorizado)
            {
                // RF0042: Autorizar troca
                string statusAnterior = troca.Status;
                troca.Status = Troca.StatusTrocaAutorizada;
                troca.DataAutorizacao = agora;
                troca.AdminAutorizacao = usuarioAdmin;

                // RN0046: Notificar o cliente sobre a autorização (notificação persistida e consultável)
                troca.NotificacaoCliente =
                    $"Sua solicitação de troca {troca.Codigo} referente ao pedido {troca.Pedido.Codigo} foi AUTORIZADA com sucesso em {agora:dd/MM/yyyy HH:mm}. Por favor, embale os produtos e utilize a autorização de postagem interna para envio à central de logística.";
                troca.DataNotificacao = agora;

                // Se a troca for total, o pedido principal também passa para TROCA AUTORIZADA
                if (troca.Tipo == Troca.TipoTotal)
                {
                    troca.Pedido.Status = Pedido.StatusTrocaAutorizada;
                }

                await _auditoriaService.RegistrarAsync(
                    entidade: "TROCA",
                    registroId: troca.Codigo,
                    operacao: "AUTORIZAR_TROCA",
                    dadosAnteriores: new { status = statusAnterior },
                    dadosNovos: new { status = troca.Status, dataAutorizacao = troca.DataAutorizacao, admin = troca.AdminAutorizacao },
                    usuarioResponsavel: usuarioAdmin,
                    cancellationToken: cancellationToken);
            }
            else
            {
                // Recusa administrativa de troca
                string statusAnterior = troca.Status;
                troca.Status = Troca.StatusTrocaRecusada;
                troca.DataAutorizacao = agora;
                troca.AdminAutorizacao = usuarioAdmin;
                string motivoRecusa = request.MotivoRecusa ?? "Solicitação não atende aos critérios da política de troca";

                troca.NotificacaoCliente =
                    $"Sua solicitação de troca {troca.Codigo} referente ao pedido {troca.Pedido.Codigo} foi RECUSADA em {agora:dd/MM/yyyy HH:mm}. Motivo: {motivoRecusa}.";
                troca.DataNotificacao = agora;

                // Se a troca era total e o pedido estava em EM TROCA, restaura para ENTREGUE se não houver outras trocas ativas
                if (troca.Tipo == Troca.TipoTotal)
                {
                    bool temOutrasTrocasAtivas = await _context.Trocas
                        .AnyAsync(t => t.PedidoId == troca.PedidoId && t.Id != troca.Id && t.Status != Troca.StatusTrocaRecusada, cancellationToken);

                    if (!temOutrasTrocasAtivas)
                    {
                        troca.Pedido.Status = Pedido.StatusEntregue;
                    }
                }

                await _auditoriaService.RegistrarAsync(
                    entidade: "TROCA",
                    registroId: troca.Codigo,
                    operacao: "RECUSAR_TROCA",
                    dadosAnteriores: new { status = statusAnterior },
                    dadosNovos: new { status = troca.Status, motivo = motivoRecusa, admin = troca.AdminAutorizacao },
                    usuarioResponsavel: usuarioAdmin,
                    cancellationToken: cancellationToken);
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return await ObterTrocaPorCodigoAsync(troca.Codigo, cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<TrocaResponseDto> ConfirmarRecebimentoAsync(
        string codigoTroca,
        ConfirmarRecebimentoTrocaRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigoTroca))
        {
            throw new ValidationException("Código da troca é obrigatório.");
        }

        if (request == null)
        {
            throw new ValidationException("Requisição inválida.");
        }

        var troca = await _context.Trocas
            .Include(t => t.Pedido)
                .ThenInclude(p => p.Itens)
            .Include(t => t.Cliente)
            .Include(t => t.Itens)
                .ThenInclude(i => i.ProdutoVariacao)
                    .ThenInclude(pv => pv.Produto)
            .FirstOrDefaultAsync(t => t.Codigo == codigoTroca.Trim(), cancellationToken);

        if (troca == null)
        {
            throw new NotFoundException($"Troca com código '{codigoTroca}' não foi encontrada.");
        }

        if (troca.Status == Troca.StatusTrocado)
        {
            throw new ValidationException(
                $"O recebimento da troca '{codigoTroca}' já foi processado anteriormente e a troca já está concluída com status '{Troca.StatusTrocado}'.");
        }

        if (troca.Status != Troca.StatusTrocaAutorizada)
        {
            throw new ValidationException(
                $"Apenas trocas com status '{Troca.StatusTrocaAutorizada}' podem ter o recebimento confirmado. Status atual: '{troca.Status}'.");
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var agora = DateTimeOffset.UtcNow;
            string usuarioAdmin = request.UsuarioResponsavel ?? "Administrador";

            // 1. Reentrada em estoque (RF0054) com controle de concorrência FOR UPDATE
            if (request.RetornarAoEstoque)
            {
                foreach (var item in troca.Itens)
                {
                    var estoque = await _context.Estoques
                        .FromSqlInterpolated($"SELECT * FROM \"ESTOQUE\" WHERE produto_variacao_id = {item.ProdutoVariacaoId} FOR UPDATE")
                        .FirstOrDefaultAsync(cancellationToken);

                    if (estoque == null)
                    {
                        estoque = new Estoque
                        {
                            ProdutoVariacaoId = item.ProdutoVariacaoId,
                            Quantidade = 0
                        };
                        _context.Estoques.Add(estoque);
                        await _context.SaveChangesAsync(cancellationToken);
                    }

                    int qtdAnterior = estoque.Quantidade;
                    estoque.Quantidade += item.Quantidade;

                    await _auditoriaService.RegistrarAsync(
                        entidade: "ESTOQUE",
                        registroId: estoque.Id.ToString(),
                        operacao: "REENTRADA_ESTOQUE",
                        dadosAnteriores: new { produtoVariacaoId = estoque.ProdutoVariacaoId, quantidade = qtdAnterior },
                        dadosNovos: new { produtoVariacaoId = estoque.ProdutoVariacaoId, quantidade = estoque.Quantidade, trocaCodigo = troca.Codigo, quantidadeReentrada = item.Quantidade },
                        usuarioResponsavel: usuarioAdmin,
                        cancellationToken: cancellationToken);
                }

                troca.RetornouAoEstoque = true;
            }
            else
            {
                troca.RetornouAoEstoque = false;

                await _auditoriaService.RegistrarAsync(
                    entidade: "TROCA",
                    registroId: troca.Codigo,
                    operacao: "SEM_RETORNO_ESTOQUE",
                    dadosAnteriores: null,
                    dadosNovos: new { motivo = request.Observacoes ?? "Itens não retornaram ao estoque por decisão administrativa (ex.: avaria/descarte)" },
                    usuarioResponsavel: usuarioAdmin,
                    cancellationToken: cancellationToken);
            }

            // 2. Geração de cupom de troca real vinculado ao cliente (RF0045)
            string codigoCupom = $"TROCA-{troca.Codigo}";

            // Idempotência: verificar se cupom já existe
            var cupomExistente = await _context.Cupons
                .FirstOrDefaultAsync(c => c.Codigo == codigoCupom, cancellationToken);

            if (cupomExistente == null)
            {
                cupomExistente = new Cupom
                {
                    Codigo = codigoCupom,
                    Tipo = Cupom.TipoTroca,
                    Valor = troca.ValorTotal,
                    ClienteId = troca.ClienteId
                };
                _context.Cupons.Add(cupomExistente);
                await _context.SaveChangesAsync(cancellationToken);

                await _auditoriaService.RegistrarAsync(
                    entidade: "CUPOM",
                    registroId: cupomExistente.Codigo,
                    operacao: "GERAR_CUPOM_TROCA",
                    dadosAnteriores: null,
                    dadosNovos: new { codigo = cupomExistente.Codigo, tipo = cupomExistente.Tipo, valor = cupomExistente.Valor, clienteId = cupomExistente.ClienteId, trocaCodigo = troca.Codigo },
                    usuarioResponsavel: usuarioAdmin,
                    cancellationToken: cancellationToken);
            }

            troca.CupomId = cupomExistente.Id;

            // 3. Atualizar status da troca para TROCADO (RN0042)
            string statusAnteriorTroca = troca.Status;
            troca.Status = Troca.StatusTrocado;
            troca.DataRecebimento = agora;
            troca.AdminRecebimento = usuarioAdmin;

            // 4. Efeitos sobre o pedido principal (RN0042)
            // O pedido principal somente transita para TROCADO se a totalidade de suas unidades tiver o recebimento concluído
            int totalUnidadesPedido = await _context.ItensPedido
                .Where(i => i.PedidoId == troca.PedidoId)
                .SumAsync(i => i.Quantidade, cancellationToken);
            int totalUnidadesTrocadas = await _context.ItensTroca
                .Where(it => it.ItemPedido.PedidoId == troca.PedidoId && it.Troca.Status == Troca.StatusTrocado && it.TrocaId != troca.Id)
                .SumAsync(it => it.Quantidade, cancellationToken);

            totalUnidadesTrocadas += troca.Itens.Sum(i => i.Quantidade);

            bool temTrocasPendentes = await _context.Trocas
                .AnyAsync(t => t.PedidoId == troca.PedidoId && t.Id != troca.Id && (t.Status == Troca.StatusEmTroca || t.Status == Troca.StatusTrocaAutorizada), cancellationToken);

            if (totalUnidadesTrocadas >= totalUnidadesPedido && !temTrocasPendentes)
            {
                string statusAnteriorPedido = troca.Pedido.Status;
                troca.Pedido.Status = Pedido.StatusTrocado;

                await _auditoriaService.RegistrarAsync(
                    entidade: "PEDIDO",
                    registroId: troca.Pedido.Codigo,
                    operacao: "STATUS_TROCADO",
                    dadosAnteriores: new { status = statusAnteriorPedido },
                    dadosNovos: new { status = troca.Pedido.Status, motivo = "Todas as unidades do pedido foram concluídas e recebidas em trocas" },
                    usuarioResponsavel: usuarioAdmin,
                    cancellationToken: cancellationToken);
            }

            await _auditoriaService.RegistrarAsync(
                entidade: "TROCA",
                registroId: troca.Codigo,
                operacao: "RECEBIMENTO_TROCA",
                dadosAnteriores: new { status = statusAnteriorTroca },
                dadosNovos: new
                {
                    status = troca.Status,
                    dataRecebimento = troca.DataRecebimento,
                    admin = troca.AdminRecebimento,
                    retornouAoEstoque = troca.RetornouAoEstoque,
                    cupomGerado = codigoCupom,
                    valorCupom = troca.ValorTotal
                },
                usuarioResponsavel: usuarioAdmin,
                cancellationToken: cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return await ObterTrocaPorCodigoAsync(troca.Codigo, cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<NotificacaoTrocaResponseDto> ObterNotificacaoTrocaAsync(
        string codigoTroca,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigoTroca))
        {
            throw new ValidationException("Código da troca é obrigatório.");
        }

        var troca = await _context.Trocas
            .Include(t => t.Pedido)
            .FirstOrDefaultAsync(t => t.Codigo == codigoTroca.Trim(), cancellationToken);

        if (troca == null)
        {
            throw new NotFoundException($"Troca com código '{codigoTroca}' não foi encontrada.");
        }

        return new NotificacaoTrocaResponseDto
        {
            CodigoTroca = troca.Codigo,
            CodigoPedido = troca.Pedido.Codigo,
            Status = troca.Status,
            Mensagem = troca.NotificacaoCliente ?? "Nenhuma notificação gerada para esta solicitação.",
            DataNotificacao = troca.DataNotificacao
        };
    }

    public async Task<ElegibilidadeTrocaResponseDto> ConsultarElegibilidadeTrocaAsync(
        string codigoPedido,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigoPedido))
        {
            throw new ValidationException("Código do pedido é obrigatório.");
        }

        var pedido = await _context.Pedidos
            .Include(p => p.Itens)
                .ThenInclude(i => i.ProdutoVariacao)
                    .ThenInclude(pv => pv.Produto)
            .FirstOrDefaultAsync(p => p.Codigo == codigoPedido.Trim(), cancellationToken);

        if (pedido == null)
        {
            throw new NotFoundException($"Pedido com código '{codigoPedido}' não foi encontrado.");
        }

        bool statusElegivel = pedido.Status == Pedido.StatusEntregue || pedido.Status == Pedido.StatusEmTroca;
        string? motivoBloqueio = null;

        if (!statusElegivel)
        {
            motivoBloqueio = $"Somente pedidos no status '{Pedido.StatusEntregue}' podem receber solicitação de troca (RN0043). Status atual: '{pedido.Status}'.";
        }

        var itensElegiveis = new List<ItemElegibilidadeTrocaDto>();

        foreach (var item in pedido.Itens)
        {
            int jaTrocado = await _context.ItensTroca
                .Where(it => it.ItemPedidoId == item.Id && it.Troca.Status != Troca.StatusTrocaRecusada)
                .SumAsync(it => it.Quantidade, cancellationToken);

            int elegivel = Math.Max(0, item.Quantidade - jaTrocado);

            itensElegiveis.Add(new ItemElegibilidadeTrocaDto
            {
                ItemPedidoId = item.Id,
                ProdutoVariacaoId = item.ProdutoVariacaoId,
                NomeProduto = item.ProdutoVariacao.Produto.Nome,
                Tamanho = item.ProdutoVariacao.Tamanho,
                PrecoUnitario = item.PrecoUnitario,
                QuantidadeComprada = item.Quantidade,
                QuantidadeJaEmTroca = jaTrocado,
                QuantidadeElegivel = elegivel
            });
        }

        bool podeSolicitar = statusElegivel && itensElegiveis.Any(i => i.QuantidadeElegivel > 0);
        if (statusElegivel && !podeSolicitar)
        {
            motivoBloqueio = "Todos os itens deste pedido já possuem solicitações de troca ativas ou já foram trocados.";
        }

        return new ElegibilidadeTrocaResponseDto
        {
            CodigoPedido = pedido.Codigo,
            StatusPedido = pedido.Status,
            PodeSolicitarTroca = podeSolicitar,
            MotivoBloqueio = motivoBloqueio,
            Itens = itensElegiveis
        };
    }

    private IQueryable<Troca> ObterQueryTrocasCompleta()
    {
        return _context.Trocas
            .AsNoTracking()
            .Include(t => t.Pedido)
            .Include(t => t.Cliente)
            .Include(t => t.Cupom)
            .Include(t => t.Itens)
                .ThenInclude(i => i.ItemPedido)
            .Include(t => t.Itens)
                .ThenInclude(i => i.ProdutoVariacao)
                    .ThenInclude(pv => pv.Produto);
    }

    private static TrocaResponseDto MapearParaResponseDto(Troca t)
    {
        return new TrocaResponseDto
        {
            Id = t.Id,
            Codigo = t.Codigo,
            PedidoId = t.PedidoId,
            CodigoPedido = t.Pedido.Codigo,
            ClienteId = t.ClienteId,
            CodigoCliente = t.Cliente.Codigo,
            NomeCliente = t.Cliente.Nome,
            Status = t.Status,
            Tipo = t.Tipo,
            Motivo = t.Motivo,
            ValorTotal = t.ValorTotal,
            DataSolicitacao = t.DataSolicitacao,
            DataAutorizacao = t.DataAutorizacao,
            AdminAutorizacao = t.AdminAutorizacao,
            DataRecebimento = t.DataRecebimento,
            AdminRecebimento = t.AdminRecebimento,
            RetornouAoEstoque = t.RetornouAoEstoque,
            CupomId = t.CupomId,
            CodigoCupom = t.Cupom?.Codigo,
            ValorCupom = t.Cupom?.Valor,
            NotificacaoCliente = t.NotificacaoCliente,
            DataNotificacao = t.DataNotificacao,
            Itens = t.Itens.Select(i => new ItemTrocaResponseDto
            {
                Id = i.Id,
                TrocaId = i.TrocaId,
                ItemPedidoId = i.ItemPedidoId,
                ProdutoVariacaoId = i.ProdutoVariacaoId,
                ProdutoId = i.ProdutoVariacao.ProdutoId,
                CodigoProduto = i.ProdutoVariacao.Produto.Codigo,
                NomeProduto = i.ProdutoVariacao.Produto.Nome,
                Marca = i.ProdutoVariacao.Produto.Marca,
                Categoria = i.ProdutoVariacao.Produto.Categoria,
                ImagemUrl = i.ProdutoVariacao.Produto.ImagemUrl,
                Tamanho = i.ProdutoVariacao.Tamanho,
                Quantidade = i.Quantidade,
                PrecoUnitario = i.PrecoUnitario,
                Subtotal = i.Subtotal
            }).ToList()
        };
    }

    private static string NormalizarStatusTroca(string status)
    {
        var s = status.Trim().ToUpperInvariant();
        return s switch
        {
            "EM TROCA" or "SOLICITADA" or "TROCA SOLICITADA" => Troca.StatusEmTroca,
            "TROCA AUTORIZADA" or "AUTORIZADA" or "TROCA ACEITA" => Troca.StatusTrocaAutorizada,
            "TROCADO" or "TROCA PROCESSADA" or "CONCLUIDA" => Troca.StatusTrocado,
            "TROCA RECUSADA" or "RECUSADA" or "TROCA NEGADA" => Troca.StatusTrocaRecusada,
            _ => s
        };
    }
}
