# ForgeDesk v0.1 Evidence-first Plan

> 新项目方向：用 ForgeDesk 作为长期产品名，用 PatchProof / Evidence Pack 作为 v0.1 的核心功能线。

## 1. 结论

ForgeDesk 不建议从“完整本地项目驾驶舱”开始做。

更稳的切入方式是：

> ForgeDesk v0.1 先做一个面向 AI 辅助开发的本地变更证据台。

也就是，当用户用 Codex、Claude Code、Cursor、OpenCode、ChatGPT 等工具改完一轮代码后，ForgeDesk 读取本地 git diff、记录用户意图、决策、风险和测试结果，然后生成一份可审查的 Markdown 证据包。

这个方向可以理解为：

```text
ForgeDesk = 长期产品名 / 本地 AI 开发工作台
PatchProof = v0.1 核心能力 / AI 代码变更证据包
```

不要一开始做大而全 dashboard。

先做一件很实用的事：

> AI 改完代码之后，人类怎么快速判断这次变更是否说得清、测得过、没越界。

## 2. 为什么不直接做完整 ForgeDesk

完整 ForgeDesk 的设想包括：

- Project Overview
- Task Board
- Decision Log
- Git Status
- Handoff Export
- Release Checklist
- Timeline
- Static Project Report
- Optional AI Assist

这些都合理，但第一版全做会有三个问题：

1. 容易变成本地 Notion / Linear / GitHub Projects。
2. 容易继承 BaseBrief 的问题：概念越来越多，入口越来越复杂。
3. 用户第一眼不一定知道“我为什么现在必须用它”。

Evidence-first 的优势是边界非常清楚：

```text
输入：git diff + 用户意图 + 决策 + 测试结果 + 风险说明
输出：PR_EVIDENCE.md / CHANGE_EVIDENCE.md / REVIEW_PROMPT.md
不做：写代码、审判代码、自动 merge、自动 release、agent runtime
```

这样 ForgeDesk 既能承接原规划里的 Git、决策、交接和发布检查经验，又不会一开始变成一个庞大的项目管理系统。

## 3. 一句话定位

英文：

> ForgeDesk is a local evidence desk for AI-assisted code changes.

中文：

> ForgeDesk 是一个面向 AI 辅助开发的本地变更证据台。

更口语一点：

> AI 可以帮你写代码，ForgeDesk 帮你把这次变更讲清楚、验清楚、交代清楚。

## 4. 目标用户

ForgeDesk v0.1 主要服务：

- 个人开发者。
- 开源项目作者。
- AI heavy user。
- 经常用 AI 改代码的人。
- 经常需要给 PR / release / 下一个 AI 窗口交代变更的人。
- 担心 AI 变更越界、漏测、说不清的人。

暂不服务：

- 大型团队协作。
- 企业审计。
- 权限管理。
- 云端同步。
- 完整项目管理。
- 自动化 agent 执行。
- AI PR reviewer 替代品。

## 5. 核心场景

### 5.1 开源 PR 前自查

用户用 AI 改完代码，准备开 PR。

ForgeDesk 生成：

- 这次改了什么。
- 为什么改。
- 涉及哪些文件。
- 跑了哪些测试。
- 哪些地方没验证。
- 维护者应该重点看哪里。

输出的 `PR_EVIDENCE.md` 可以直接放进 PR 描述，或者作为 PR 附件。

### 5.2 AI 变更后自我审查

用户不一定开 PR，只是自己用 AI 改项目。

ForgeDesk 帮用户在 commit 前看清：

- 是否有意外文件被改。
- 是否有测试证据。
- 是否有风险说明。
- 是否有未完成项。
- 是否需要人工 review。

### 5.3 新窗口接续

如果用户想把这轮变更交给另一个 AI 窗口审查或继续，ForgeDesk 可以导出 `REVIEW_PROMPT.md`。

它不是 BaseBrief 的完整 handoff，而是围绕“这次代码变更”的审查提示：

```text
请审查这次变更是否符合目标。
重点看这些文件。
这些测试已经跑过。
这些风险尚未验证。
不要扩展到当前变更之外。
```

### 5.4 Release 前证据整理

v0.1 不做完整 Release Mode，但证据包可以为后续 release checklist 服务。

后续 v0.2 可以扩展为：

- 多个 evidence session 汇总。
- release notes 草稿。
- release readiness check。

