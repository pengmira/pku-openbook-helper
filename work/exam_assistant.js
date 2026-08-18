const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const PROFILE = path.join(ROOT, "work", "pw-profile");
const QUESTIONS = path.join(ROOT, "work", "questions.json");
const ANSWERS = path.join(ROOT, "work", "answers.json");
const URL = "https://exam.pku.edu.cn/examinee/exam/54";

function findSystemBrowser() {
  const candidates = [
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find((file) => fs.existsSync(file));
}

async function getQuestionBlocks(page) {
  return await page.evaluate(() => {
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
    };

    const textOf = (el) => (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
    const controls = [...document.querySelectorAll("input[type=radio], input[type=checkbox], input:not([type]), input[type=text], textarea")]
      .filter(visible);
    const containers = [];

    for (const control of controls) {
      let node = control;
      let best = control.parentElement;
      for (let i = 0; i < 8 && node?.parentElement; i += 1) {
        node = node.parentElement;
        const sameControls = node.querySelectorAll("input[type=radio], input[type=checkbox], input:not([type]), input[type=text], textarea").length;
        const text = textOf(node);
        if (sameControls >= 1 && text.length >= 8 && text.length <= 3000) best = node;
        if (sameControls > 8 || text.length > 3000) break;
      }
      if (best && !containers.some((item) => item === best || item.contains(best))) {
        containers.push(best);
      }
    }

    return containers.map((el, index) => {
      const inputs = [...el.querySelectorAll("input, textarea")].filter(visible);
      const options = inputs
        .filter((input) => ["radio", "checkbox"].includes(input.type))
        .map((input, optionIndex) => {
          const label = input.closest("label") || document.querySelector(`label[for="${input.id}"]`) || input.parentElement;
          return {
            optionIndex,
            type: input.type,
            name: input.name || "",
            value: input.value || "",
            text: textOf(label),
            checked: input.checked,
          };
        });
      const blanks = inputs
        .filter((input) => input.tagName === "TEXTAREA" || !["radio", "checkbox", "hidden", "button", "submit"].includes(input.type))
        .map((input, blankIndex) => ({
          blankIndex,
          tag: input.tagName.toLowerCase(),
          type: input.type || "",
          name: input.name || "",
          value: input.value || "",
        }));

      return {
        index,
        text: textOf(el),
        kind: options.some((o) => o.type === "checkbox") ? "multiple" : options.length ? "single" : "blank",
        options,
        blanks,
      };
    });
  });
}

async function getCurrentQuestion(page) {
  const blocks = await getQuestionBlocks(page);
  const block = blocks.find((item) => item.options.length || item.blanks.length) || blocks[0];
  if (!block) return null;

  const pageText = await page.locator("body").innerText();
  const numberMatch = pageText.match(/第\s*(\d+)\s*题/);
  const progressMatch = pageText.match(/(\d+)\s*\/\s*(\d+)/);
  return {
    ...block,
    questionNo: numberMatch ? Number(numberMatch[1]) : null,
    progress: progressMatch ? { current: Number(progressMatch[1]), total: Number(progressMatch[2]) } : null,
  };
}

async function clickNext(page) {
  const next = page.getByText("下一题", { exact: true }).last();
  if ((await next.count()) === 0) return false;
  await next.click();
  await page.waitForTimeout(500);
  return true;
}

async function openPage() {
  const executablePath = findSystemBrowser();
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    executablePath,
    viewport: { width: 1360, height: 900 },
  });
  const page = context.pages()[0] || await context.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function extract() {
  const { context, page } = await openPage();
  console.log("浏览器已打开。请确认已登录并停在要继续作答的页面，然后回到终端按 Enter。");
  await new Promise((resolve) => process.stdin.once("data", resolve));
  const questions = await getQuestionBlocks(page);
  fs.writeFileSync(QUESTIONS, JSON.stringify(questions, null, 2), "utf8");
  console.log(`已导出 ${questions.length} 个题块到 ${QUESTIONS}`);
  await context.close();
}

async function collect() {
  const { context, page } = await openPage();
  console.log("浏览器已打开。请确认已登录并位于试题页面，然后回到终端按 Enter 开始逐题采集。");
  await new Promise((resolve) => process.stdin.once("data", resolve));

  const byNo = new Map();
  let previousKey = "";
  for (let step = 0; step < 100; step += 1) {
    const question = await getCurrentQuestion(page);
    if (!question) break;
    const key = String(question.questionNo || question.progress?.current || step + 1);
    byNo.set(key, question);
    console.log(`采集第 ${key} 题：${question.kind}，选项 ${question.options.length}，填空 ${question.blanks.length}`);

    const currentKey = `${key}:${question.text.slice(0, 80)}`;
    const total = question.progress?.total || 90;
    if ((question.progress?.current && question.progress.current >= total) || currentKey === previousKey) break;
    previousKey = currentKey;

    const moved = await clickNext(page);
    if (!moved) break;
  }

  const questions = [...byNo.values()].sort((a, b) => {
    const left = a.questionNo || a.progress?.current || a.index;
    const right = b.questionNo || b.progress?.current || b.index;
    return left - right;
  });
  fs.writeFileSync(QUESTIONS, JSON.stringify(questions, null, 2), "utf8");
  console.log(`已导出 ${questions.length} 题到 ${QUESTIONS}`);
  await context.close();
}

