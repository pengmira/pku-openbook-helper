import json
import re
from pathlib import Path


def clean_question(q):
    no = q["questionNo"]
    text = q["text"]
    marker = f"第 {no} 题"
    if marker in text:
        text = text.split(marker, 1)[1]
    text = re.sub(r"^\s*\d+\s*分\s*", "", text)
    text = re.split(r"\s+\d+\s*/\s*90\s+上一题\s+下一题", text)[0]
    return re.sub(r"\s+", " ", text).strip()


questions = json.loads(Path("work/questions.json").read_text(encoding="utf-8"))
lines = []
for q in questions:
    lines.append(f"## {q['questionNo']} {q['kind']}")
    lines.append(clean_question(q))
    for option in q["options"]:
        lines.append(f"- {option['text']}")
    lines.append("")

Path("work/questions_readable.md").write_text("\n".join(lines), encoding="utf-8")
print("wrote work/questions_readable.md")
