using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Cartoes;
using RunWay.Api.DTOs.Clientes;
using RunWay.Api.Exceptions;
using RunWay.Api.Models;

namespace RunWay.Api.Services;

public class ClienteService : IClienteService
{
    private readonly RunWayDbContext _context;
    private readonly IPasswordHasher<Cliente> _passwordHasher;
    private readonly IAuditoriaService _auditoriaService;

    public ClienteService(
        RunWayDbContext context,
        IPasswordHasher<Cliente>? passwordHasher = null,
        IAuditoriaService? auditoriaService = null)
    {
        _context = context;
        _passwordHasher = passwordHasher ?? new PasswordHasher<Cliente>();
        _auditoriaService = auditoriaService ?? new AuditoriaService(context);
    }

    public async Task<ClienteResponseDto> CadastrarAsync(
        ClienteCreateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        // =========================================================================
        // 1. VALIDAÇÃO DOS DADOS BÁSICOS DO CLIENTE (RN0026 / Decisões do RunWay)
        // =========================================================================
        ValidarNome(request.Nome);
        ValidarGenero(request.Genero);
        ValidarDataNascimento(request.DataNascimento);

        // Normalização e validação de CPF (RN0026 / Decisão de Projeto RunWay)
        var cpfNormalizado = Regex.Replace(request.Cpf ?? string.Empty, @"\D", "");
        if (string.IsNullOrWhiteSpace(cpfNormalizado) || cpfNormalizado.Length != 11)
        {
            throw new ValidationException("O CPF informado deve conter exatamente 11 dígitos numéricos. (RN0026)");
        }

        // Normalização e validação de E-mail (RN0026 / Decisão de Projeto RunWay)
        var emailNormalizado = NormalizarEValidarEmail(request.Email);

        // =========================================================================
        // 2. VERIFICAÇÃO PRÉVIA DE UNICIDADE (Decisão de Projeto RunWay / Índices UNIQUE)
        // =========================================================================
        var cpfExiste = await _context.Clientes
            .AsNoTracking()
            .AnyAsync(c => c.Cpf == cpfNormalizado, cancellationToken);

        if (cpfExiste)
        {
            throw new ConflictException("Já existe um cliente cadastrado com este CPF.");
        }

        var emailExiste = await _context.Clientes
            .AsNoTracking()
            .AnyAsync(c => c.Email == emailNormalizado, cancellationToken);

        if (emailExiste)
        {
            throw new ConflictException("Já existe um cliente cadastrado com este e-mail.");
        }

        // =========================================================================
        // 3. VALIDAÇÃO DE SENHA E CONFIRMAÇÃO (RN0026, RNF0031, RNF0032)
        // =========================================================================
        if (string.IsNullOrWhiteSpace(request.Senha))
        {
            throw new ValidationException("A senha é obrigatória. (RN0026)");
        }

        if (string.IsNullOrWhiteSpace(request.ConfirmacaoSenha))
        {
            throw new ValidationException("A confirmação de senha é obrigatória. (RNF0032)");
        }

        if (request.Senha != request.ConfirmacaoSenha)
        {
            throw new ValidationException("A confirmação de senha não coincide com a senha digitada. (RNF0032)");
        }

        // RNF0031: Mínimo 8 caracteres, letras maiúsculas, minúsculas e caractere especial
        ValidarSenhaForte(request.Senha);

        // =========================================================================
        // 4. VALIDAÇÃO DO TELEFONE (RN0026)
        // =========================================================================
        var (tipoTelefone, dddNormalizado, numeroTelefoneNormalizado) = NormalizarEValidarTelefone(request.Telefone);

        // =========================================================================
        // 5. VALIDAÇÃO DA COLEÇÃO DE ENDEREÇOS (RN0021, RN0022, RN0023, RN0026)
        // =========================================================================
        if (request.Enderecos is null || request.Enderecos.Count == 0)
        {
            throw new ValidationException("O cliente deve possuir pelo menos um endereço cadastrado. (RN0021, RN0022, RN0026)");
        }

        bool possuiResidencial = false;
        bool possuiEntrega = false;
        bool possuiCobranca = false;

        var enderecosEntidades = new List<Endereco>();

        for (int i = 0; i < request.Enderecos.Count; i++)
        {
            var endDto = request.Enderecos[i];
            int pos = i + 1;

            ValidarDadosEndereco(endDto, pos);

            if (endDto.Residencial) possuiResidencial = true;
            if (endDto.Entrega) possuiEntrega = true;
            if (endDto.Cobranca) possuiCobranca = true;

            var cepNormalizadoEndereco = Regex.Replace(endDto.Cep ?? string.Empty, @"\D", "");

            enderecosEntidades.Add(new Endereco
            {
                Nome = endDto.Nome.Trim(),
                TipoResidencia = endDto.TipoResidencia.Trim(),
                TipoLogradouro = endDto.TipoLogradouro.Trim(),
                Logradouro = endDto.Logradouro.Trim(),
                Numero = endDto.Numero.Trim(),
                Complemento = string.IsNullOrWhiteSpace(endDto.Complemento) ? null : endDto.Complemento.Trim(),
                Bairro = endDto.Bairro.Trim(),
                Cep = cepNormalizadoEndereco,
                Cidade = endDto.Cidade.Trim(),
                Estado = endDto.Estado.Trim().ToUpperInvariant(),
                Pais = endDto.Pais.Trim(),
                Observacoes = string.IsNullOrWhiteSpace(endDto.Observacoes) ? null : endDto.Observacoes.Trim(),
                Residencial = endDto.Residencial,
                Entrega = endDto.Entrega,
                Cobranca = endDto.Cobranca
            });
        }

        // RN0026: cadastro exige endereço residencial
        if (!possuiResidencial)
        {
            throw new ValidationException("O cliente deve possuir pelo menos um endereço residencial cadastrado. (RN0026)");
        }

        // RN0022: cliente deve possuir pelo menos um endereço de entrega
        if (!possuiEntrega)
        {
            throw new ValidationException("O cliente deve possuir pelo menos um endereço de entrega cadastrado. (RN0022)");
        }

        // RN0021: cliente deve possuir pelo menos um endereço de cobrança
        if (!possuiCobranca)
        {
            throw new ValidationException("O cliente deve possuir pelo menos um endereço de cobrança cadastrado. (RN0021)");
        }

        // =========================================================================
        // 6. CRIAÇÃO DO AGREGADO E PERSISTÊNCIA ATÔMICA
        // =========================================================================
        var novoCliente = new Cliente
        {
            Nome = request.Nome.Trim(),
            Email = emailNormalizado,
            Cpf = cpfNormalizado,
            Genero = request.Genero.Trim(),
            DataNascimento = request.DataNascimento,
            Ranking = 1, // Decisão RunWay: Ranking numérico inicial base
            Ativo = true, // Decisão RunWay: Cliente ativo por padrão
            Telefone = new Telefone
            {
                Tipo = tipoTelefone,
                Ddd = dddNormalizado,
                Numero = numeroTelefoneNormalizado
            },
            Enderecos = enderecosEntidades
        };

        // RNF0033: Hash seguro da senha com PasswordHasher nativo do ASP.NET Core
        novoCliente.SenhaHash = _passwordHasher.HashPassword(novoCliente, request.Senha);

        // RNF0035: Geração atômica de Código Único via PostgreSQL SEQUENCE
        var proximoValor = await _context.Database
            .SqlQuery<long>($"SELECT nextval('cliente_codigo_seq') AS \"Value\"")
            .FirstAsync(cancellationToken);

        novoCliente.Codigo = $"CLI-{proximoValor:D4}";

        // RNF0012: Auditoria da inserção do cliente (sem expor senha ou senhaHash)
        var dadosNovosCliente = new
        {
            codigo = novoCliente.Codigo,
            nome = novoCliente.Nome,
            email = novoCliente.Email,
            cpf = novoCliente.Cpf,
            genero = novoCliente.Genero,
            dataNascimento = novoCliente.DataNascimento.ToString("yyyy-MM-dd"),
            ranking = novoCliente.Ranking,
            ativo = novoCliente.Ativo,
            telefone = new
            {
                tipo = novoCliente.Telefone.Tipo,
                ddd = novoCliente.Telefone.Ddd,
                numero = novoCliente.Telefone.Numero
            },
            enderecos = novoCliente.Enderecos.Select(e => new
            {
                nome = e.Nome,
                tipoResidencia = e.TipoResidencia,
                tipoLogradouro = e.TipoLogradouro,
                logradouro = e.Logradouro,
                numero = e.Numero,
                complemento = e.Complemento,
                bairro = e.Bairro,
                cep = e.Cep,
                cidade = e.Cidade,
                estado = e.Estado,
                pais = e.Pais,
                observacoes = e.Observacoes,
                residencial = e.Residencial,
                entrega = e.Entrega,
                cobranca = e.Cobranca
            }).ToList()
        };

        await _auditoriaService.RegistrarAsync(
            entidade: "CLIENTE",
            registroId: novoCliente.Codigo,
            operacao: "INSERCAO",
            dadosAnteriores: null,
            dadosNovos: dadosNovosCliente,
            usuarioResponsavel: "ADMIN",
            cancellationToken: cancellationToken);

        _context.Clientes.Add(novoCliente);
        await _context.SaveChangesAsync(cancellationToken);

        // =========================================================================
        // 7. MAPEAMENTO PARA RESPONSE DTO (Sem expor dados sensíveis)
        // =========================================================================
        return MapearClienteParaResponseDto(novoCliente);
    }