## 6. v0.1 产品闭环

v0.1 只跑通这一条闭环：

```text
初始化项目
  ↓
开始一次 change session
  ↓
记录变更意图
  ↓
读取 git status / diff summary
  ↓
记录关键决策和风险
  ↓
记录测试命令与结果
  ↓
生成证据包
```

用户最终得到：

```text
.forgedesk/evidence/<session-id>/
├── PR_EVIDENCE.md
├── CHANGE_SUMMARY.md
├── TEST_RESULTS.md
├── REVIEW_PROMPT.md
└── evidence.json
```

## 7. v0.1 命令设计

### 7.1 初始化

```bash
forgedesk init --repo .
```

创建：

```text
.forgedesk/
├── project.json
├── sessions/
├── evidence/
└── config.json
```

### 7.2 开始一次变更会话

```bash
forgedesk start --title "Fix OAuth redirect after callback"
```

创建 session：

```text
.forgedesk/sessions/<session-id>.json
```

### 7.3 记录变更意图

```bash
forgedesk intent "Fix OAuth callback redirect so users return to the original page after login."
```

### 7.4 记录决策

```bash
forgedesk decision "Keep redirect target in signed state param instead of localStorage."
```

### 7.5 记录风险

```bash
forgedesk risk "Redirect target validation may need extra coverage for malformed state values."
```

### 7.6 记录测试

推荐 v0.1 支持两种模式。

只记录命令：

```bash
forgedesk test --command "npm test"
```

运行并捕获结果：

```bash
forgedesk test -- npm test
```

v0.1 可以先做简单版本：运行命令，记录 exit code、stdout/stderr 摘要、开始和结束时间。

### 7.7 查看状态

```bash
forgedesk status
```

输出：

```text
Project: ForgeDesk
Session: Fix OAuth redirect after callback
Branch: main
Dirty: yes
Changed files: 5
Intent: present
Decisions: 1
Risks: 1
Tests: 1 passed
Evidence: not generated
```

### 7.8 生成证据包

```bash
forgedesk evidence
```

默认生成当前 session 的证据包。

也可支持：

```bash
forgedesk evidence --session <id>
forgedesk evidence --output-dir <dir>
```

## 8. v0.1 不做事项

必须明确不做：

- 不写代码。
- 不自动修复。
- 不自动 commit。
- 不自动 push。
- 不自动开 PR。
- 不自动发布 release。
- 不调用 AI provider。
- 不保存 API key。
- 不上传项目内容。
- 不做团队协作。
- 不做权限系统。
- 不做完整任务看板。
- 不做复杂 dashboard。
- 不做 timeline。
- 不做静态作品展示页。
- 不做 BaseBrief GUI。
- 不做通用项目管理工具。

## 9. 数据模型草案

### 9.1 Project

```ts
type Project = {
  schemaVersion: 'forgedesk-project-v1'
  name: string
  repoPath: string
  goal?: string
  defaultBranch?: string
  createdAt: string
  updatedAt: string
}
```

### 9.2 ChangeSession

```ts
type ChangeSession = {
  schemaVersion: 'forgedesk-session-v1'
  id: string
  title: string
  status: 'active' | 'needs-review' | 'done' | 'archived'
  intent?: string
  decisions: Decision[]
  risks: Risk[]
  tests: TestRun[]
  gitSnapshot?: GitSnapshot
  evidenceDir?: string
  createdAt: string
  updatedAt: string
}
```

### 9.3 Decision

```ts
type Decision = {
  id: string
  text: string
  createdAt: string
}
```

### 9.4 Risk

```ts
type Risk = {
  id: string
  text: string
  severity?: 'low' | 'medium' | 'high'
  createdAt: string
}
```

### 9.5 TestRun

```ts
type TestRun = {
  id: string
  command: string
  exitCode?: number
  status: 'recorded' | 'passed' | 'failed'
  startedAt?: string
  finishedAt?: string
  summary?: string
  logFile?: string
}
```

### 9.6 GitSnapshot

```ts
type GitSnapshot = {
  branch: string
  head: string
  isDirty: boolean
  modifiedFiles: string[]
  addedFiles: string[]
  deletedFiles: string[]
  untrackedFiles: string[]
  recentCommits: Array<{
    hash: string
    message: string
    date?: string
  }>
  capturedAt: string
}
```

