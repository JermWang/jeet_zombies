# Orchestrates real-gameplay recording: starts the prod server, records, stops it.
$ErrorActionPreference = "Continue"
Set-Location "C:\Users\16303\Desktop\CURSOR\WEB3\jeet-zombies"
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 1

$srv = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run start > out\prodserver.log 2>&1" -PassThru -WindowStyle Hidden
Write-Output "server launching (pid $($srv.Id)); waiting for ready..."

$ready = $false
for ($i = 0; $i -lt 45; $i++) {
  try {
    $r = Invoke-WebRequest "http://127.0.0.1:3000" -TimeoutSec 3 -UseBasicParsing
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
  Start-Sleep 2
}
Write-Output "ready=$ready"
if (-not $ready) { Get-Content out\prodserver.log -Tail 15 -ErrorAction SilentlyContinue; exit 1 }

try { Invoke-WebRequest "http://127.0.0.1:3000/?demo=1" -TimeoutSec 60 -UseBasicParsing | Out-Null } catch {}
Write-Output "=== running recorder ==="
node scripts\record-gameplay.mjs
$code = $LASTEXITCODE

Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Output "=== done; recorder exit $code ==="
