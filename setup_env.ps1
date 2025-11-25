Write-Host "Checking environment for HopCoder..." -ForegroundColor Cyan

# Check for Winget
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error "Winget is not installed. Please install App Installer from the Microsoft Store."
    exit 1
}

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Installing via Winget..." -ForegroundColor Yellow
    winget install -e --id OpenJS.NodeJS.LTS
} else {
    Write-Host "Node.js is already installed." -ForegroundColor Green
}

# Check Rust
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Rust not found. Installing via Winget..." -ForegroundColor Yellow
    winget install -e --id Rustlang.Rustup
    
    Write-Host "NOTE: You may need to run 'rustup-init' if it wasn't run automatically." -ForegroundColor Magenta
} else {
    Write-Host "Rust is already installed." -ForegroundColor Green
}

# Check Build Tools for Visual Studio (needed for Rust on Windows)
# This is harder to check reliably via simple command, but we can warn.
Write-Host "`nIMPORTANT: For Rust on Windows, you also need 'C++ build tools' installed." -ForegroundColor Cyan
Write-Host "If the build fails, install 'Visual Studio Build Tools' with the 'Desktop development with C++' workload." -ForegroundColor Gray

Write-Host "`nSetup complete (or attempted)." -ForegroundColor Green
Write-Host "1. Restart your terminal/PowerShell."
Write-Host "2. Navigate to apps/hopcoder-shell"
Write-Host "3. Run: npm install"
Write-Host "4. Run: npm run tauri dev"