## 10. 输出文档模板

### 10.1 PR_EVIDENCE.md

```markdown
# PR Evidence

## Change

<session title>

## Intent

<intent>

## Git Summary

- Branch:
- HEAD:
- Dirty:
- Changed files:

## Files Changed

<file list grouped by status>

## Decisions

<decision list>

## Risks / Review Focus

<risk list>

## Tests

<test command + status + summary>

## Not Verified

<explicit gaps>

## Suggested PR Description

<short copyable description>
```

### 10.2 CHANGE_SUMMARY.md

```markdown
# Change Summary

## What Changed
## Why It Changed
## Main Files
## Behavior Impact
## Compatibility Notes
```

### 10.3 TEST_RESULTS.md

```markdown
# Test Results

## Commands
## Results
## Failures
## Logs
## Manual Checks
```

### 10.4 REVIEW_PROMPT.md

```markdown
# Review Prompt

You are reviewing one AI-assisted code change.

## Goal

<intent>

## Review Scope

Only review the files and behavior related to this change.

## Evidence

<summary>

## Please Check

- Does the diff match the stated intent?
- Are there unexpected file changes?
- Are the tests relevant?
- Are unverified risks clearly listed?
- Do not expand into unrelated refactors.
```

## 11. 推荐技术栈

v0.1 先 CLI 优先，不急着做 Web UI。

建议：

| 层 | 技术 |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| CLI | Commander / CAC |
| Git | simple-git 或 child_process |
| Storage | 本地 JSON |
| Markdown | 模板字符串 / 简单 renderer |
| Tests | Vitest |
| Package | pnpm 或 npm |

不建议 v0.1 上来做 React dashboard。

如果一定要有可视化，先做：

```bash
forgedesk preview
```

生成或打开一个本地静态 HTML 报告即可。

## 12. 推荐目录结构

```text
ForgeDesk/
├── src/
│   ├── cli/
│   │   └── index.ts
│   ├── core/
│   │   ├── session.ts
│   │   ├── evidence.ts
│   │   └── status.ts
│   ├── git/
│   │   └── snapshot.ts
│   ├── storage/
│   │   └── json-store.ts
│   ├── templates/
│   │   ├── pr-evidence.ts
│   │   ├── change-summary.ts
│   │   ├── test-results.ts
│   │   └── review-prompt.ts
│   └── types.ts
├── tests/
├── examples/
│   └── demo-repo/
├── docs/
│   ├── quick-start.md
│   ├── boundaries.md
│   └── roadmap.md
├── package.json
├── tsconfig.json
├── README.md
└── ForgeDesk_v0.1_Evidence_First_Plan.md
```

## 13. v0.1 验收标准

### 产品验收

- [ ] 能在本地 repo 执行 `forgedesk init --repo .`
- [ ] 能创建 active change session
- [ ] 能记录 intent
- [ ] 能记录 decision
- [ ] 能记录 risk
- [ ] 能读取 git status / branch / changed files / HEAD
- [ ] 能记录或运行 test command
- [ ] 能生成 `PR_EVIDENCE.md`
- [ ] 能生成 `CHANGE_SUMMARY.md`
- [ ] 能生成 `TEST_RESULTS.md`
- [ ] 能生成 `REVIEW_PROMPT.md`
- [ ] README 能在 3 分钟内讲清楚怎么用
- [ ] 不需要 API key
- [ ] 不上传任何项目内容

### 自用验收

- [ ] 用 ForgeDesk 管理 ForgeDesk 自己的 v0.1 开发
- [ ] 至少记录 3 个 change sessions
- [ ] 至少生成 3 份 evidence pack
- [ ] 至少一次在 commit 前根据 evidence pack 发现问题或补充说明
- [ ] 至少一次把 `REVIEW_PROMPT.md` 交给新 AI 窗口做审查

### 对外验收

陌生用户只看 README 能回答：

1. ForgeDesk 是什么？
2. 它什么时候用？
3. 第一条命令是什么？
4. 它会不会替我写代码？
5. 它会不会上传项目？
6. 它和 AI code reviewer / project manager / BaseBrief 有什么区别？

## 14. 后续路线

### v0.1 Evidence Pack

跑通 CLI 和证据包。

### v0.2 Release Evidence

把多个 evidence sessions 汇总成 release readiness report：