async function fill() {
  const answers = JSON.parse(fs.readFileSync(ANSWERS, "utf8"));
  const byNo = new Map(answers.map((answer) => [Number(answer.questionNo || answer.index + 1), answer]));
  const { context, page } = await openPage();
  console.log("浏览器已打开。请确认页面正确，然后回到终端按 Enter 开始逐题填入；脚本不会提交。");
  await new Promise((resolve) => process.stdin.once("data", resolve));
  await fillCurrentPage(page, byNo);
  console.log("已逐题填入 answers.json 中的答案。请你在页面检查，脚本不会提交。");
  await new Promise((resolve) => process.stdin.once("data", resolve));
  await context.close();
}

async function fillCurrentPage(page, byNo) {
  for (let step = 0; step < 100; step += 1) {
    const question = await getCurrentQuestion(page);
    if (!question) break;
    const no = Number(question.questionNo || question.progress?.current || step + 1);
    const answer = byNo.get(no);
    if (answer) {
      await page.evaluate((answer) => {
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
    };
    const controls = [...document.querySelectorAll("input[type=radio], input[type=checkbox], input:not([type]), input[type=text], textarea")]
      .filter(visible);
    const containers = [];
    const textOf = (el) => (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();

    for (const control of controls) {
      let node = control;
      let best = control.parentElement;
      for (let i = 0; i < 8 && node?.parentElement; i += 1) {
        node = node.parentElement;
        const sameControls = node.querySelectorAll("input[type=radio], input[type=checkbox], input:not([type]), input[type=text], textarea").length;
        const text = textOf(node);
        if (sameControls >= 1 && text.length >= 8 && text.length <= 3000) best = node;
        if (sameControls > 8 || text.length > 3000) break;
      }
      if (best && !containers.some((item) => item === best || item.contains(best))) containers.push(best);
    }

      const block = containers.find((item) => item.querySelector("input, textarea")) || containers[0];
      if (!block) return;
      const inputs = [...block.querySelectorAll("input, textarea")].filter(visible);
      const choiceInputs = inputs.filter((input) => ["radio", "checkbox"].includes(input.type));
      const textInputs = inputs.filter((input) => input.tagName === "TEXTAREA" || !["radio", "checkbox", "hidden", "button", "submit"].includes(input.type));

      if (Array.isArray(answer.optionIndexes)) {
        for (const optionIndex of answer.optionIndexes) {
          const input = choiceInputs[optionIndex];
          if (input && !input.checked) input.click();
        }
      }
      if (Array.isArray(answer.blanks)) {
        answer.blanks.forEach((value, i) => {
          const input = textInputs[i];
          if (!input) return;
          input.value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }
      }, answer);
      console.log(`已填第 ${no} 题`);
    } else {
      console.log(`跳过第 ${no} 题（无待填答案或已答题）`);
    }

    const total = question.progress?.total || 90;
    if (question.progress?.current && question.progress.current >= total) break;
    const moved = await clickNext(page);
    if (!moved) break;
  }
}

async function extractFill() {
  const answers = JSON.parse(fs.readFileSync(ANSWERS, "utf8"));
  const byNo = new Map(answers.map((answer) => [Number(answer.questionNo || answer.index + 1), answer]));
  const { context, page } = await openPage();
  console.log("浏览器已打开。这个入口按 extract 的方式启动。请确认页面可用，然后回到终端按 Enter 开始逐题填入；脚本不会提交。");
  await new Promise((resolve) => process.stdin.once("data", resolve));
  await fillCurrentPage(page, byNo);
  console.log("已逐题填入 answers.json 中的答案。请你在页面检查，脚本不会提交。");
  await new Promise((resolve) => process.stdin.once("data", resolve));
  await context.close();
}

const command = process.argv[2];
if (command === "extract") extract();
else if (command === "collect") collect();
else if (command === "fill") fill();
else if (command === "extractfill") extractFill();
else {
  console.log("用法：node work/exam_assistant.js extract|collect|fill|extractfill");
  process.exit(1);
}
