$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
$refPath = Join-Path $projectRoot 'supabase/.temp/project-ref'
if (([IO.File]::ReadAllText($refPath)).Trim() -ne 'huxmltjtovpxxxupuxdg') { throw 'Unexpected linked project.' }
$pooler = [Uri]([IO.File]::ReadAllText((Join-Path $projectRoot 'supabase/.temp/pooler-url')).Trim())
if ($pooler.Host -ne 'aws-0-us-east-1.pooler.supabase.com' -or $pooler.Port -ne 5432 -or $pooler.UserInfo -ne 'postgres.huxmltjtovpxxxupuxdg') { throw 'Unexpected session pooler configuration.' }
Write-Host 'Piano Boss Battles - local database setup' -ForegroundColor Cyan
Write-Host 'Enter the DATABASE password for project huxmltjtovpxxxupuxdg.'
Write-Host 'This is not your Supabase account login password. Input is hidden and is not added to command history.'
$securePassword = Read-Host 'Database password' -AsSecureString
$pointer = [IntPtr]::Zero
try {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ([string]::IsNullOrWhiteSpace($plainPassword)) { throw 'Password cannot be empty.' }
  $encodedPassword = [Uri]::EscapeDataString($plainPassword)
  $databaseLine = 'DATABASE_URL=postgresql://postgres.huxmltjtovpxxxupuxdg:' + $encodedPassword + '@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
  $lines = @([IO.File]::ReadAllLines($envPath) | Where-Object { $_ -notmatch '^DATABASE_URL=' })
  [IO.File]::WriteAllLines($envPath, @($lines + $databaseLine), [Text.UTF8Encoding]::new($false))
  Write-Host 'Saved DATABASE_URL to the ignored local .env. No password was printed.' -ForegroundColor Green
} finally {
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  $plainPassword = $null; $encodedPassword = $null; $databaseLine = $null
  $securePassword.Dispose()
}
Read-Host 'Setup complete. Press Enter to close' | Out-Null
