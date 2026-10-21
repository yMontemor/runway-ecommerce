# ==============================================================================
# RunWay E-Commerce - Cartão 02: Preparação da Massa da Análise Gerencial
# Executa o script Node.js para popular ou limpar o banco runway_test.
# ==============================================================================

param (
    [switch]$Clean,
    [switch]$Status
)

$scriptPath = Join-Path $PSScriptRoot "seed-massa-analise.js"

if (-not (Test-Path $scriptPath)) {
    Write-Error "Arquivo seed-massa-analise.js não encontrado em: $scriptPath"
    exit 1
}

$env:PGDATABASE = "runway_test"

if ($Clean) {
    node $scriptPath --clean
} elseif ($Status) {
    node $scriptPath --status
} else {
    node $scriptPath
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nA execução encerrou com erros. Verifique a saída acima." -ForegroundColor Red
    exit $LASTEXITCODE
}
