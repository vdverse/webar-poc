# Sets Supabase secrets for Meshy without printing the key value.
# Reads IMAGE_TO_3D_API_KEY from .env.meshy.local (gitignored).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/set-meshy-secrets.ps1

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$keyFile = Join-Path $repoRoot '.env.meshy.local'

if (-not (Test-Path -LiteralPath $keyFile)) {
    throw '.env.meshy.local was not found. Copy .env.meshy.local.example and add IMAGE_TO_3D_API_KEY.'
}

$activeLine = Get-Content -LiteralPath $keyFile |
    Where-Object { $_ -match '^\s*IMAGE_TO_3D_API_KEY\s*=' } |
    Select-Object -First 1

if (-not $activeLine) {
    $commented = Get-Content -LiteralPath $keyFile |
        Where-Object { $_ -match '^\s*#\s*IMAGE_TO_3D_API_KEY\s*=' } |
        Select-Object -First 1
    if ($commented) {
        throw 'IMAGE_TO_3D_API_KEY is commented out in .env.meshy.local. Uncomment that line (remove the leading #) so it is an active assignment.'
    }
    throw 'IMAGE_TO_3D_API_KEY is missing from .env.meshy.local.'
}

$key = ($activeLine -split '=', 2)[1].Trim().Trim('"').Trim("'")

if ([string]::IsNullOrWhiteSpace($key)) {
    throw 'IMAGE_TO_3D_API_KEY is blank.'
}

if ($key -eq 'msy_****' -or $key -match 'YOUR_|CHANGEME|placeholder|\*{2,}') {
    throw 'IMAGE_TO_3D_API_KEY is still a placeholder. Put the real Meshy key in .env.meshy.local.'
}

if ($key.Length -lt 10) {
    throw 'IMAGE_TO_3D_API_KEY looks too short.'
}

Write-Host ("Uploading Meshy secrets. Key length: {0}. Value will not be printed." -f $key.Length)

$envFile = Join-Path $env:TEMP ("meshy-secrets-{0}.env" -f [guid]::NewGuid().ToString('N'))

try {
    @(
        'IMAGE_TO_3D_PROVIDER=meshy'
        ('IMAGE_TO_3D_API_KEY={0}' -f $key)
        'IMAGE_TO_3D_ALLOW_MOCK=false'
    ) | Set-Content -LiteralPath $envFile -Encoding ascii

    supabase secrets set --env-file $envFile --project-ref codqgrxradxaloruoyys
    if ($LASTEXITCODE -ne 0) {
        throw 'Supabase secret upload failed.'
    }

    Write-Host 'Supabase secrets set: IMAGE_TO_3D_PROVIDER, IMAGE_TO_3D_API_KEY, IMAGE_TO_3D_ALLOW_MOCK'
    Write-Host 'Verifying secret names only:'
    supabase secrets list --project-ref codqgrxradxaloruoyys
    if ($LASTEXITCODE -ne 0) {
        throw 'Supabase secrets list failed.'
    }
}
finally {
    if (Test-Path -LiteralPath $envFile) {
        Remove-Item -LiteralPath $envFile -Force
    }
}
