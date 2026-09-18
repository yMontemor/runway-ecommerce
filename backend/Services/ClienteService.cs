using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Clientes;
using RunWay.Api.Exceptions;
using RunWay.Api.Models;

namespace RunWay.Api.Services;

public class ClienteService : IClienteService
{
    private readonly RunWayDbContext _context;
    private readonly IPasswordHasher<Cliente> _passwordHasher;

    public ClienteService(RunWayDbContext context, IPasswordHasher<Cliente>? passwordHasher = null)
    {
        _context = context;
        _passwordHasher = passwordHasher ?? new PasswordHasher<Cliente>();
    }

    public async Task<ClienteResponseDto> CadastrarAsync(
        ClienteCreateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        // =========================================================================
        // 1. VALIDAÇÃO DOS DADOS BÁSICOS DO CLIENTE (RN0026 / Decisões do RunWay)
        // =========================================================================
        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            throw new ValidationException("O nome do cliente é obrigatório. (RN0026)");
        }

        if (request.Nome.Trim().Length > 150)
        {
            throw new ValidationException("O nome do cliente não pode exceder 150 caracteres.");
        }

        if (string.IsNullOrWhiteSpace(request.Genero))
        {
            throw new ValidationException("O gênero do cliente é obrigatório. (RN0026)");
        }

        if (request.Genero.Trim().Length > 30)
        {
            throw new ValidationException("O gênero não pode exceder 30 caracteres.");
        }

        if (request.DataNascimento == default)
        {
            throw new ValidationException("A data de nascimento do cliente é obrigatória. (RN0026)");
        }

        var dataAtual = DateOnly.FromDateTime(DateTime.UtcNow);
        if (request.DataNascimento > dataAtual)
        {
            throw new ValidationException("A data de nascimento não pode ser futura.");
        }

        if (request.DataNascimento < new DateOnly(1900, 1, 1))
        {
            throw new ValidationException("Informe um ano de nascimento válido.");
        }

        // Normalização e validação de CPF (RN0026 / Decisão de Projeto RunWay)
        var cpfNormalizado = Regex.Replace(request.Cpf ?? string.Empty, @"\D", "");
        if (string.IsNullOrWhiteSpace(cpfNormalizado) || cpfNormalizado.Length != 11)
        {
            throw new ValidationException("O CPF informado deve conter exatamente 11 dígitos numéricos. (RN0026)");
        }

        // Normalização e validação de E-mail (RN0026 / Decisão de Projeto RunWay)
        var emailNormalizado = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(emailNormalizado) || !emailNormalizado.Contains('@') || !emailNormalizado.Contains('.'))
        {
            throw new ValidationException("Informe um e-mail válido. (RN0026)");
        }

        if (emailNormalizado.Length > 255)
        {
            throw new ValidationException("O e-mail não pode exceder 255 caracteres.");
        }

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
        if (request.Telefone is null)
        {
            throw new ValidationException("Os dados de telefone são obrigatórios. (RN0026)");
        }

        if (string.IsNullOrWhiteSpace(request.Telefone.Tipo))
        {
            throw new ValidationException("O tipo de telefone é obrigatório. (RN0026)");
        }

        var dddNormalizado = Regex.Replace(request.Telefone.Ddd ?? string.Empty, @"\D", "");
        if (dddNormalizado.Length != 2)
        {
            throw new ValidationException("O DDD do telefone deve conter exatamente 2 dígitos numéricos. (RN0026)");
        }

        var numeroTelefoneNormalizado = Regex.Replace(request.Telefone.Numero ?? string.Empty, @"\D", "");
        if (numeroTelefoneNormalizado.Length != 8 && numeroTelefoneNormalizado.Length != 9)
        {
            throw new ValidationException("O número de telefone deve conter 8 ou 9 dígitos numéricos. (RN0026)");
        }

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
                Tipo = request.Telefone.Tipo.Trim(),
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

        _context.Clientes.Add(novoCliente);
        await _context.SaveChangesAsync(cancellationToken);

        // =========================================================================
        // 7. MAPEAMENTO PARA RESPONSE DTO (Sem expor dados sensíveis)
        // =========================================================================
        return new ClienteResponseDto
        {
            Id = novoCliente.Id,
            Codigo = novoCliente.Codigo,
            Nome = novoCliente.Nome,
            Email = novoCliente.Email,
            Cpf = novoCliente.Cpf,
            Genero = novoCliente.Genero,
            DataNascimento = novoCliente.DataNascimento,
            Ranking = novoCliente.Ranking,
            Ativo = novoCliente.Ativo,
            Telefone = new TelefoneResponseDto
            {
                Id = novoCliente.Telefone.Id,
                Tipo = novoCliente.Telefone.Tipo,
                Ddd = novoCliente.Telefone.Ddd,
                Numero = novoCliente.Telefone.Numero
            },
            Enderecos = novoCliente.Enderecos.Select(MapearEnderecoParaResponseDto).ToList()
        };
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

        cliente.Enderecos.Add(novoEndereco);
        await _context.SaveChangesAsync(cancellationToken);

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

        endereco.Nome = request.Nome.Trim();
        endereco.TipoResidencia = request.TipoResidencia.Trim();
        endereco.TipoLogradouro = request.TipoLogradouro.Trim();
        endereco.Logradouro = request.Logradouro.Trim();
        endereco.Numero = request.Numero.Trim();
        endereco.Complemento = string.IsNullOrWhiteSpace(request.Complemento) ? null : request.Complemento.Trim();
        endereco.Bairro = request.Bairro.Trim();
        endereco.Cep = cepNormalizado;
        endereco.Cidade = request.Cidade.Trim();
        endereco.Estado = request.Estado.Trim().ToUpperInvariant();
        endereco.Pais = request.Pais.Trim();
        endereco.Observacoes = string.IsNullOrWhiteSpace(request.Observacoes) ? null : request.Observacoes.Trim();
        endereco.Residencial = request.Residencial;
        endereco.Entrega = request.Entrega;
        endereco.Cobranca = request.Cobranca;

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
}
