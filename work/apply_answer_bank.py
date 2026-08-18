import json
import re
from pathlib import Path


QUESTIONS = Path("work/questions.json")
BANK = Path("work/answer_bank.json")
ANSWERS = Path("work/answers.json")
NEEDS_REVIEW = Path("work/needs_review.md")


def normalize(text: str) -> str:
    text = re.sub(r"2026级研究生校规校纪线上考试.*?提交考试", "", text)
    text = re.sub(r"单选题|多选题|填空题|判断题|第\s*\d+\s*题|\d+\s*分|\d+\s*/\s*90|上一题|下一题", "", text)
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"[（）()，。；;、：:？?！!\"“”‘’'《》<>]", "", text)
    return text


def clean_question_text(q):
    no = q["questionNo"]
    text = q["text"]
    marker = f"第 {no} 题"
    if marker in text:
        text = text.split(marker, 1)[1]
    text = re.sub(r"^\s*\d+\s*分\s*", "", text)
    text = re.split(r"\s+\d+\s*/\s*90\s+上一题\s+下一题", text)[0]
    return re.sub(r"\s+", " ", text).strip()


def parse_answer(label, q):
    letters = "ABCD"
    if q["options"]:
        idxs = [letters.index(ch) for ch in label if ch in letters]
        return {"index": q["questionNo"] - 1, "questionNo": q["questionNo"], "optionIndexes": idxs}
    return {"index": q["questionNo"] - 1, "questionNo": q["questionNo"], "blanks": [part.strip() for part in label.split("/")]}


questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))
bank = json.loads(BANK.read_text(encoding="utf-8"))

answers = []
missing = []
for q in questions:
    qtext = clean_question_text(q)
    key = normalize(qtext)
    hit = bank.get(key)
    if hit:
        answers.append(parse_answer(hit["answer"], q))
    else:
        missing.append((q, qtext))

ANSWERS.write_text(json.dumps(answers, ensure_ascii=False, indent=2), encoding="utf-8")

lines = ["# Needs Review", "", f"- matched: {len(answers)}", f"- missing: {len(missing)}", ""]
for q, qtext in missing:
    lines.append(f"## {q['questionNo']} {q['kind']}")
    lines.append(qtext)
    for option in q["options"]:
        lines.append(f"- {option['text']}")
    lines.append("")
NEEDS_REVIEW.write_text("\n".join(lines), encoding="utf-8")
print(json.dumps({"matched": len(answers), "missing": len(missing)}, ensure_ascii=False, indent=2))
