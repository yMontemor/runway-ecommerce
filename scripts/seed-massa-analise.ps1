# ==============================================================================
# RunWay E-Commerce - Massa Histórica da Análise Gerencial (01/11/2025 a 31/12/2026)
# Executa o script Node.js com destino explícito (runway_test ou runway).
# ==============================================================================

param (
    [Parameter(Mandatory = $true)]
    [ValidateSet("runway_test", "runway")]
    [string]$Target,
    [switch]$Status,
    [switch]$Restore
)

$scriptPath = Join-Path $PSScriptRoot "seed-massa-analise.js"

if (-not (Test-Path $scriptPath)) {
    Write-Error "Arquivo seed-massa-analise.js não encontrado em: $scriptPath"
    exit 1
}

if ($Restore -and $Target -ne "runway_test") {
    Write-Error "A opção -Restore é permitida exclusivamente com -Target runway_test."
    exit 1
}

$nodeArgs = @($scriptPath, "--target=$Target")
if ($Status) {
    $nodeArgs += "--status"
} elseif ($Restore) {
    $nodeArgs += "--restore"
}

node @nodeArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nA execução encerrou com erros. Verifique a saída acima." -ForegroundColor Red
    exit $LASTEXITCODE
}
