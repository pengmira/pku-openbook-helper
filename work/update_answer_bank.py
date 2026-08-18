import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS = ROOT / "work" / "questions.json"
ANSWERS = ROOT / "work" / "answers.json"
BANK = ROOT / "work" / "answer_bank.json"
REVIEW = ROOT / "work" / "answer_bank_review.md"


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


def answer_label(answer):
    letters = "ABCD"
    if "optionIndexes" in answer:
        return "".join(letters[i] for i in answer["optionIndexes"])
    return " / ".join(answer.get("blanks", []))


def main():
    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))
    answers = {a["questionNo"]: a for a in json.loads(ANSWERS.read_text(encoding="utf-8"))}
    bank = json.loads(BANK.read_text(encoding="utf-8")) if BANK.exists() else {}

    added = 0
    changed = []
    for q in questions:
        no = q["questionNo"]
        if no not in answers:
            continue
        qtext = clean_question_text(q)
        key = normalize(qtext)
        value = {
            "answer": answer_label(answers[no]),
            "kind": q["kind"],
            "question": qtext,
            "source_question_no": no,
            "confidence": "manual-current-run",
        }
        old = bank.get(key)
        if old and old.get("answer") != value["answer"]:
            changed.append((key, old, value))
            old.setdefault("conflicts", []).append(value)
        elif not old:
            bank[key] = value
            added += 1

    BANK.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [f"# Answer Bank Review", "", f"- total: {len(bank)}", f"- added: {added}", f"- conflicts: {len(changed)}", ""]
    for _, old, value in changed:
        lines.append("## Conflict")
        lines.append(f"Question: {value['question']}")
        lines.append(f"Old: {old.get('answer')}")
        lines.append(f"New: {value.get('answer')}")
        lines.append("")
    REVIEW.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"total": len(bank), "added": added, "conflicts": len(changed)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