- release checklist
- changed sessions summary
- unverified risks
- test matrix
- release notes draft

### v0.3 Lightweight UI

做本地 Web UI 或静态 HTML preview：

- 当前 session
- git changes
- evidence status
- tests
- export buttons

注意：UI 是展示 evidence，不是做完整任务管理。

### v0.4 Maintainer Mode

面向开源维护者：

- PR evidence requirements config
- required sections
- missing evidence warning
- GitHub Action 输出 comment

### v0.5 Optional AI Summary

可选 AI 摘要，但默认关闭：

- 根据 evidence 生成 PR description 草稿
- 根据 evidence 生成 release notes 草稿
- 不自动审查代码
- 不保存密钥到项目文件

## 15. 与 BaseBrief 的区别

BaseBrief：

```text
解决下一窗口如何接上项目上下文。
```

ForgeDesk v0.1：

```text
解决一次 AI 代码变更如何被解释、验证和审查。
```

BaseBrief 的核心输出是：

```text
NEXT_WINDOW_STARTER.md
```

ForgeDesk 的核心输出是：

```text
PR_EVIDENCE.md
CHANGE_EVIDENCE.md
REVIEW_PROMPT.md
```

BaseBrief 面向“会话接续”。

ForgeDesk 面向“变更负责”。

## 16. 与 AI code reviewer 的区别

ForgeDesk 不判断代码好坏，不替维护者 review。

它只回答：

```text
这次变更有没有把意图、影响、测试和风险讲清楚？
```

AI code reviewer 关注：

```text
代码有没有 bug？
```

ForgeDesk 关注：

```text
这次变更有没有证据？
```

这让它更适合开源社区的新痛点：AI 生成的 PR 越来越多，维护者不一定反感 AI，但反感“说不清、测不明、范围乱飞”的变更。

## 17. README 首屏草案

```markdown
# ForgeDesk

ForgeDesk is a local evidence desk for AI-assisted code changes.

AI coding tools can write code fast, but the resulting changes are often hard to review:
What was the intent? What files changed? What tests ran? What risks remain?

ForgeDesk helps you turn a local git diff into a reviewable evidence pack.

## Quick Start

```bash
forgedesk init --repo .
forgedesk start --title "Fix OAuth redirect"
forgedesk intent "Return users to the original page after login."
forgedesk test -- npm test
forgedesk evidence
```

## Output

```text
.forgedesk/evidence/<session-id>/
├── PR_EVIDENCE.md
├── CHANGE_SUMMARY.md
├── TEST_RESULTS.md
└── REVIEW_PROMPT.md
```

## What ForgeDesk Does

- Reads local git status and changed files
- Records change intent, decisions, risks, and tests
- Generates a Markdown evidence pack for PRs, reviews, releases, or AI handoff

## What ForgeDesk Does Not Do

- It does not write code
- It does not review code for you
- It does not call an AI provider by default
- It does not commit, push, open PRs, or publish releases
- It does not upload your project
```

## 18. 下一窗口开场提示词

```text
你现在接手一个新开源项目：ForgeDesk。

项目路径：
D:\ForgeDesk

当前已确认方向：
ForgeDesk 使用长期产品名，但 v0.1 不做完整项目驾驶舱。
v0.1 采用 Evidence-first 方向：面向 AI 辅助开发的本地变更证据台。

一句话定位：
ForgeDesk is a local evidence desk for AI-assisted code changes.

核心闭环：
init -> start change session -> record intent/decision/risk/test -> read git status/diff summary -> generate evidence pack

核心输出：
.forgedesk/evidence/<session-id>/
- PR_EVIDENCE.md
- CHANGE_SUMMARY.md
- TEST_RESULTS.md
- REVIEW_PROMPT.md
- evidence.json

严格边界：
不写代码，不自动修复，不自动 commit/push/PR/release，不调用 provider，不上传项目内容，不做 Agent runtime，不做完整任务看板，不做 BaseBrief GUI。

当前任务：
请先阅读 D:\ForgeDesk\ForgeDesk_v0.1_Evidence_First_Plan.md。
然后制定 v0.1 的最小实现计划，优先 CLI，不急着做 Web UI。
先输出：
- 推荐 package/scripts
- 第一批文件结构
- 数据模型
- CLI 命令实现顺序
- 测试计划
- 明确不做事项

不要直接扩大成完整项目驾驶舱。
```
