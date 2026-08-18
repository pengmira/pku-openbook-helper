$ErrorActionPreference = "Stop"
python work\export_questions.py
python work\apply_answer_bank.py
Write-Host "Review missing questions at work\needs_review.md"
