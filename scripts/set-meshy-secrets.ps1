# Sets Supabase secrets for Meshy without printing the key value.
# Reads IMAGE_TO_3D_API_KEY from .env.meshy.local (gitignored).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$keyFile = Join-Path $root '.env.meshy.local'

if (-not (Test-Path $keyFile)) {
  Write-Error "Missing $keyFile — copy .env.meshy.local.example and add IMAGE_TO_3D_API_KEY."
}

$raw = Get-Content $keyFile -Raw
$match = [regex]::Match($raw, '(?m)^IMAGE_TO_3D_API_KEY\s*=\s*(.+)$')
if (-not $match.Success) {
  Write-Error 'IMAGE_TO_3D_API_KEY not found in .env.meshy.local'
}

$key = $match.Groups[1].Value.Trim().Trim('"').Trim("'")
if ($key.Length -lt 10) {
  Write-Error 'IMAGE_TO_3D_API_KEY looks empty or too short.'
}

Write-Host "Setting IMAGE_TO_3D_PROVIDER=meshy and IMAGE_TO_3D_API_KEY (length=$($key.Length), value hidden)…"

# Pipe env-style input to supabase secrets set (avoids echoing in process list as much as possible)
$envFile = Join-Path $env:TEMP "meshy-secrets-$([guid]::NewGuid()).env"
try {
  @(
    'IMAGE_TO_3D_PROVIDER=meshy'
    "IMAGE_TO_3D_API_KEY=$key"
    'IMAGE_TO_3D_ALLOW_MOCK=false'
  ) | Set-Content -Path $envFile -Encoding ascii

  supabase secrets set --env-file $envFile --project-ref codqgrxradxaloruoyys
  if ($LASTEXITCODE -ne 0) { Write-Error 'supabase secrets set failed' }

  Write-Host 'Secrets set. Verifying names only:'
  supabase secrets list --project-ref codqgrxradxaloruoyys
}
finally {
  if (Test-Path $envFile) { Remove-Item -Force $envFile }
}
