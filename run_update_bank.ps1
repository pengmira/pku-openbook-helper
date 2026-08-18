$ErrorActionPreference = "Stop"
python work\update_answer_bank.py
Write-Host "If conflicts exist, review work\answer_bank_review.md"
