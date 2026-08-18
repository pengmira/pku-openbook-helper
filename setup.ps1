$ErrorActionPreference = "Stop"

Write-Host "Checking Node.js..."
node --version

Write-Host "Checking Python..."
python --version

Write-Host "Installing Node dependencies..."
if (Test-Path "pnpm-lock.yaml") {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm install
  } else {
    npm install
  }
} else {
  npm install
}

Write-Host "Installing Python dependencies..."
python -m pip install python-docx

Write-Host "Done. Put your OCRed Word file in this folder, then run docx_search.py extract."
