# ==============================================================================
# RunWay E-Commerce - Seed de Clientes para Ambiente de Teste (runway_test)
# Executa o script Node.js que popula a base através das APIs reais da aplicação.
# ==============================================================================

param (
    [string]$ApiUrl = "http://localhost:5035"
)

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host " INICIANDO SEED DE CLIENTES VIA API REAL: $ApiUrl" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

$scriptPath = Join-Path $PSScriptRoot "seed-runway-test.js"

if (-not (Test-Path $scriptPath)) {
    Write-Error "Arquivo seed-runway-test.js não encontrado em: $scriptPath"
    exit 1
}

$env:RUNWAY_API_URL = $ApiUrl
node $scriptPath $ApiUrl

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nO seed encerrou com erros. Verifique se o backend está em execução." -ForegroundColor Red
    exit $LASTEXITCODE
}
