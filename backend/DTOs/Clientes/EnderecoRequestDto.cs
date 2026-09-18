namespace RunWay.Api.DTOs.Clientes;

public class EnderecoRequestDto
{
    public string Nome { get; set; } = string.Empty;
    public string TipoResidencia { get; set; } = string.Empty;
    public string TipoLogradouro { get; set; } = string.Empty;
    public string Logradouro { get; set; } = string.Empty;
    public string Numero { get; set; } = string.Empty;
    public string? Complemento { get; set; }
    public string Bairro { get; set; } = string.Empty;
    public string Cep { get; set; } = string.Empty;
    public string Cidade { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public string Pais { get; set; } = string.Empty;
    public string? Observacoes { get; set; }
    public bool Residencial { get; set; }
    public bool Entrega { get; set; }
    public bool Cobranca { get; set; }
}