    /// <summary>
    /// RF0022: Alteração de Cliente.
    /// Atualiza somente os campos cadastrais permitidos: Nome, Email, Genero, DataNascimento e Telefone associado.
    /// CPF é mantido estritamente imutável (Decisão de Projeto RunWay).
    /// Código (CLI-XXXX), SenhaHash (Card #56 / RF0028), Ranking (Card #59 / RN0027),
    /// Ativo (Card #57 / RF0023), Endereços (Cards #51/#55) e Cartões (Card #52 / RF0027)
    /// são protegidos estruturalmente e NÃO são alterados por este método.
    /// </summary>
    public async Task<ClienteResponseDto> AlterarAsync(
        string codigoCliente,
        ClienteUpdateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigoCliente))
        {
            throw new ValidationException("O código do cliente é obrigatório para alteração.");
        }

        if (request is null)
        {
            throw new ValidationException("Os dados para alteração do cliente são obrigatórios.");
        }

        var codigoNormalizado = codigoCliente.Trim();

        // 1. Localiza o cliente com tracking ativo para atualização via EF Core
        var cliente = await _context.Clientes
            .Include(c => c.Telefone)
            .Include(c => c.Enderecos)
            .FirstOrDefaultAsync(c => c.Codigo == codigoNormalizado, cancellationToken);

        if (cliente is null)
        {
            throw new NotFoundException($"Cliente com código '{codigoNormalizado}' não foi encontrado.");
        }

        // 2. Validações dos campos recebidos reutilizando métodos compartilhados
        ValidarNome(request.Nome);
        ValidarGenero(request.Genero);
        ValidarDataNascimento(request.DataNascimento);
        var emailNormalizado = NormalizarEValidarEmail(request.Email);
        var (tipoTelefone, dddNormalizado, numeroNormalizado) = NormalizarEValidarTelefone(request.Telefone);

        // 3. Verificação de unicidade de e-mail contra OUTROS clientes (Decisão de Projeto RunWay)
        // Permite manter o próprio e-mail atual do cliente
        var emailEmUsoPorOutro = await _context.Clientes
            .AsNoTracking()
            .AnyAsync(c => c.Email == emailNormalizado && c.Codigo != cliente.Codigo, cancellationToken);

        if (emailEmUsoPorOutro)
        {
            throw new ConflictException("Já existe outro cliente cadastrado com este e-mail.");
        }

        // 4. Captura dos valores anteriores e cálculo de delta (RNF0012)
        var dadosAnteriores = new Dictionary<string, object?>();
        var dadosNovos = new Dictionary<string, object?>();

        var novoNome = request.Nome.Trim();
        if (cliente.Nome != novoNome)
        {
            dadosAnteriores["nome"] = cliente.Nome;
            dadosNovos["nome"] = novoNome;
        }

        if (cliente.Email != emailNormalizado)
        {
            dadosAnteriores["email"] = cliente.Email;
            dadosNovos["email"] = emailNormalizado;
        }

        var novoGenero = request.Genero.Trim();
        if (cliente.Genero != novoGenero)
        {
            dadosAnteriores["genero"] = cliente.Genero;
            dadosNovos["genero"] = novoGenero;
        }

        if (cliente.DataNascimento != request.DataNascimento)
        {
            dadosAnteriores["dataNascimento"] = cliente.DataNascimento.ToString("yyyy-MM-dd");
            dadosNovos["dataNascimento"] = request.DataNascimento.ToString("yyyy-MM-dd");
        }

        if (cliente.Telefone is null)
        {
            dadosAnteriores["telefone"] = null;
            dadosNovos["telefone"] = new { tipo = tipoTelefone, ddd = dddNormalizado, numero = numeroNormalizado };
        }
        else
        {
            var telAlterado = false;
            var telAntigo = new Dictionary<string, object?>();
            var telNovo = new Dictionary<string, object?>();

            if (cliente.Telefone.Tipo != tipoTelefone)
            {
                telAntigo["tipo"] = cliente.Telefone.Tipo;
                telNovo["tipo"] = tipoTelefone;
                telAlterado = true;
            }
            if (cliente.Telefone.Ddd != dddNormalizado)
            {
                telAntigo["ddd"] = cliente.Telefone.Ddd;
                telNovo["ddd"] = dddNormalizado;
                telAlterado = true;
            }
            if (cliente.Telefone.Numero != numeroNormalizado)
            {
                telAntigo["numero"] = cliente.Telefone.Numero;
                telNovo["numero"] = numeroNormalizado;
                telAlterado = true;
            }

            if (telAlterado)
            {
                dadosAnteriores["telefone"] = telAntigo;
                dadosNovos["telefone"] = telNovo;
            }
        }

        // Se houver modificações efetivas, audita a operação (RNF0012)
        if (dadosNovos.Count > 0)
        {
            await _auditoriaService.RegistrarAsync(
                entidade: "CLIENTE",
                registroId: cliente.Codigo,
                operacao: "ALTERACAO",
                dadosAnteriores: dadosAnteriores,
                dadosNovos: dadosNovos,
                usuarioResponsavel: "ADMIN",
                cancellationToken: cancellationToken);
        }

        // 5. Atualização estrita dos campos editáveis no escopo do RF0022
        cliente.Nome = novoNome;
        cliente.Email = emailNormalizado;
        cliente.Genero = novoGenero;
        cliente.DataNascimento = request.DataNascimento;

        // 6. Atualização do telefone associado na mesma transação/contexto
        if (cliente.Telefone is null)
        {
            cliente.Telefone = new Telefone
            {
                ClienteId = cliente.Id,
                Tipo = tipoTelefone,
                Ddd = dddNormalizado,
                Numero = numeroNormalizado
            };
        }
        else
        {
            cliente.Telefone.Tipo = tipoTelefone;
            cliente.Telefone.Ddd = dddNormalizado;
            cliente.Telefone.Numero = numeroNormalizado;
        }

        // 7. Campos protegidos contra alterações indevidas (garantia estrutural):
        // cliente.Codigo, cliente.Cpf, cliente.SenhaHash, cliente.Ranking, cliente.Ativo,
        // cliente.Enderecos e cliente.Cartoes permanecem estritamente inalterados.

        // 8. Persistência atômica no PostgreSQL (alterações + auditoria no mesmo SaveChangesAsync)
        await _context.SaveChangesAsync(cancellationToken);

        // 8. Retorno da resposta mapeada
        return MapearClienteParaResponseDto(cliente);
    }

    /// <summary>
    /// RF0028: Alteração somente de senha do cliente.
    /// RNF0031: Validação de senha forte (mínimo 8 caracteres, maiúscula, minúscula e caractere especial).
    /// RNF0032: Confirmação obrigatória e estrita da nova senha.
    /// RNF0033: Armazenamento seguro via hash gerado por PasswordHasher, nunca gravando texto puro.
    /// Modifica exclusivamente o campo SenhaHash, mantendo todos os demais dados cadastrais intactos.
    /// </summary>
    public async Task AlterarSenhaAsync(
        string codigoCliente,
        ClienteSenhaUpdateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigoCliente))
        {
            throw new ValidationException("O código do cliente é obrigatório para alteração de senha.");
        }

        if (request is null)
        {
            throw new ValidationException("Os dados para alteração de senha são obrigatórios.");
        }

        var codigoNormalizado = codigoCliente.Trim();

        // 1. Localiza o cliente com tracking ativo para atualização
        var cliente = await _context.Clientes
            .FirstOrDefaultAsync(c => c.Codigo == codigoNormalizado, cancellationToken);

        if (cliente is null)
        {
            throw new NotFoundException($"Cliente com código '{codigoNormalizado}' não foi encontrado.");
        }

        // 2. Validação dos campos obrigatórios da operação de alteração de senha
        if (string.IsNullOrWhiteSpace(request.NovaSenha))
        {
            throw new ValidationException("A nova senha é obrigatória.");
        }

        if (string.IsNullOrWhiteSpace(request.ConfirmacaoNovaSenha))
        {
            throw new ValidationException("A confirmação da nova senha é obrigatória. (RNF0032)");
        }

        // 3. RNF0032: Validação de igualdade entre a nova senha e sua confirmação
        if (request.NovaSenha != request.ConfirmacaoNovaSenha)
        {
            throw new ValidationException("A confirmação de senha não coincide com a nova senha digitada. (RNF0032)");
        }

        // 4. RNF0031: Reutilização da validação de senha forte do projeto
        ValidarSenhaForte(request.NovaSenha);

        // 5. RNF0033: Geração de hash seguro com o PasswordHasher configurado
        cliente.SenhaHash = _passwordHasher.HashPassword(cliente, request.NovaSenha);

        // RNF0012: Auditoria de alteração de senha registrando apenas o evento seguro sem senhas ou hashes
        await _auditoriaService.RegistrarAsync(
            entidade: "CLIENTE",
            registroId: cliente.Codigo,
            operacao: "ALTERACAO_SENHA",
            dadosAnteriores: null,
            dadosNovos: new
            {
                evento = "Senha alterada com sucesso",
                alterada = true
            },
            usuarioResponsavel: "ADMIN",
            cancellationToken: cancellationToken);

        // 6. Persistência atômica exclusivamente de SenhaHash e do Log de Auditoria no PostgreSQL
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// RF0023: Inativação lógica de cliente.
    /// Altera unicamente a situação cadastral do cliente de Ativo = true para Ativo = false.
    /// Não executa exclusão física (DELETE) e preserva integralmente todos os demais dados do cliente.
    /// Operação idempotente: se o cliente já estiver inativo, conclui normalmente sem alterações redundantes.
    /// </summary>
    public async Task<string> InativarAsync(
        string codigoCliente,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigoCliente))
        {
            throw new ValidationException("O código do cliente é obrigatório para inativação.");
        }

        var codigoNormalizado = codigoCliente.Trim();

        // 1. Localiza o cliente com tracking ativo para atualização
        var cliente = await _context.Clientes
            .FirstOrDefaultAsync(c => c.Codigo == codigoNormalizado, cancellationToken);

        if (cliente is null)
        {
            throw new NotFoundException($"Cliente com código '{codigoNormalizado}' não foi encontrado.");
        }

        // 2. Idempotência: se já estiver inativo, retorna mensagem informativa sem executar UPDATE no banco e sem gerar log
        if (!cliente.Ativo)
        {
            return "O cliente já está inativo.";
        }

        // 3. Atualização exclusiva do campo Ativo (soft delete / inativação lógica)
        cliente.Ativo = false;

        // RNF0012: Auditoria da inativação registrando a transição de estado
        await _auditoriaService.RegistrarAsync(
            entidade: "CLIENTE",
            registroId: cliente.Codigo,
            operacao: "INATIVACAO",
            dadosAnteriores: new { ativo = true },
            dadosNovos: new { ativo = false },
            usuarioResponsavel: "ADMIN",
            cancellationToken: cancellationToken);

        // 4. Persistência atômica exclusivamente da coluna ativo e do Log de Auditoria no PostgreSQL
        await _context.SaveChangesAsync(cancellationToken);

        return "Cliente inativado com sucesso.";
    }

    /// <summary>
    /// RF0024: Consulta persistente de clientes com filtros cadastrais opcionais combinados (AND).
    /// RNF0011: Execução otimizada com AsNoTracking e projeção direta no banco via EF Core.
    /// </summary>
    public async Task<List<ClienteListItemResponseDto>> ConsultarAsync(
        ClienteFiltroRequestDto filtro,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Clientes
            .AsNoTracking()
            .AsQueryable();

        // Filtro por Código (CLI-XXXX) - case-insensitive parcial
        if (!string.IsNullOrWhiteSpace(filtro.Codigo))
        {
            var codigo = filtro.Codigo.Trim();
            query = query.Where(c => EF.Functions.ILike(c.Codigo, $"%{codigo}%"));
        }

        // Filtro por Nome - case-insensitive parcial
        if (!string.IsNullOrWhiteSpace(filtro.Nome))
        {
            var nome = filtro.Nome.Trim();
            query = query.Where(c => EF.Functions.ILike(c.Nome, $"%{nome}%"));
        }

        // Filtro por E-mail - case-insensitive parcial
        if (!string.IsNullOrWhiteSpace(filtro.Email))
        {
            var email = filtro.Email.Trim();
            query = query.Where(c => EF.Functions.ILike(c.Email, $"%{email}%"));
        }

        // Filtro por CPF - aceita com ou sem máscara (normalização de dígitos)
        if (!string.IsNullOrWhiteSpace(filtro.Cpf))
        {
            var cpfDigitos = Regex.Replace(filtro.Cpf, @"\D", "");
            if (!string.IsNullOrEmpty(cpfDigitos))
            {
                query = query.Where(c => c.Cpf.Contains(cpfDigitos));
            }
            else
            {
                query = query.Where(c => c.Cpf == filtro.Cpf.Trim());
            }
        }

        // Filtro por Gênero - case-insensitive parcial
        if (!string.IsNullOrWhiteSpace(filtro.Genero))
        {
            var genero = filtro.Genero.Trim();
            query = query.Where(c => EF.Functions.ILike(c.Genero, $"%{genero}%"));
        }

        // Filtro por Data de Nascimento - comparação exata
        if (filtro.DataNascimento.HasValue)
        {
            query = query.Where(c => c.DataNascimento == filtro.DataNascimento.Value);
        }

        // Filtro por Telefone - pesquisa coerente com DDD + número e/ou número isolado
        if (!string.IsNullOrWhiteSpace(filtro.Telefone))
        {
            var telDigitos = Regex.Replace(filtro.Telefone, @"\D", "");
            if (!string.IsNullOrEmpty(telDigitos))
            {
                query = query.Where(c => c.Telefone != null && (
                    c.Telefone.Numero.Contains(telDigitos) ||
                    c.Telefone.Ddd.Contains(telDigitos) ||
                    (c.Telefone.Ddd + c.Telefone.Numero).Contains(telDigitos)
                ));
            }
            else
            {
                query = query.Where(c => c.Telefone != null && c.Telefone.Numero == filtro.Telefone.Trim());
            }
        }

        // Filtro por Situação Cadastral (Ativo/Inativo) - comparação exata
        if (filtro.Ativo.HasValue)
        {
            query = query.Where(c => c.Ativo == filtro.Ativo.Value);
        }

        // Projeção enxuta para ClienteListItemResponseDto (sem dados sensíveis ou desnecessários)
        return await query
            .OrderBy(c => c.Nome)
            .Select(c => new ClienteListItemResponseDto
            {
                Codigo = c.Codigo,
                Nome = c.Nome,
                Email = c.Email,
                Cpf = c.Cpf,
                Genero = c.Genero,
                DataNascimento = c.DataNascimento,
                Ranking = c.Ranking,
                Ativo = c.Ativo,
                Telefone = c.Telefone != null ? new TelefoneResponseDto
                {
                    Id = c.Telefone.Id,
                    Tipo = c.Telefone.Tipo,
                    Ddd = c.Telefone.Ddd,
                    Numero = c.Telefone.Numero
                } : null
            })
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// Lista os endereços cadastrados de um cliente pelo seu código único.
    /// </summary>
    public async Task<List<EnderecoResponseDto>> ListarEnderecosAsync(
        string codigoCliente,
        CancellationToken cancellationToken = default)
    {
        var cliente = await _context.Clientes
            .AsNoTracking()
            .Include(c => c.Enderecos)
            .FirstOrDefaultAsync(c => c.Codigo == codigoCliente, cancellationToken);

        if (cliente is null)
        {
            throw new NotFoundException($"Cliente com código '{codigoCliente}' não foi encontrado.");
        }

        return cliente.Enderecos
            .OrderBy(e => e.Id)
            .Select(MapearEnderecoParaResponseDto)
            .ToList();
    }

    /// <summary>
    /// RF0026 / RNF0034: Adiciona um novo endereço associado ao cliente de forma independente.
    /// </summary>
    public async Task<EnderecoResponseDto> AdicionarEnderecoAsync(
        string codigoCliente,
        EnderecoRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var cliente = await _context.Clientes
            .Include(c => c.Enderecos)
            .FirstOrDefaultAsync(c => c.Codigo == codigoCliente, cancellationToken);

        if (cliente is null)
        {
            throw new NotFoundException($"Cliente com código '{codigoCliente}' não foi encontrado.");
        }

        ValidarDadosEndereco(request);

        var cepNormalizado = Regex.Replace(request.Cep ?? string.Empty, @"\D", "");

        var novoEndereco = new Endereco
        {
            ClienteId = cliente.Id,
            Nome = request.Nome.Trim(),
            TipoResidencia = request.TipoResidencia.Trim(),
            TipoLogradouro = request.TipoLogradouro.Trim(),
            Logradouro = request.Logradouro.Trim(),
            Numero = request.Numero.Trim(),
            Complemento = string.IsNullOrWhiteSpace(request.Complemento) ? null : request.Complemento.Trim(),
            Bairro = request.Bairro.Trim(),
            Cep = cepNormalizado,
            Cidade = request.Cidade.Trim(),
            Estado = request.Estado.Trim().ToUpperInvariant(),
            Pais = request.Pais.Trim(),
            Observacoes = string.IsNullOrWhiteSpace(request.Observacoes) ? null : request.Observacoes.Trim(),
            Residencial = request.Residencial,
            Entrega = request.Entrega,
            Cobranca = request.Cobranca
        };

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        cliente.Enderecos.Add(novoEndereco);
        await _context.SaveChangesAsync(cancellationToken);

        // RNF0012: Auditoria da criação do endereço com o ID gerado pelo banco
        var dadosNovosEndereco = new
        {
            clienteCodigo = cliente.Codigo,
            nome = novoEndereco.Nome,
            tipoResidencia = novoEndereco.TipoResidencia,
            tipoLogradouro = novoEndereco.TipoLogradouro,
            logradouro = novoEndereco.Logradouro,
            numero = novoEndereco.Numero,
            complemento = novoEndereco.Complemento,
            bairro = novoEndereco.Bairro,
            cep = novoEndereco.Cep,
            cidade = novoEndereco.Cidade,
            estado = novoEndereco.Estado,
            pais = novoEndereco.Pais,
            observacoes = novoEndereco.Observacoes,
            residencial = novoEndereco.Residencial,
            entrega = novoEndereco.Entrega,
            cobranca = novoEndereco.Cobranca
        };

        await _auditoriaService.RegistrarAsync(
            entidade: "ENDERECO",
            registroId: novoEndereco.Id.ToString(),
            operacao: "INSERCAO",
            dadosAnteriores: null,
            dadosNovos: dadosNovosEndereco,
            usuarioResponsavel: "ADMIN",
            cancellationToken: cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return MapearEnderecoParaResponseDto(novoEndereco);
    }

    /// <summary>
    /// RF0026 / RNF0034 / RN0021 / RN0022 / RN0026:
    /// Altera um endereço existente do cliente, garantindo que o cliente mantenha
    /// pelo menos um endereço residencial, um de entrega e um de cobrança.
    /// </summary>
    public async Task<EnderecoResponseDto> AlterarEnderecoAsync(
        string codigoCliente,
        int enderecoId,
        EnderecoRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var cliente = await _context.Clientes
            .Include(c => c.Enderecos)
            .FirstOrDefaultAsync(c => c.Codigo == codigoCliente, cancellationToken);

        if (cliente is null)
        {
            throw new NotFoundException($"Cliente com código '{codigoCliente}' não foi encontrado.");
        }

        var endereco = cliente.Enderecos.FirstOrDefault(e => e.Id == enderecoId);
        if (endereco is null)
        {
            throw new NotFoundException($"Endereço com identificador '{enderecoId}' não foi encontrado para o cliente informado.");
        }

        ValidarDadosEndereco(request);

        // Integridade RN0022: Cliente deve manter pelo menos um endereço de entrega
        if (!request.Entrega && !cliente.Enderecos.Any(e => e.Id != enderecoId && e.Entrega))
        {
            throw new ValidationException("O cliente deve possuir pelo menos um endereço de entrega cadastrado. (RN0022)");
        }

        // Integridade RN0021: Cliente deve manter pelo menos um endereço de cobrança
        if (!request.Cobranca && !cliente.Enderecos.Any(e => e.Id != enderecoId && e.Cobranca))
        {
            throw new ValidationException("O cliente deve possuir pelo menos um endereço de cobrança cadastrado. (RN0021)");
        }

        // Integridade RN0026: Cliente deve manter pelo menos um endereço residencial
        if (!request.Residencial && !cliente.Enderecos.Any(e => e.Id != enderecoId && e.Residencial))
        {
            throw new ValidationException("O cliente deve possuir pelo menos um endereço residencial cadastrado. (RN0026)");
        }

        var cepNormalizado = Regex.Replace(request.Cep ?? string.Empty, @"\D", "");

        // RNF0012: Captura de valores anteriores e cálculo de delta
        var dadosAnteriores = new Dictionary<string, object?>();
        var dadosNovos = new Dictionary<string, object?>();

        void Comparar<T>(string campo, T anterior, T novo)
        {
            if (!EqualityComparer<T>.Default.Equals(anterior, novo))
            {
                dadosAnteriores[campo] = anterior;
                dadosNovos[campo] = novo;
            }
        }

        var nomeNovo = request.Nome.Trim();
        var tipoResidenciaNovo = request.TipoResidencia.Trim();
        var tipoLogradouroNovo = request.TipoLogradouro.Trim();
        var logradouroNovo = request.Logradouro.Trim();
        var numeroNovo = request.Numero.Trim();
        var complementoNovo = string.IsNullOrWhiteSpace(request.Complemento) ? null : request.Complemento.Trim();
        var bairroNovo = request.Bairro.Trim();
        var cidadeNova = request.Cidade.Trim();
        var estadoNovo = request.Estado.Trim().ToUpperInvariant();
        var paisNovo = request.Pais.Trim();
        var observacoesNovas = string.IsNullOrWhiteSpace(request.Observacoes) ? null : request.Observacoes.Trim();

        Comparar("nome", endereco.Nome, nomeNovo);
        Comparar("tipoResidencia", endereco.TipoResidencia, tipoResidenciaNovo);
        Comparar("tipoLogradouro", endereco.TipoLogradouro, tipoLogradouroNovo);
        Comparar("logradouro", endereco.Logradouro, logradouroNovo);
        Comparar("numero", endereco.Numero, numeroNovo);
        Comparar("complemento", endereco.Complemento, complementoNovo);
        Comparar("bairro", endereco.Bairro, bairroNovo);
        Comparar("cep", endereco.Cep, cepNormalizado);
        Comparar("cidade", endereco.Cidade, cidadeNova);
        Comparar("estado", endereco.Estado, estadoNovo);
        Comparar("pais", endereco.Pais, paisNovo);
        Comparar("observacoes", endereco.Observacoes, observacoesNovas);
        Comparar("residencial", endereco.Residencial, request.Residencial);
        Comparar("entrega", endereco.Entrega, request.Entrega);
        Comparar("cobranca", endereco.Cobranca, request.Cobranca);

        endereco.Nome = nomeNovo;
        endereco.TipoResidencia = tipoResidenciaNovo;
        endereco.TipoLogradouro = tipoLogradouroNovo;
        endereco.Logradouro = logradouroNovo;
        endereco.Numero = numeroNovo;
        endereco.Complemento = complementoNovo;
        endereco.Bairro = bairroNovo;
        endereco.Cep = cepNormalizado;
        endereco.Cidade = cidadeNova;
        endereco.Estado = estadoNovo;
        endereco.Pais = paisNovo;
        endereco.Observacoes = observacoesNovas;
        endereco.Residencial = request.Residencial;
        endereco.Entrega = request.Entrega;
        endereco.Cobranca = request.Cobranca;

        if (dadosNovos.Count > 0)
        {
            await _auditoriaService.RegistrarAsync(
                entidade: "ENDERECO",
                registroId: endereco.Id.ToString(),
                operacao: "ALTERACAO",
                dadosAnteriores: dadosAnteriores,
                dadosNovos: dadosNovos,
                usuarioResponsavel: "ADMIN",
                cancellationToken: cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);

        return MapearEnderecoParaResponseDto(endereco);
    }

    /// <summary>
    /// RN0023: Validação de campos obrigatórios de endereço.
    /// </summary>
    private static void ValidarDadosEndereco(EnderecoRequestDto endDto, int? pos = null)
    {
        var sufixo = pos.HasValue ? $" {pos.Value}" : string.Empty;

        if (string.IsNullOrWhiteSpace(endDto.Nome))
        {
            throw new ValidationException($"A identificação/nome do endereço{sufixo} é obrigatória.");
        }

        if (string.IsNullOrWhiteSpace(endDto.TipoResidencia))
        {
            throw new ValidationException($"O tipo de residência do endereço{sufixo} é obrigatório. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(endDto.TipoLogradouro))
        {
            throw new ValidationException($"O tipo de logradouro do endereço{sufixo} é obrigatório. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(endDto.Logradouro))
        {
            throw new ValidationException($"O logradouro do endereço{sufixo} é obrigatório. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(endDto.Numero))
        {
            throw new ValidationException($"O número do endereço{sufixo} é obrigatório. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(endDto.Bairro))
        {
            throw new ValidationException($"O bairro do endereço{sufixo} é obrigatório. (RN0023)");
        }

        var cepNormalizado = Regex.Replace(endDto.Cep ?? string.Empty, @"\D", "");
        if (cepNormalizado.Length != 8)
        {
            throw new ValidationException($"O CEP do endereço{sufixo} deve conter exatamente 8 dígitos numéricos. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(endDto.Cidade))
        {
            throw new ValidationException($"A cidade do endereço{sufixo} é obrigatória. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(endDto.Estado))
        {
            throw new ValidationException($"O estado do endereço{sufixo} é obrigatório. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(endDto.Pais))
        {
            throw new ValidationException($"O país do endereço{sufixo} é obrigatório. (RN0023)");
        }

        // Regra de Integridade de ENDERECO: Todo endereço deve possuir pelo menos uma finalidade
        if (!endDto.Residencial && !endDto.Entrega && !endDto.Cobranca)
        {
            throw new ValidationException($"O endereço{sufixo} deve possuir pelo menos uma finalidade: Residencial, Entrega ou Cobrança.");
        }
    }

    /// <summary>
    /// Mapeia a entidade Endereco para EnderecoResponseDto.
    /// </summary>
    private static EnderecoResponseDto MapearEnderecoParaResponseDto(Endereco e)
    {
        return new EnderecoResponseDto
        {
            Id = e.Id,
            Nome = e.Nome,
            TipoResidencia = e.TipoResidencia,
            TipoLogradouro = e.TipoLogradouro,
            Logradouro = e.Logradouro,
            Numero = e.Numero,
            Complemento = e.Complemento,
            Bairro = e.Bairro,
            Cep = e.Cep,
            Cidade = e.Cidade,
            Estado = e.Estado,
            Pais = e.Pais,
            Observacoes = e.Observacoes,
            Residencial = e.Residencial,
            Entrega = e.Entrega,
            Cobranca = e.Cobranca
        };
    }

    /// <summary>
    /// RF0027: Lista todos os cartões cadastrados de um cliente pelo seu código único.
    /// </summary>
    public async Task<List<CartaoResponseDto>> ListarCartoesAsync(
        string codigoCliente,
        CancellationToken cancellationToken = default)
    {
        var cliente = await _context.Clientes
            .AsNoTracking()
            .Include(c => c.Cartoes)
                .ThenInclude(ca => ca.Bandeira)
            .FirstOrDefaultAsync(c => c.Codigo == codigoCliente, cancellationToken);

        if (cliente is null)
        {
            throw new NotFoundException($"Cliente com código '{codigoCliente}' não foi encontrado.");
        }

        return cliente.Cartoes
            .OrderByDescending(c => c.Preferencial)
            .ThenBy(c => c.Id)
            .Select(MapearCartaoParaResponseDto)
            .ToList();
    }

    /// <summary>
    /// RF0027 / RN0024 / RN0025: Cadastra um novo cartão de crédito associado ao cliente.
    /// O primeiro cartão cadastrado é automaticamente definido como preferencial.
    /// Se um novo cartão for marcado como preferencial, desmarca os anteriores.
    /// </summary>
    public async Task<CartaoResponseDto> AdicionarCartaoAsync(
        string codigoCliente,
        CartaoCreateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var cliente = await _context.Clientes
            .Include(c => c.Cartoes)
            .FirstOrDefaultAsync(c => c.Codigo == codigoCliente, cancellationToken);

        if (cliente is null)
        {
            throw new NotFoundException($"Cliente com código '{codigoCliente}' não foi encontrado.");
        }

        await ValidarDadosCartaoAsync(request, cancellationToken);

        var numeroCartaoLimpo = Regex.Replace(request.NumeroCartao ?? string.Empty, @"\D", "");
        var cvvLimpo = Regex.Replace(request.Cvv ?? string.Empty, @"\D", "");

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        // RF0027: Regra de definição do cartão preferencial
        bool definirComoPreferencial;
        if (cliente.Cartoes.Count == 0)
        {
            // Primeiro cartão do cliente é compulsoriamente o preferencial
            definirComoPreferencial = true;
        }
        else if (request.Preferencial)
        {
            // Se o novo cartão for preferencial, desmarca todos os anteriores e audita a alteração
            foreach (var c in cliente.Cartoes)
            {
                if (c.Preferencial)
                {
                    await _auditoriaService.RegistrarAsync(
                        entidade: "CARTAO",
                        registroId: c.Id.ToString(),
                        operacao: "ALTERACAO",
                        dadosAnteriores: new { preferencial = true },
                        dadosNovos: new { preferencial = false },
                        usuarioResponsavel: "ADMIN",
                        cancellationToken: cancellationToken);
                }
                c.Preferencial = false;
            }
            definirComoPreferencial = true;
        }
        else
        {
            definirComoPreferencial = false;
        }

        var novoCartao = new Cartao
        {
            ClienteId = cliente.Id,
            BandeiraId = request.BandeiraId,
            NumeroCartao = numeroCartaoLimpo,
            NomeImpresso = request.NomeImpresso.Trim().ToUpperInvariant(),
            DataValidade = request.DataValidade.Trim(),
            Cvv = cvvLimpo,
            Preferencial = definirComoPreferencial
        };

        cliente.Cartoes.Add(novoCartao);
        await _context.SaveChangesAsync(cancellationToken);

        // Carrega a bandeira para o mapeamento do DTO de resposta e log
        var bandeira = await _context.Bandeiras
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == novoCartao.BandeiraId, cancellationToken);

        novoCartao.Bandeira = bandeira!;

        // RNF0012: Auditoria com dados estritamente seguros (sem CVV e apenas últimos 4 dígitos)
        var ultimosQuatro = numeroCartaoLimpo.Length >= 4
            ? numeroCartaoLimpo.Substring(numeroCartaoLimpo.Length - 4)
            : numeroCartaoLimpo;

        var dadosNovosCartao = new
        {
            clienteCodigo = cliente.Codigo,
            bandeiraId = novoCartao.BandeiraId,
            bandeiraNome = bandeira?.Nome ?? string.Empty,
            nomeImpresso = novoCartao.NomeImpresso,
            ultimosQuatroDigitos = ultimosQuatro,
            dataValidade = novoCartao.DataValidade,
            preferencial = novoCartao.Preferencial
        };

        await _auditoriaService.RegistrarAsync(
            entidade: "CARTAO",
            registroId: novoCartao.Id.ToString(),
            operacao: "INSERCAO",
            dadosAnteriores: null,
            dadosNovos: dadosNovosCartao,
            usuarioResponsavel: "ADMIN",
            cancellationToken: cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return MapearCartaoParaResponseDto(novoCartao);
    }

    /// <summary>
    /// RF0027: Define um cartão existente como o preferencial do cliente, desmarcando os demais.
    /// Valida que o cartão pertence ao cliente identificado pelo código informado na rota.
    /// </summary>
    public async Task<CartaoResponseDto> DefinirCartaoPreferencialAsync(
        string codigoCliente,
        int cartaoId,
        CancellationToken cancellationToken = default)
    {
        var cliente = await _context.Clientes
            .Include(c => c.Cartoes)
                .ThenInclude(ca => ca.Bandeira)
            .FirstOrDefaultAsync(c => c.Codigo == codigoCliente, cancellationToken);

        if (cliente is null)
        {
            throw new NotFoundException($"Cliente com código '{codigoCliente}' não foi encontrado.");
        }

        var cartaoAlvo = cliente.Cartoes.FirstOrDefault(c => c.Id == cartaoId);
        if (cartaoAlvo is null)
        {
            throw new NotFoundException($"Cartão com identificador '{cartaoId}' não foi encontrado para o cliente informado.");
        }

        // RF0027: Desmarca os demais cartões e define o alvo como preferencial (RNF0012: audita as alterações reais)
        foreach (var c in cliente.Cartoes)
        {
            if (c.Id == cartaoId)
            {
                if (!c.Preferencial)
                {
                    c.Preferencial = true;
                    await _auditoriaService.RegistrarAsync(
                        entidade: "CARTAO",
                        registroId: c.Id.ToString(),
                        operacao: "ALTERACAO",
                        dadosAnteriores: new { preferencial = false },
                        dadosNovos: new { preferencial = true },
                        usuarioResponsavel: "ADMIN",
                        cancellationToken: cancellationToken);
                }
            }
            else if (c.Preferencial)
            {
                c.Preferencial = false;
                await _auditoriaService.RegistrarAsync(
                    entidade: "CARTAO",
                    registroId: c.Id.ToString(),
                    operacao: "ALTERACAO",
                    dadosAnteriores: new { preferencial = true },
                    dadosNovos: new { preferencial = false },
                    usuarioResponsavel: "ADMIN",
                    cancellationToken: cancellationToken);
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return MapearCartaoParaResponseDto(cartaoAlvo);
    }

    /// <summary>
    /// RN0024 / RN0025 e decisões de projeto: Validação dos dados do cartão de crédito.
    /// </summary>
    private async Task ValidarDadosCartaoAsync(CartaoCreateRequestDto request, CancellationToken cancellationToken)
    {
        if (request is null)
        {
            throw new ValidationException("Os dados do cartão são obrigatórios.");
        }

        // RN0025: Bandeira previamente cadastrada e ativa
        if (request.BandeiraId <= 0)
        {
            throw new ValidationException("A bandeira do cartão é obrigatória.");
        }

        var bandeiraValida = await _context.Bandeiras
            .AsNoTracking()
            .AnyAsync(b => b.Id == request.BandeiraId && b.Ativo, cancellationToken);

        if (!bandeiraValida)
        {
            throw new ValidationException("A bandeira informada não é válida ou não está ativa.");
        }

        // RN0024: Número do cartão
        var numeroLimpo = Regex.Replace(request.NumeroCartao ?? string.Empty, @"\D", "");
        if (string.IsNullOrWhiteSpace(numeroLimpo) || numeroLimpo.Length < 13 || numeroLimpo.Length > 19)
        {
            throw new ValidationException("O número do cartão informado é inválido.");
        }

        // RN0024: Nome impresso no cartão
        if (string.IsNullOrWhiteSpace(request.NomeImpresso))
        {
            throw new ValidationException("O nome impresso no cartão é obrigatório.");
        }

        if (request.NomeImpresso.Trim().Length > 100)
        {
            throw new ValidationException("O nome impresso no cartão não pode exceder 100 caracteres.");
        }

        // RN0024: Código de segurança (CVV)
        var cvvLimpo = Regex.Replace(request.Cvv ?? string.Empty, @"\D", "");
        if (string.IsNullOrWhiteSpace(cvvLimpo) || (cvvLimpo.Length != 3 && cvvLimpo.Length != 4) || cvvLimpo != (request.Cvv ?? string.Empty).Trim())
        {
            throw new ValidationException("O código de segurança (CVV) deve conter 3 ou 4 dígitos numéricos.");
        }

        // Decisão do Projeto: Validação da data de validade (MM/AA ou MM/AAAA)
        if (string.IsNullOrWhiteSpace(request.DataValidade))
        {
            throw new ValidationException("A data de validade do cartão é obrigatória.");
        }

        var partesValidade = request.DataValidade.Trim().Split('/');
        if (partesValidade.Length != 2 ||
            !int.TryParse(partesValidade[0], out int mes) ||
            !int.TryParse(partesValidade[1], out int ano) ||
            mes < 1 || mes > 12)
        {
            throw new ValidationException("Informe uma data de validade válida no formato MM/AA.");
        }

        if (partesValidade[1].Length == 2)
        {
            ano += 2000;
        }
        else if (partesValidade[1].Length != 4)
        {
            throw new ValidationException("Informe uma data de validade válida no formato MM/AA.");
        }

        var agora = DateTime.UtcNow;
        var anoAtual = agora.Year;
        var mesAtual = agora.Month;

        if (ano < anoAtual || (ano == anoAtual && mes < mesAtual))
        {
            throw new ValidationException("O cartão informado está com a data de validade vencida.");
        }

        if (ano > anoAtual + 25)
        {
            throw new ValidationException("Ano de validade do cartão inválido.");
        }
    }

    /// <summary>
    /// Mapeia a entidade Cartao para CartaoResponseDto garantindo proteção de dados sensíveis (sem CVV e com número mascarado).
    /// </summary>
    private static CartaoResponseDto MapearCartaoParaResponseDto(Cartao c)
    {
        var ultimosQuatro = c.NumeroCartao.Length >= 4
            ? c.NumeroCartao.Substring(c.NumeroCartao.Length - 4)
            : c.NumeroCartao;

        return new CartaoResponseDto
        {
            Id = c.Id,
            BandeiraId = c.BandeiraId,
            BandeiraNome = c.Bandeira?.Nome ?? string.Empty,
            NomeImpresso = c.NomeImpresso,
            UltimosQuatroDigitos = ultimosQuatro,
            DataValidade = c.DataValidade,
            Preferencial = c.Preferencial
        };
    }

    /// <summary>
    /// RNF0031: Validação de Senha Forte.
    /// Exige no mínimo 8 caracteres, pelo menos uma letra maiúscula, uma minúscula e um caractere especial.
    /// </summary>
    private static void ValidarSenhaForte(string senha)
    {
        if (senha.Length < 8)
        {
            throw new ValidationException("A senha deve conter no mínimo 8 caracteres. (RNF0031)");
        }

        if (!senha.Any(char.IsUpper))
        {
            throw new ValidationException("A senha deve conter pelo menos uma letra maiúscula. (RNF0031)");
        }

        if (!senha.Any(char.IsLower))
        {
            throw new ValidationException("A senha deve conter pelo menos uma letra minúscula. (RNF0031)");
        }

        if (!senha.Any(ch => !char.IsLetterOrDigit(ch)))
        {
            throw new ValidationException("A senha deve conter pelo menos um caractere especial (!, @, #, $, etc.). (RNF0031)");
        }
    }

    /// <summary>
    /// RN0026: Validação do nome do cliente.
    /// </summary>
    private static void ValidarNome(string? nome)
    {
        if (string.IsNullOrWhiteSpace(nome))
        {
            throw new ValidationException("O nome do cliente é obrigatório. (RN0026)");
        }

        if (nome.Trim().Length > 150)
        {
            throw new ValidationException("O nome do cliente não pode exceder 150 caracteres.");
        }
    }

    /// <summary>
    /// RN0026: Validação do gênero do cliente.
    /// </summary>
    private static void ValidarGenero(string? genero)
    {
        if (string.IsNullOrWhiteSpace(genero))
        {
            throw new ValidationException("O gênero do cliente é obrigatório. (RN0026)");
        }

        if (genero.Trim().Length > 30)
        {
            throw new ValidationException("O gênero não pode exceder 30 caracteres.");
        }
    }

    /// <summary>
    /// RN0026: Validação de data de nascimento.
    /// </summary>
    private static void ValidarDataNascimento(DateOnly dataNascimento)
    {
        if (dataNascimento == default)
        {
            throw new ValidationException("A data de nascimento do cliente é obrigatória. (RN0026)");
        }

        var dataAtual = DateOnly.FromDateTime(DateTime.UtcNow);
        if (dataNascimento > dataAtual)
        {
            throw new ValidationException("A data de nascimento não pode ser futura.");
        }

        if (dataNascimento < new DateOnly(1900, 1, 1))
        {
            throw new ValidationException("Informe um ano de nascimento válido.");
        }
    }

    /// <summary>
    /// RN0026 / Decisão de Projeto RunWay: Normalização e validação de e-mail.
    /// </summary>
    private static string NormalizarEValidarEmail(string? email)
    {
        var emailNormalizado = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(emailNormalizado) || !emailNormalizado.Contains('@') || !emailNormalizado.Contains('.'))
        {
            throw new ValidationException("Informe um e-mail válido. (RN0026)");
        }

        if (emailNormalizado.Length > 255)
        {
            throw new ValidationException("O e-mail não pode exceder 255 caracteres.");
        }

        return emailNormalizado;
    }

    /// <summary>
    /// RN0026: Normalização e validação de dados de telefone.
    /// </summary>
    private static (string Tipo, string Ddd, string Numero) NormalizarEValidarTelefone(TelefoneRequestDto? telefone)
    {
        if (telefone is null)
        {
            throw new ValidationException("Os dados de telefone são obrigatórios. (RN0026)");
        }

        if (string.IsNullOrWhiteSpace(telefone.Tipo))
        {
            throw new ValidationException("O tipo de telefone é obrigatório. (RN0026)");
        }

        var dddNormalizado = Regex.Replace(telefone.Ddd ?? string.Empty, @"\D", "");
        if (dddNormalizado.Length != 2)
        {
            throw new ValidationException("O DDD do telefone deve conter exatamente 2 dígitos numéricos. (RN0026)");
        }

        var numeroTelefoneNormalizado = Regex.Replace(telefone.Numero ?? string.Empty, @"\D", "");
        if (numeroTelefoneNormalizado.Length != 8 && numeroTelefoneNormalizado.Length != 9)
        {
            throw new ValidationException("O número de telefone deve conter 8 ou 9 dígitos numéricos. (RN0026)");
        }

        return (telefone.Tipo.Trim(), dddNormalizado, numeroTelefoneNormalizado);
    }

    /// <summary>
    /// Mapeia a entidade Cliente para ClienteResponseDto preservando proteção contra exposição indevida de dados sensíveis.
    /// </summary>
    private static ClienteResponseDto MapearClienteParaResponseDto(Cliente cliente)
    {
        return new ClienteResponseDto
        {
            Id = cliente.Id,
            Codigo = cliente.Codigo,
            Nome = cliente.Nome,
            Email = cliente.Email,
            Cpf = cliente.Cpf,
            Genero = cliente.Genero,
            DataNascimento = cliente.DataNascimento,
            Ranking = cliente.Ranking,
            Ativo = cliente.Ativo,
            Telefone = cliente.Telefone is not null
                ? new TelefoneResponseDto
                {
                    Id = cliente.Telefone.Id,
                    Tipo = cliente.Telefone.Tipo,
                    Ddd = cliente.Telefone.Ddd,
                    Numero = cliente.Telefone.Numero
                }
                : null!,
            Enderecos = cliente.Enderecos?.Select(MapearEnderecoParaResponseDto).ToList() ?? new List<EnderecoResponseDto>()
        };
    }
}

