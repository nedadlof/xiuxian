param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args
)

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
  $python = Get-Command py -ErrorAction SilentlyContinue
}

if (-not $python) {
  Write-Error "Python not found in PATH."
  exit 1
}

& $python.Source "C:\Users\12909\Documents\AI_TEST\game\web\tools\run_ui_smoke.py" @Args
$exitCode = $LASTEXITCODE
exit $exitCode
