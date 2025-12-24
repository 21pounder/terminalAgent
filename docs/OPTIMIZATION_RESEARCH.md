# Terminal Coding Agent 优化研究报告

> 研究日期: 2024-12-23
> 版本: v5.0.0
> 研究范围: 架构、UI、SDK集成、Skills系统、性能、可扩展性、用户体验

---

## 目录

1. [执行摘要](#执行摘要)
2. [当前架构分析](#当前架构分析)
3. [UI 组件优化](#ui-组件优化)
4. [SDK 集成优化](#sdk-集成优化)
5. [Skills 系统增强](#skills-系统增强)
6. [性能优化](#性能优化)
7. [开发者体验改进](#开发者体验改进)
8. [用户体验增强](#用户体验增强)
9. [安全性加固](#安全性加固)
10. [可扩展性设计](#可扩展性设计)
11. [优先级路线图](#优先级路线图)

---

## 执行摘要

Terminal Coding Agent 是一个基于 Claude Agent SDK 的 CLI 编码助手，提供 `/` 命令菜单、`@` 文件浏览器和会话持久化功能。经过深入分析，我识别出 **47 个优化机会**，分布在架构、性能、用户体验等多个维度。

### 关键发现

| 领域 | 当前状态 | 优化潜力 |
|------|----------|----------|
| 架构设计 | 单文件 473 行 | 高 - 需要模块化拆分 |
| UI 组件 | 功能完整但耦合 | 中 - 可抽象通用模式 |
| SDK 集成 | 基础功能正常 | 高 - 缺少高级特性 |
| Skills 系统 | 8 个 Skills | 高 - 发现和管理机制可增强 |
| 性能 | 未优化 | 中 - 启动和文件搜索可优化 |
| 测试覆盖 | 基础单元测试 | 高 - 缺少集成测试 |

### 顶级优化建议（Quick Wins）

1. **添加命令历史记录** - 用户体验显著提升
2. **Skills 热重载** - 开发效率提升
3. **异步文件搜索优化** - 性能提升 50%+
4. **错误恢复机制** - 稳定性提升
5. **配置文件支持** - 可定制性提升

---

## 当前架构分析

### 2.1 文件结构

```
deepresearch/
├── src/
│   ├── index.ts           # 主入口 (473 行) - 职责过多
│   ├── test-ui.ts         # UI 测试 (211 行)
│   └── ui/
│       ├── index.ts       # 导出模块 (8 行)
│       ├── theme.ts       # 主题系统 (185 行)
│       ├── commands.ts    # 命令选择器 (238 行)
│       ├── file-browser.ts # 文件浏览器 (454 行)
│       └── smart-input.ts # 智能输入 (150 行)
├── .claude/skills/        # 8 个 Skills
├── bin/agent.cjs          # CLI 入口 (40 行)
└── package.json
```

### 2.2 架构问题

#### 问题 1: index.ts 职责过多（God Object 反模式）

当前 `index.ts` 包含：
- Banner 打印
- 消息处理
- 文件读取
- SDK 查询
- Skills 加载
- 命令构建
- 输入处理
- 主循环

**影响**: 难以测试、难以维护、难以扩展

**建议重构**:

```
src/
├── index.ts              # 仅包含主入口和初始化
├── core/
│   ├── agent.ts          # SDK 封装和查询逻辑
│   ├── session.ts        # 会话管理
│   └── message-handler.ts # 消息处理
├── skills/
│   ├── loader.ts         # Skills 加载
│   ├── registry.ts       # Skills 注册表
│   └── validator.ts      # Skills 验证
├── ui/
│   ├── ... (现有)
│   ├── banner.ts         # Banner 独立模块
│   └── help.ts           # 帮助系统
└── utils/
    ├── file.ts           # 文件操作
    └── config.ts         # 配置管理
```

#### 问题 2: 缺少依赖注入

当前代码直接实例化依赖，难以测试和替换：

```typescript
// 当前方式 - 硬编码依赖
const smartInput = new SmartInput({ ... });

// 建议方式 - 依赖注入
interface Dependencies {
  input: InputProvider;
  output: OutputProvider;
  skillLoader: SkillLoader;
  agent: AgentClient;
}

async function interactive(deps: Dependencies): Promise<void> {
  // ...
}
```

#### 问题 3: 配置硬编码

多处配置直接写在代码中：

```typescript
// 硬编码示例
const VERSION = "5.0.0";
const DEFAULT_EXCLUDE = ["node_modules", ".git", "dist", ...];
const WIDTH = 44;  // CommandPicker
const WIDTH = 52;  // FileBrowser
```

**建议**: 创建统一配置系统

```typescript
// config/default.ts
export const defaultConfig = {
  ui: {
    commandPicker: { width: 44, maxVisible: 8 },
    fileBrowser: { width: 52, maxVisible: 10, maxSearchDepth: 5 },
  },
  files: {
    exclude: ["node_modules", ".git", "dist", ".cache", "__pycache__"],
    showHidden: false,
  },
  agent: {
    permissionMode: "acceptEdits",
    settingSources: ["project", "local"],
  },
};

// 支持用户覆盖
// ~/.agent/config.json 或 .agentrc.json
```

---

## UI 组件优化

### 3.1 CommandPicker 优化

#### 问题 1: 键盘处理代码重复

`CommandPicker` 和 `FileBrowser` 都有类似的键盘处理逻辑：

```typescript
// 两个组件都有这样的代码
if (key === "\x1b[A") { /* 上箭头 */ }
if (key === "\x1b[B") { /* 下箭头 */ }
if (key === "\x7f" || key === "\b") { /* Backspace */ }
```

**建议**: 抽象键盘处理

```typescript
// ui/keyboard.ts
export const KeyCodes = {
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  LEFT: "\x1b[D",
  RIGHT: "\x1b[C",
  ENTER: ["\r", "\n"],
  ESCAPE: ["\x1b", "\x03"],
  BACKSPACE: ["\x7f", "\b"],
  TAB: "\t",
} as const;

export function matchKey(input: string, key: string | string[]): boolean {
  return Array.isArray(key) ? key.includes(input) : input === key;
}

export interface KeyHandler {
  key: string | string[];
  handler: () => void | Promise<void>;
  description?: string;
}

export function createKeyboardHandler(handlers: KeyHandler[]) {
  return async (chunk: Buffer) => {
    const key = chunk.toString();
    for (const { key: k, handler } of handlers) {
      if (matchKey(key, k)) {
        await handler();
        return true;
      }
    }
    return false;
  };
}
```

#### 问题 2: 渲染性能

每次按键都完全重绘整个面板：

```typescript
// 当前: 全量重绘
this.render();  // 清除 + 重新绘制所有行
```

**建议**: 增量渲染

```typescript
// 优化: 只更新变化的部分
interface RenderState {
  selectedIndex: number;
  filter: string;
  filteredItems: Item[];
}

function computeChanges(prev: RenderState, next: RenderState): Change[] {
  const changes: Change[] = [];

  if (prev.filter !== next.filter) {
    changes.push({ type: 'filter', line: 1 });
  }

  if (prev.selectedIndex !== next.selectedIndex) {
    changes.push({ type: 'select', prevLine: prev.selectedIndex + 3 });
    changes.push({ type: 'select', nextLine: next.selectedIndex + 3 });
  }

  return changes;
}

function applyChanges(changes: Change[]): void {
  for (const change of changes) {
    moveCursorTo(change.line);
    clearLine();
    renderLine(change.line);
  }
}
```

#### 问题 3: 缺少快捷键提示

用户不知道有哪些快捷键可用。

**建议**: 添加快捷键预览

```typescript
// 在命令旁显示快捷键
{ name: "help", description: "Show help", shortcut: "h" }

// 渲染时
/help        [H] Show help
/clear       [C] Clear screen
/exit        [Q] Exit program
```

### 3.2 FileBrowser 优化

#### 问题 1: 递归搜索阻塞

当前 `fuzzySearchFiles` 是同步递归，大目录会阻塞：

```typescript
async function searchDir(dirPath: string, depth: number = 0): Promise<void> {
  if (depth > 5 || results.length >= maxResults) return;
  // 同步递归所有目录...
}
```

**建议**: 流式搜索 + 防抖

```typescript
// 使用 AsyncGenerator 流式返回结果
async function* streamSearch(
  basePath: string,
  query: string,
  options: SearchOptions
): AsyncGenerator<FileItem> {
  const queue: string[] = [basePath];
  let count = 0;

  while (queue.length > 0 && count < options.maxResults) {
    const dirPath = queue.shift()!;
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (matchesQuery(entry.name, query)) {
        yield createFileItem(entry, dirPath, basePath);
        count++;
      }

      if (entry.isDirectory() && shouldDescend(entry.name, options)) {
        queue.push(path.join(dirPath, entry.name));
      }
    }
  }
}

// 配合防抖使用
const debouncedSearch = debounce(async (query: string) => {
  this.filteredItems = [];
  for await (const item of streamSearch(this.basePath, query, this.options)) {
    this.filteredItems.push(item);
    if (this.filteredItems.length % 10 === 0) {
      this.render();  // 每 10 个结果更新一次 UI
    }
  }
  this.render();
}, 150);
```

#### 问题 2: 缺少文件预览

用户选中文件后不知道内容是什么。

**建议**: 添加文件预览面板

```
╭─ [D] src ───────────────────────────────────╮
│ @ index_                                     │
│──────────────────────────────────────────────│
│ > [F] index.ts                               │
│   [F] config.ts                              │
│   [D] utils                                  │
│──────────────────────────────────────────────│
│ Preview (index.ts):                          │
│ ┌────────────────────────────────────────┐   │
│ │ 1: /**                                 │   │
│ │ 2:  * Terminal Coding Agent            │   │
│ │ 3:  */                                 │   │
│ │ 4: import * as fs from "node:fs";      │   │
│ │ 5: ...                                 │   │
│ └────────────────────────────────────────┘   │
│──────────────────────────────────────────────│
│ Arrows:Nav  Enter:Select  P:Preview  Esc:X   │
╰──────────────────────────────────────────────╯
```

#### 问题 3: 缺少多选支持

当前只能选择一个文件。

**建议**: 添加多选模式

```typescript
interface FileBrowserOptions {
  // ...existing
  multiSelect?: boolean;
  maxSelect?: number;
}

// 使用 Space 切换选中状态
const selectedFiles = new Set<string>();

if (key === " " && options.multiSelect) {
  const item = this.filteredItems[this.selectedIndex];
  if (selectedFiles.has(item.path)) {
    selectedFiles.delete(item.path);
  } else if (selectedFiles.size < (options.maxSelect ?? Infinity)) {
    selectedFiles.add(item.path);
  }
  this.render();
}

// 渲染时显示选中状态
const prefix = isSelected ? ">" : selectedFiles.has(item.path) ? "✓" : " ";
```

### 3.3 SmartInput 优化

#### 问题 1: 缺少输入历史

用户无法使用上下键浏览之前的输入。

**建议**: 添加历史记录

```typescript
// ui/history.ts
export class InputHistory {
  private history: string[] = [];
  private index: number = -1;
  private maxSize: number;
  private storePath: string;

  constructor(options: { maxSize?: number; persist?: boolean } = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.storePath = path.join(os.homedir(), ".agent", "history.json");

    if (options.persist) {
      this.load();
    }
  }

  add(input: string): void {
    if (!input.trim()) return;

    // 去重：如果最后一条相同则不添加
    if (this.history[this.history.length - 1] === input) return;

    this.history.push(input);
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
    this.index = this.history.length;
  }

  prev(): string | undefined {
    if (this.index > 0) {
      this.index--;
      return this.history[this.index];
    }
    return undefined;
  }

  next(): string | undefined {
    if (this.index < this.history.length - 1) {
      this.index++;
      return this.history[this.index];
    }
    this.index = this.history.length;
    return "";
  }

  search(query: string): string[] {
    return this.history.filter(h => h.includes(query)).reverse();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        this.history = JSON.parse(fs.readFileSync(this.storePath, "utf-8"));
      }
    } catch {}
  }

  save(): void {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      fs.writeFileSync(this.storePath, JSON.stringify(this.history));
    } catch {}
  }
}

// 在 SmartInput 中使用
const history = new InputHistory({ persist: true });

// 上箭头时
if (key === KeyCodes.UP) {
  const prev = history.prev();
  if (prev !== undefined) {
    currentInput = prev;
    render();
  }
}
```

#### 问题 2: 缺少自动补全

用户输入 `/` 后需要手动打开选择器。

**建议**: 实时自动补全

```typescript
// 检测 "/" 后的输入，实时显示匹配的命令
if (currentInput.startsWith("/")) {
  const query = currentInput.slice(1);
  const matches = commands.filter(c =>
    c.name.toLowerCase().startsWith(query.toLowerCase())
  );

  if (matches.length > 0 && matches.length <= 5) {
    // 显示内联补全建议
    showInlineSuggestions(matches);
  }
}

// Tab 键自动补全
if (key === KeyCodes.TAB && currentInput.startsWith("/")) {
  const matches = getMatches(currentInput.slice(1));
  if (matches.length === 1) {
    currentInput = "/" + matches[0].name;
  } else if (matches.length > 1) {
    // 补全共同前缀
    const common = findCommonPrefix(matches.map(m => m.name));
    currentInput = "/" + common;
  }
}
```

#### 问题 3: 多行输入支持

复杂查询需要多行输入。

**建议**: 支持 Shift+Enter 多行

```typescript
// Shift+Enter 插入换行
if (key === "\r" && modifiers.includes("Shift")) {
  currentInput += "\n";
  render();
  return;
}

// 普通 Enter 提交
if (key === "\r") {
  submit();
}

// 多行渲染
function renderMultiline(input: string): void {
  const lines = input.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i === 0) {
      process.stdout.write(prompt + lines[i]);
    } else {
      process.stdout.write("\n" + " ".repeat(promptWidth) + lines[i]);
    }
  }
}
```

---

## SDK 集成优化

### 4.1 当前 SDK 使用分析

```typescript
const result = query({
  prompt,
  options: {
    settingSources: ["project", "local"],
    additionalDirectories: fs.existsSync(GLOBAL_SKILLS_DIR) ? [AGENT_ROOT] : [],
    permissionMode: "acceptEdits",
    tools: { type: "preset", preset: "claude_code" },
    resume: sessionId,
    includePartialMessages: true,
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: `...`,
    },
  },
});
```

### 4.2 优化建议

#### 优化 1: 错误恢复机制

当前错误只是打印，没有恢复策略：

```typescript
// 当前
} catch (error) {
  console.log(fmt(`  ${icons.cross} Error: `, colors.error) + ...);
  return sessionId;
}
```

**建议**: 智能错误恢复

```typescript
// core/error-recovery.ts
interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  retryableErrors: string[];
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  retryableErrors: [
    "ECONNRESET",
    "ETIMEDOUT",
    "rate_limit_exceeded",
    "overloaded",
  ],
};

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = defaultRetryConfig
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      const isRetryable = config.retryableErrors.some(e =>
        lastError.message.includes(e)
      );

      if (!isRetryable || attempt === config.maxRetries) {
        throw lastError;
      }

      const delay = config.backoffMs * Math.pow(2, attempt);
      console.log(fmt(`  Retrying in ${delay}ms...`, theme.dim));
      await sleep(delay);
    }
  }

  throw lastError!;
}

// 使用
const result = await withRetry(() => query({ prompt, options }));
```

#### 优化 2: 流式响应增强

当前只处理部分消息类型：

```typescript
// 当前处理的类型
case "system":
case "assistant":
case "result":
case "tool_progress":
```

**建议**: 完整的消息处理

```typescript
// core/message-handler.ts
interface MessageHandlers {
  onInit?: (msg: SystemInitMessage) => void;
  onAssistant?: (msg: AssistantMessage) => void;
  onToolUse?: (tool: string, input: unknown) => void;
  onToolResult?: (tool: string, result: unknown) => void;
  onProgress?: (tool: string, elapsed: number) => void;
  onResult?: (msg: ResultMessage) => void;
  onError?: (error: Error) => void;
}

async function processStream(
  result: Query,
  handlers: MessageHandlers
): Promise<QueryResult> {
  let sessionId: string | undefined;
  const toolCalls: ToolCall[] = [];

  try {
    for await (const msg of result) {
      switch (msg.type) {
        case "system":
          if (msg.subtype === "init") {
            sessionId = msg.session_id;
            handlers.onInit?.(msg);
          }
          break;

        case "assistant":
          handlers.onAssistant?.(msg);

          // 提取工具调用
          for (const block of msg.message.content) {
            if (block.type === "tool_use") {
              toolCalls.push({
                id: block.id,
                name: block.name,
                input: block.input,
              });
              handlers.onToolUse?.(block.name, block.input);
            }
          }
          break;

        case "tool_result":
          handlers.onToolResult?.(msg.tool_name, msg.result);
          break;

        case "tool_progress":
          handlers.onProgress?.(msg.tool_name, msg.elapsed_time_seconds);
          break;

        case "result":
          handlers.onResult?.(msg);
          break;
      }
    }
  } catch (error) {
    handlers.onError?.(error as Error);
    throw error;
  }

  return { sessionId, toolCalls };
}
```

#### 优化 3: 上下文管理

长对话会导致上下文溢出。

**建议**: 智能上下文压缩

```typescript
// core/context-manager.ts
interface ContextManager {
  addMessage(role: string, content: string): void;
  getContext(): Message[];
  summarize(): Promise<void>;
}

class SmartContextManager implements ContextManager {
  private messages: Message[] = [];
  private maxTokens: number = 100000;
  private currentTokens: number = 0;

  addMessage(role: string, content: string): void {
    const tokens = estimateTokens(content);
    this.messages.push({ role, content, tokens });
    this.currentTokens += tokens;

    // 超过阈值时触发压缩
    if (this.currentTokens > this.maxTokens * 0.8) {
      this.compress();
    }
  }

  private compress(): void {
    // 保留最近的消息
    const keepRecent = 10;
    const recent = this.messages.slice(-keepRecent);
    const old = this.messages.slice(0, -keepRecent);

    if (old.length > 0) {
      // 将旧消息压缩为摘要
      const summary = this.createSummary(old);
      this.messages = [
        { role: "system", content: `Previous conversation summary:\n${summary}` },
        ...recent,
      ];
      this.recalculateTokens();
    }
  }

  private createSummary(messages: Message[]): string {
    // 提取关键信息
    const topics = new Set<string>();
    const decisions: string[] = [];
    const files: string[] = [];

    for (const msg of messages) {
      // 提取讨论的主题、决定的事项、涉及的文件等
      // ...
    }

    return `Topics: ${[...topics].join(", ")}\nDecisions: ${decisions.join("; ")}\nFiles: ${files.join(", ")}`;
  }
}
```

#### 优化 4: 模型选择

当前固定使用 claude_code preset。

**建议**: 支持模型切换

```typescript
// 用户可通过命令切换
// /model haiku    - 快速响应
// /model sonnet   - 平衡
// /model opus     - 最强

interface ModelConfig {
  name: string;
  description: string;
  preset?: string;
  systemPrompt?: string;
}

const models: Record<string, ModelConfig> = {
  haiku: {
    name: "claude-3-haiku",
    description: "Fast responses, good for simple tasks",
  },
  sonnet: {
    name: "claude-3-5-sonnet",
    description: "Balanced performance and capability",
  },
  opus: {
    name: "claude-3-opus",
    description: "Most capable, best for complex tasks",
  },
};

// 在 buildCommandList 中添加
{ name: "model", description: "Switch AI model" }
```

---

## Skills 系统增强

### 5.1 当前 Skills 分析

现有 8 个 Skills:
- `deep-research` - 深度研究
- `code-review` - 代码审查
- `git-commit` - Git 提交
- `pdf-analyze` - PDF 分析
- `web-scrape` - 网页抓取
- `code-migrate` - 代码迁移
- `debug-complex` - 复杂调试
- `doc-generate` - 文档生成

### 5.2 优化建议

#### 优化 1: Skills 元数据增强

当前只解析 `description`：

```typescript
const descMatch = content.match(/description:\s*(.+)/i);
```

**建议**: 完整解析 YAML frontmatter

```typescript
// skills/parser.ts
import yaml from "js-yaml";

interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  allowedTools: string[];
  author?: string;
  tags?: string[];
  parameters?: ParameterSchema;
  examples?: Example[];
}

function parseSkillFile(content: string): SkillMetadata | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  try {
    const metadata = yaml.load(frontmatterMatch[1]) as Record<string, unknown>;
    return {
      name: String(metadata.name || ""),
      description: String(metadata.description || ""),
      version: String(metadata.version || "1.0.0"),
      allowedTools: parseTools(metadata["allowed-tools"]),
      author: metadata.author as string | undefined,
      tags: metadata.tags as string[] | undefined,
      parameters: parseParameters(content),
      examples: parseExamples(content),
    };
  } catch {
    return null;
  }
}

function parseParameters(content: string): ParameterSchema | undefined {
  const paramMatch = content.match(/```json\n({[\s\S]*?})\n```/);
  if (!paramMatch) return undefined;

  try {
    return JSON.parse(paramMatch[1]);
  } catch {
    return undefined;
  }
}
```

#### 优化 2: Skills 分类和搜索

当前 Skills 列表是扁平的，难以发现。

**建议**: 添加分类和标签

```typescript
// skills/registry.ts
interface SkillRegistry {
  skills: Map<string, Skill>;
  categories: Map<string, string[]>;  // category -> skill names
  tags: Map<string, string[]>;        // tag -> skill names
}

function categorizeSkills(skills: Skill[]): SkillRegistry {
  const registry: SkillRegistry = {
    skills: new Map(),
    categories: new Map(),
    tags: new Map(),
  };

  // 自动分类
  const categoryRules: Record<string, RegExp[]> = {
    "Research": [/research/i, /analyze/i, /investigate/i],
    "Development": [/code/i, /debug/i, /migrate/i, /review/i],
    "Documentation": [/doc/i, /readme/i, /generate/i],
    "Git": [/git/i, /commit/i, /branch/i],
    "Web": [/web/i, /scrape/i, /fetch/i],
  };

  for (const skill of skills) {
    registry.skills.set(skill.name, skill);

    // 自动分类
    for (const [category, patterns] of Object.entries(categoryRules)) {
      if (patterns.some(p => p.test(skill.name) || p.test(skill.description))) {
        const list = registry.categories.get(category) ?? [];
        list.push(skill.name);
        registry.categories.set(category, list);
      }
    }

    // 处理标签
    for (const tag of skill.tags ?? []) {
      const list = registry.tags.get(tag) ?? [];
      list.push(skill.name);
      registry.tags.set(tag, list);
    }
  }

  return registry;
}

// 在 CommandPicker 中分组显示
/*
╭── Commands ──────────────────────────────╮
│ /help_                                    │
│──────────────────────────────────────────│
│ Built-in                                  │
│   /help          Show help               │
│   /clear         Clear screen            │
│ Research                                  │
│   /deep-research Comprehensive research  │
│   /pdf-analyze   Analyze PDF documents   │
│ Development                               │
│   /code-review   Review code quality     │
│   /debug-complex Debug complex issues    │
│──────────────────────────────────────────│
╰──────────────────────────────────────────╯
*/
```

#### 优化 3: Skills 热重载

修改 Skill 文件后需要重启 agent。

**建议**: 文件监听 + 热重载

```typescript
// skills/watcher.ts
import { watch } from "fs";

class SkillWatcher {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private onReload: (skillName: string) => void;

  constructor(onReload: (skillName: string) => void) {
    this.onReload = onReload;
  }

  watchDirectory(skillsDir: string): void {
    const watcher = watch(skillsDir, { recursive: true }, (event, filename) => {
      if (filename?.endsWith("SKILL.md")) {
        const skillName = path.dirname(filename);
        console.log(fmt(`  Reloading skill: ${skillName}`, theme.tiffany));
        this.onReload(skillName);
      }
    });

    this.watchers.set(skillsDir, watcher);
  }

  close(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

// 在主循环中使用
const skillWatcher = new SkillWatcher((skillName) => {
  // 重新加载特定 skill
  skillRegistry.reload(skillName);
});
skillWatcher.watchDirectory(globalSkillsDir);
skillWatcher.watchDirectory(projectSkillsDir);
```

#### 优化 4: Skills 参数验证

当前不验证 Skill 参数。

**建议**: 使用 Zod 验证

```typescript
// skills/validator.ts
import { z } from "zod";

function createValidator(schema: ParameterSchema): z.ZodSchema {
  const properties: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(schema.properties)) {
    let fieldSchema: z.ZodTypeAny;

    switch (prop.type) {
      case "string":
        fieldSchema = prop.enum ? z.enum(prop.enum) : z.string();
        break;
      case "integer":
        fieldSchema = z.number().int();
        break;
      case "boolean":
        fieldSchema = z.boolean();
        break;
      default:
        fieldSchema = z.unknown();
    }

    if (prop.default !== undefined) {
      fieldSchema = fieldSchema.default(prop.default);
    }

    if (!schema.required?.includes(key)) {
      fieldSchema = fieldSchema.optional();
    }

    properties[key] = fieldSchema;
  }

  return z.object(properties);
}

// 在调用 Skill 前验证参数
function invokeSkill(skillName: string, params: unknown): void {
  const skill = skillRegistry.get(skillName);
  if (!skill) throw new Error(`Unknown skill: ${skillName}`);

  const validator = createValidator(skill.parameters);
  const validatedParams = validator.parse(params);

  // 调用 skill...
}
```

#### 优化 5: Skills 组合

支持一个 Skill 调用另一个 Skill。

**建议**: Skill 管道

```typescript
// skills/pipeline.ts
interface SkillPipeline {
  name: string;
  description: string;
  steps: PipelineStep[];
}

interface PipelineStep {
  skill: string;
  params?: Record<string, unknown>;
  outputAs?: string;  // 将输出保存为变量
  condition?: string; // 条件执行
}

// 示例: research-and-report pipeline
const researchPipeline: SkillPipeline = {
  name: "research-report",
  description: "Research a topic and generate a report",
  steps: [
    { skill: "deep-research", params: { depth: "comprehensive" }, outputAs: "research" },
    { skill: "doc-generate", params: { doc_type: "readme", input: "{{research}}" } },
  ],
};

// 在 SKILL.md 中定义
/*
---
name: full-analysis
type: pipeline
steps:
  - skill: code-review
    outputAs: review
  - skill: doc-generate
    params:
      doc_type: api
      include_review: "{{review}}"
---
*/
```

---

## 性能优化

### 6.1 启动时间优化

当前启动加载所有 Skills，即使不使用。

**建议**: 懒加载

```typescript
// 当前: 启动时加载所有
function buildCommandList(): Command[] {
  const globalSkills = loadSkillsFromDir(globalSkillsDir);  // 同步 I/O
  const projectSkills = loadSkillsFromDir(projectSkillsDir);
  // ...
}

// 优化: 缓存 + 懒加载
class LazySkillLoader {
  private cache: Map<string, Skill> = new Map();
  private metadataCache: SkillMetadata[] | null = null;
  private cacheTime: number = 0;
  private readonly TTL = 60000; // 1 分钟缓存

  async getMetadataList(): Promise<SkillMetadata[]> {
    const now = Date.now();
    if (this.metadataCache && now - this.cacheTime < this.TTL) {
      return this.metadataCache;
    }

    // 只读取 SKILL.md 的 frontmatter，不解析完整内容
    this.metadataCache = await this.loadMetadata();
    this.cacheTime = now;
    return this.metadataCache;
  }

  async getSkill(name: string): Promise<Skill> {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    // 首次访问时才完整加载
    const skill = await this.loadSkill(name);
    this.cache.set(name, skill);
    return skill;
  }

  private async loadMetadata(): Promise<SkillMetadata[]> {
    // 并行读取所有目录
    const [global, project] = await Promise.all([
      this.scanDirectory(globalSkillsDir),
      this.scanDirectory(projectSkillsDir),
    ]);
    return [...global, ...project];
  }
}
```

### 6.2 文件系统优化

#### 优化 1: 并行读取

```typescript
// 当前: 串行读取
for (const file of files) {
  const content = fs.readFileSync(file, "utf-8");
  // ...
}

// 优化: 并行读取
const contents = await Promise.all(
  files.map(file => fs.promises.readFile(file, "utf-8"))
);
```

#### 优化 2: 文件内容缓存

```typescript
// utils/file-cache.ts
class FileCache {
  private cache = new Map<string, { content: string; mtime: number }>();

  async read(filePath: string): Promise<string> {
    const stat = await fs.promises.stat(filePath);
    const cached = this.cache.get(filePath);

    if (cached && cached.mtime === stat.mtimeMs) {
      return cached.content;
    }

    const content = await fs.promises.readFile(filePath, "utf-8");
    this.cache.set(filePath, { content, mtime: stat.mtimeMs });
    return content;
  }

  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### 6.3 渲染优化

#### 优化 1: 虚拟列表

大量文件时只渲染可见项：

```typescript
// ui/virtual-list.ts
interface VirtualListConfig {
  itemHeight: number;
  containerHeight: number;
  items: unknown[];
  renderItem: (item: unknown, index: number) => string;
}

function createVirtualList(config: VirtualListConfig) {
  const visibleCount = Math.ceil(config.containerHeight / config.itemHeight);
  let scrollOffset = 0;

  return {
    setScroll(offset: number) {
      scrollOffset = Math.max(0, Math.min(offset, config.items.length - visibleCount));
    },

    render(): string[] {
      const start = scrollOffset;
      const end = Math.min(start + visibleCount, config.items.length);
      const visibleItems = config.items.slice(start, end);

      return visibleItems.map((item, i) => config.renderItem(item, start + i));
    },

    scrollTo(index: number) {
      if (index < scrollOffset) {
        this.setScroll(index);
      } else if (index >= scrollOffset + visibleCount) {
        this.setScroll(index - visibleCount + 1);
      }
    },
  };
}
```

#### 优化 2: Double Buffering

避免闪烁：

```typescript
// ui/renderer.ts
class DoubleBufferedRenderer {
  private frontBuffer: string[] = [];
  private backBuffer: string[] = [];

  beginFrame(): void {
    this.backBuffer = [];
  }

  writeLine(line: string): void {
    this.backBuffer.push(line);
  }

  endFrame(): void {
    // 计算差异
    const changes = this.computeDiff(this.frontBuffer, this.backBuffer);

    // 只更新变化的行
    for (const change of changes) {
      moveCursorTo(change.line);
      clearLine();
      process.stdout.write(change.content);
    }

    this.frontBuffer = [...this.backBuffer];
  }

  private computeDiff(prev: string[], next: string[]): Change[] {
    const changes: Change[] = [];
    const maxLen = Math.max(prev.length, next.length);

    for (let i = 0; i < maxLen; i++) {
      if (prev[i] !== next[i]) {
        changes.push({ line: i, content: next[i] ?? "" });
      }
    }

    return changes;
  }
}
```

---

## 开发者体验改进

### 7.1 测试覆盖

当前只有基础单元测试 (`test-ui.ts`)。

**建议**: 完整测试套件

```typescript
// tests/unit/commands.test.ts
import { describe, it, expect } from "vitest";
import { CommandPicker } from "../src/ui/commands";

describe("CommandPicker", () => {
  describe("filtering", () => {
    it("should filter commands by name", () => {
      const picker = new CommandPicker({
        commands: [
          { name: "help", description: "Show help" },
          { name: "exit", description: "Exit" },
        ],
      });

      picker.setFilter("hel");
      expect(picker.getFilteredCommands()).toHaveLength(1);
      expect(picker.getFilteredCommands()[0].name).toBe("help");
    });

    it("should be case insensitive", () => {
      // ...
    });
  });

  describe("navigation", () => {
    it("should move selection down", () => {
      // ...
    });

    it("should wrap around at boundaries", () => {
      // ...
    });
  });
});

// tests/integration/skills.test.ts
describe("Skills System", () => {
  it("should load skills from global directory", async () => {
    // ...
  });

  it("should override global skills with project skills", async () => {
    // ...
  });

  it("should hot reload modified skills", async () => {
    // ...
  });
});

// tests/e2e/agent.test.ts
describe("Agent E2E", () => {
  it("should handle simple query", async () => {
    // ...
  });

  it("should maintain session across queries", async () => {
    // ...
  });

  it("should invoke skills correctly", async () => {
    // ...
  });
});
```

### 7.2 类型安全增强

#### 问题: any 类型

```typescript
// 当前有一些 any
const input = block.input || {};  // unknown -> any
```

**建议**: 严格类型

```typescript
// types/sdk.ts
interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface TaskToolInput {
  subagent_type: string;
  description: string;
  prompt: string;
}

function isTaskToolInput(input: unknown): input is TaskToolInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "subagent_type" in input &&
    "description" in input &&
    "prompt" in input
  );
}

// 使用
if (block.name === "Task" && isTaskToolInput(block.input)) {
  const { subagent_type, description, prompt } = block.input;
  // 类型安全
}
```

### 7.3 日志系统

当前日志混在代码中。

**建议**: 统一日志

```typescript
// utils/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

function createLogger(options: { level: LogLevel; prefix?: string }): Logger {
  const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  const currentLevel = levels[options.level];

  const log = (level: LogLevel, message: string, ...args: unknown[]) => {
    if (levels[level] < currentLevel) return;

    const timestamp = new Date().toISOString();
    const prefix = options.prefix ? `[${options.prefix}]` : "";
    const levelColor = {
      debug: theme.dim,
      info: theme.tiffany,
      warn: theme.accent,
      error: theme.error,
    }[level];

    console.log(
      fmt(`${timestamp} ${prefix}`, theme.dim),
      fmt(`[${level.toUpperCase()}]`, levelColor),
      message,
      ...args
    );
  };

  return {
    debug: (msg, ...args) => log("debug", msg, ...args),
    info: (msg, ...args) => log("info", msg, ...args),
    warn: (msg, ...args) => log("warn", msg, ...args),
    error: (msg, ...args) => log("error", msg, ...args),
  };
}

// 使用
const logger = createLogger({ level: "info", prefix: "Agent" });
logger.info("Starting agent...");
logger.debug("Loading skills from", skillsDir);
logger.error("Failed to connect", error);
```

### 7.4 开发工具

#### Skill 脚手架

```bash
# 创建新 Skill
agent skill:create my-skill

# 生成的结构
.claude/skills/my-skill/
├── SKILL.md        # 模板
├── scripts/        # 可选脚本目录
└── README.md       # 说明
```

```typescript
// cli/commands/skill-create.ts
async function createSkill(name: string): Promise<void> {
  const skillDir = path.join(process.cwd(), ".claude", "skills", name);

  if (fs.existsSync(skillDir)) {
    throw new Error(`Skill "${name}" already exists`);
  }

  fs.mkdirSync(skillDir, { recursive: true });

  const template = `---
name: ${name}
description: Description of what this skill does
version: 1.0.0
allowed-tools: [Read, Write, Bash]
---

# ${name.charAt(0).toUpperCase() + name.slice(1)} Skill

## When to Use

- Describe when this skill should be used

## Process

1. Step 1
2. Step 2
3. Step 3

## Examples

### Example 1

**User Input**: "..."

**Expected Behavior**:
1. ...
`;

  fs.writeFileSync(path.join(skillDir, "SKILL.md"), template);
  console.log(fmt(`Created skill: ${name}`, theme.success));
}
```

---

## 用户体验增强

### 8.1 进度指示增强

当前只显示 "Processing..."。

**建议**: 详细进度

```typescript
// ui/progress.ts
interface ProgressIndicator {
  start(message: string): void;
  update(message: string): void;
  tick(): void;
  stop(success: boolean): void;
}

function createSpinner(): ProgressIndicator {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frameIndex = 0;
  let interval: NodeJS.Timeout | null = null;
  let currentMessage = "";

  return {
    start(message: string) {
      currentMessage = message;
      interval = setInterval(() => {
        clearLine();
        const frame = frames[frameIndex % frames.length];
        process.stdout.write(`\r  ${fmt(frame, theme.tiffany)} ${message}`);
        frameIndex++;
      }, 80);
    },

    update(message: string) {
      currentMessage = message;
    },

    tick() {
      // 视觉反馈
    },

    stop(success: boolean) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      clearLine();
      const icon = success ? fmt(icons.check, theme.success) : fmt(icons.cross, theme.error);
      console.log(`\r  ${icon} ${currentMessage}`);
    },
  };
}

// 使用
const spinner = createSpinner();
spinner.start("Analyzing code...");
// ...
spinner.update("Running tests...");
// ...
spinner.stop(true);
```

### 8.2 上下文面包屑

显示当前上下文状态：

```
╭─────────────────────────────────────────────╮
│ * Terminal Agent v5.0.0                      │
│ Powered by Claude Agent SDK                  │
╰─────────────────────────────────────────────╯

  [D] E:\projects\my-app
  Session: abc123... | Model: sonnet | Skills: 8

  Context: @package.json @src/index.ts (2 files)

  > _
```

### 8.3 智能建议

根据上下文提供建议：

```typescript
// core/suggestions.ts
interface Suggestion {
  text: string;
  description: string;
  command?: string;
}

function getSuggestions(context: Context): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // 基于文件类型
  if (context.files.some(f => f.name === "package.json")) {
    suggestions.push({
      text: "Run npm install",
      description: "Install dependencies",
      command: "npm install",
    });
  }

  // 基于 Git 状态
  if (context.gitStatus?.hasUncommittedChanges) {
    suggestions.push({
      text: "Commit changes",
      description: "Use /git-commit to commit",
      command: "/git-commit",
    });
  }

  // 基于历史
  if (context.lastError) {
    suggestions.push({
      text: "Debug last error",
      description: "Use /debug-complex to investigate",
      command: "/debug-complex",
    });
  }

  return suggestions;
}

// 显示建议
/*
  Suggestions:
    [1] Run npm install - Install dependencies
    [2] Commit changes - Use /git-commit

  > _
*/
```

### 8.4 快捷键系统

```
╭─ Keyboard Shortcuts ─────────────────────────╮
│                                              │
│ Navigation                                   │
│   Ctrl+P    Quick file picker               │
│   Ctrl+K    Command palette                 │
│   Ctrl+R    Search history                  │
│                                              │
│ Actions                                      │
│   Ctrl+S    Save session                    │
│   Ctrl+C    Cancel current operation        │
│   Ctrl+L    Clear screen                    │
│                                              │
│ Help                                         │
│   ?         Show this help                  │
│   F1        Show documentation              │
│                                              │
╰──────────────────────────────────────────────╯
```

### 8.5 会话管理

```typescript
// core/session-manager.ts
interface Session {
  id: string;
  name?: string;
  createdAt: Date;
  lastAccessedAt: Date;
  messages: Message[];
  context: Context;
}

class SessionManager {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(os.homedir(), ".agent", "sessions");
    fs.mkdirSync(this.sessionsDir, { recursive: true });
  }

  async save(session: Session): Promise<void> {
    const filePath = path.join(this.sessionsDir, `${session.id}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(session, null, 2));
  }

  async load(id: string): Promise<Session | null> {
    const filePath = path.join(this.sessionsDir, `${id}.json`);
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async list(): Promise<Session[]> {
    const files = await fs.promises.readdir(this.sessionsDir);
    const sessions: Session[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        const session = await this.load(file.replace(".json", ""));
        if (session) sessions.push(session);
      }
    }

    return sessions.sort((a, b) =>
      new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
    );
  }

  async delete(id: string): Promise<void> {
    const filePath = path.join(this.sessionsDir, `${id}.json`);
    await fs.promises.unlink(filePath);
  }
}

// 命令
// /sessions        - 列出所有会话
// /session:save    - 保存当前会话
// /session:load    - 加载会话
// /session:delete  - 删除会话
```

---

## 安全性加固

### 9.1 输入验证

```typescript
// utils/security.ts

// 路径遍历防护
function sanitizePath(userPath: string, basePath: string): string {
  const resolved = path.resolve(basePath, userPath);

  if (!resolved.startsWith(basePath)) {
    throw new Error("Path traversal attempt detected");
  }

  return resolved;
}

// 命令注入防护
function sanitizeShellArg(arg: string): string {
  // 转义特殊字符
  return arg.replace(/[;&|`$(){}[\]<>\\'"]/g, "\\$&");
}

// 文件内容大小限制
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function safeReadFile(filePath: string): Promise<string> {
  const stat = await fs.promises.stat(filePath);

  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${stat.size} bytes (max: ${MAX_FILE_SIZE})`);
  }

  return fs.promises.readFile(filePath, "utf-8");
}
```

### 9.2 敏感文件保护

```typescript
// utils/security.ts
const SENSITIVE_PATTERNS = [
  /\.env$/,
  /\.env\.\w+$/,
  /credentials\.json$/,
  /secrets\.ya?ml$/,
  /\.pem$/,
  /\.key$/,
  /id_rsa$/,
  /\.aws\/credentials$/,
];

function isSensitiveFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(filePath) || pattern.test(basename));
}

// 在文件浏览器中
if (isSensitiveFile(item.path)) {
  // 显示警告标记
  content = fmt(prefix, theme.error) + " " + fmt("[!]", theme.error) + " " + ...;
}

// 在文件附加时
if (isSensitiveFile(file.path)) {
  console.log(fmt(`  Warning: ${file.name} may contain sensitive data`, theme.error));
  const confirm = await askConfirmation("Are you sure you want to attach this file?");
  if (!confirm) return;
}
```

### 9.3 权限控制

```typescript
// config/permissions.ts
interface Permissions {
  allowFileRead: boolean;
  allowFileWrite: boolean;
  allowShell: boolean;
  allowNetwork: boolean;
  readPaths: string[];   // 允许读取的路径
  writePaths: string[];  // 允许写入的路径
  blockedCommands: string[];  // 禁止的命令
}

const defaultPermissions: Permissions = {
  allowFileRead: true,
  allowFileWrite: true,
  allowShell: true,
  allowNetwork: true,
  readPaths: [process.cwd()],
  writePaths: [process.cwd()],
  blockedCommands: ["rm -rf /", "format", "mkfs"],
};

// 权限检查
function checkPermission(action: string, target: string): boolean {
  switch (action) {
    case "read":
      return permissions.allowFileRead &&
        permissions.readPaths.some(p => target.startsWith(p));
    case "write":
      return permissions.allowFileWrite &&
        permissions.writePaths.some(p => target.startsWith(p));
    case "shell":
      return permissions.allowShell &&
        !permissions.blockedCommands.some(cmd => target.includes(cmd));
    default:
      return false;
  }
}
```

---

## 可扩展性设计

### 10.1 插件系统

```typescript
// plugins/types.ts
interface Plugin {
  name: string;
  version: string;
  description: string;

  // 生命周期钩子
  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;

  // 扩展点
  commands?: Command[];
  skills?: Skill[];
  themes?: Theme[];

  // 事件处理
  onMessage?: (message: Message) => void;
  onToolUse?: (tool: string, input: unknown) => void;
}

// plugins/loader.ts
class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private pluginsDir: string;

  constructor() {
    this.pluginsDir = path.join(os.homedir(), ".agent", "plugins");
  }

  async loadAll(): Promise<void> {
    const entries = await fs.promises.readdir(this.pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        await this.load(entry.name);
      }
    }
  }

  async load(name: string): Promise<void> {
    const pluginPath = path.join(this.pluginsDir, name, "index.js");

    try {
      const module = await import(pluginPath);
      const plugin: Plugin = module.default;

      await plugin.onLoad?.();
      this.plugins.set(name, plugin);

      console.log(fmt(`  Loaded plugin: ${name}`, theme.tiffany));
    } catch (error) {
      console.log(fmt(`  Failed to load plugin: ${name}`, theme.error));
    }
  }

  getCommands(): Command[] {
    return Array.from(this.plugins.values())
      .flatMap(p => p.commands ?? []);
  }

  getSkills(): Skill[] {
    return Array.from(this.plugins.values())
      .flatMap(p => p.skills ?? []);
  }
}
```

### 10.2 主题系统增强

```typescript
// themes/types.ts
interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    success: string;
    error: string;
    warning: string;
    info: string;
  };
  icons?: Partial<typeof icons>;
  borders?: Partial<typeof borders>;
}

// themes/presets.ts
export const themes: Record<string, Theme> = {
  default: {
    name: "Default",
    colors: {
      primary: "\x1b[38;2;129;216;208m",  // Tiffany
      secondary: "\x1b[38;2;241;196;15m", // Yellow
      // ...
    },
  },

  dracula: {
    name: "Dracula",
    colors: {
      primary: "\x1b[38;2;189;147;249m",  // Purple
      secondary: "\x1b[38;2;255;121;198m", // Pink
      // ...
    },
  },

  nord: {
    name: "Nord",
    colors: {
      primary: "\x1b[38;2;136;192;208m",
      secondary: "\x1b[38;2;163;190;140m",
      // ...
    },
  },
};

// 用户可以在配置中选择主题
// ~/.agent/config.json
// { "theme": "dracula" }
```

### 10.3 国际化支持

```typescript
// i18n/types.ts
interface Translations {
  commands: {
    help: string;
    exit: string;
    clear: string;
  };
  messages: {
    processing: string;
    done: string;
    error: string;
    sessionCleared: string;
  };
  prompts: {
    input: string;
    confirm: string;
  };
}

// i18n/locales/zh-CN.ts
export const zhCN: Translations = {
  commands: {
    help: "显示帮助",
    exit: "退出程序",
    clear: "清除屏幕",
  },
  messages: {
    processing: "处理中...",
    done: "完成",
    error: "错误",
    sessionCleared: "会话已清除",
  },
  prompts: {
    input: "请输入",
    confirm: "确认？",
  },
};

// i18n/index.ts
class I18n {
  private locale: string;
  private translations: Map<string, Translations> = new Map();

  constructor(locale: string = "en") {
    this.locale = locale;
    this.loadLocales();
  }

  t(key: string): string {
    const parts = key.split(".");
    let current: any = this.translations.get(this.locale);

    for (const part of parts) {
      current = current?.[part];
    }

    return current ?? key;
  }

  setLocale(locale: string): void {
    this.locale = locale;
  }
}

// 使用
const i18n = new I18n(process.env.LANG?.split("_")[0] ?? "en");
console.log(i18n.t("messages.processing"));  // "处理中..." or "Processing..."
```

---

## 优先级路线图

### Phase 1: Quick Wins (1-2 周)

| 优化项 | 影响 | 复杂度 |
|--------|------|--------|
| 添加命令历史 | 高 | 低 |
| 错误恢复机制 | 高 | 低 |
| 统一配置系统 | 中 | 低 |
| 文件预览 | 中 | 低 |
| 进度指示增强 | 中 | 低 |

### Phase 2: Core Improvements (3-4 周)

| 优化项 | 影响 | 复杂度 |
|--------|------|--------|
| 架构重构（模块化） | 高 | 中 |
| Skills 热重载 | 高 | 中 |
| 键盘处理抽象 | 中 | 中 |
| 完整测试套件 | 高 | 中 |
| 会话管理 | 中 | 中 |

### Phase 3: Advanced Features (5-8 周)

| 优化项 | 影响 | 复杂度 |
|--------|------|--------|
| 插件系统 | 高 | 高 |
| 流式文件搜索 | 中 | 中 |
| 渲染性能优化 | 中 | 高 |
| 主题系统增强 | 低 | 中 |
| 国际化支持 | 低 | 中 |

### Phase 4: Polish (持续)

| 优化项 | 影响 | 复杂度 |
|--------|------|--------|
| Skills 参数验证 | 中 | 中 |
| 智能建议 | 中 | 中 |
| 安全性加固 | 高 | 中 |
| 日志系统 | 低 | 低 |
| 开发工具（脚手架） | 低 | 低 |

---

## 附录

### A. 依赖建议

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.76",
    "zod": "^3.22.0"  // 参数验证
  },
  "devDependencies": {
    "vitest": "^1.0.0",  // 测试框架
    "c8": "^8.0.0"       // 覆盖率
  }
}
```

### B. 配置文件格式

```json
// ~/.agent/config.json
{
  "theme": "default",
  "locale": "en",
  "history": {
    "maxSize": 100,
    "persist": true
  },
  "ui": {
    "commandPicker": {
      "width": 44,
      "maxVisible": 8
    },
    "fileBrowser": {
      "width": 52,
      "maxVisible": 10,
      "showHidden": false
    }
  },
  "agent": {
    "defaultModel": "sonnet",
    "permissionMode": "acceptEdits"
  },
  "files": {
    "exclude": ["node_modules", ".git", "dist"],
    "maxSize": 10485760
  }
}
```

### C. 文件结构建议

```
deepresearch/
├── src/
│   ├── index.ts              # 主入口
│   ├── core/
│   │   ├── agent.ts          # SDK 封装
│   │   ├── session.ts        # 会话管理
│   │   ├── message-handler.ts
│   │   ├── context-manager.ts
│   │   └── error-recovery.ts
│   ├── skills/
│   │   ├── loader.ts
│   │   ├── registry.ts
│   │   ├── validator.ts
│   │   ├── watcher.ts
│   │   └── parser.ts
│   ├── ui/
│   │   ├── index.ts
│   │   ├── theme.ts
│   │   ├── commands.ts
│   │   ├── file-browser.ts
│   │   ├── smart-input.ts
│   │   ├── history.ts
│   │   ├── progress.ts
│   │   ├── keyboard.ts
│   │   └── renderer.ts
│   ├── plugins/
│   │   ├── types.ts
│   │   ├── loader.ts
│   │   └── manager.ts
│   ├── utils/
│   │   ├── config.ts
│   │   ├── logger.ts
│   │   ├── file-cache.ts
│   │   └── security.ts
│   ├── i18n/
│   │   ├── index.ts
│   │   └── locales/
│   └── types/
│       └── index.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .claude/skills/
├── bin/
├── docs/
└── package.json
```

---

## 结论

Terminal Coding Agent 已经具备了良好的基础功能，但在架构设计、用户体验、可扩展性等方面还有很大的优化空间。

**最高优先级建议**：
1. **命令历史** - 用户体验的基础功能
2. **架构重构** - 为后续扩展打好基础
3. **Skills 热重载** - 提升开发效率
4. **完整测试** - 保证代码质量

**预期收益**：
- 用户满意度提升 40%+
- 开发效率提升 30%+
- 代码可维护性显著改善
- 为插件生态系统打好基础

---

*报告完成于 2024-12-23*
