# PKU Openbook Helper

用于允许开卷的模拟测试/练习：采集网页题目、匹配本地答案库、辅助填入页面。

重要说明：

- 只用于允许开卷的模拟测试或练习。
- 脚本不会点击“提交考试”。
- 不要分享 `work/pw-profile/`、cookie、账号密码或个人题目缓存。公开资料 Word/PDF 可按需要上传。
- 答案库可能有误，使用前请自行核对，尤其是多选题。

## 环境要求

- Windows PowerShell
- Node.js
- Python 3

## 安装

```powershell
.\setup.ps1
```

## 使用流程

1. 将 OCR 后的 Word 文件放到项目根目录，例如 `2026eg.docx`。
   我已经把OCR提取后的放在这里了：👇
   「2026eg」，链接：https://v.v8l.cn/s/dJKCmJH
   「2026g」，链接：https://v.v8l.cn/s/oY8Rzb8
   注：2026eg是研究生版本，2026g是本科生版，笔者是研究生因此answer库里面的答案也都是研究生的，大家请自行辨别。
3. 提取 Word 文本：

```powershell
python work\docx_search.py extract 2026eg.docx -o work\docx_text.txt
```

3. 扫描当前随机题：

```powershell
.\run_collect.ps1
```

浏览器打开后，登录并进入题目页，回到终端按 Enter。脚本会逐题采集到 `work/questions.json`。

4. 匹配答案库：

```powershell
.\run_apply_bank.ps1
```

命中的题会写入 `work/answers.json`；未命中的题会写入 `work/needs_review.md`。

5. 人工补充未命中题。

多选题答案必须写完整，例如：

```json
{
  "index": 40,
  "questionNo": 41,
  "optionIndexes": [0, 2, 3]
}
```

填空题示例：

```json
{
  "index": 88,
  "questionNo": 89,
  "blanks": ["180", "保留学籍"]
}
```

6. 填入页面：

```powershell
.\run_fill.ps1
```

浏览器打开后确认页面正确，回到终端按 Enter。脚本会逐题填入，但不会提交。

7. 更新答案库：

```powershell
.\run_update_bank.ps1
```

如果同一道题出现不同答案，会写入 `work/answer_bank_review.md`，不要静默覆盖。

## 常见问题

### 页面提示只能打开一个窗口

先关闭旧浏览器窗口，或删除 `work/pw-profile/` 后重试。

### 多选题少选了

检查 `work/answers.json` 中该题的 `optionIndexes` 是否包含所有选项。`A/B/C/D` 分别对应 `[0,1,2,3]`。

### 采集不到 90 题

确认页面中“下一题”按钮可点击，并且浏览器没有被其他窗口占用会话。

### Playwright 浏览器下载失败

脚本会优先使用系统 Edge/Chrome。如果本机没有浏览器，请安装 Microsoft Edge 或 Google Chrome。

### 建议大家使用codex直接跑这个项目 笔者也是基于codex开发的
