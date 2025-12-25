# 简历增强策略 - Terminal Coding Agent

> 目标：让项目在简历上体现**前沿技术掌握能力**和**技术深度**

---

## 一、当前项目技术亮点评估

### 已具备的亮点（可直接写入简历）

| 技术点 | 亮点程度 | 说明 |
|--------|----------|------|
| Claude Agent SDK 集成 | ⭐⭐⭐⭐⭐ | **Anthropic 官方 SDK，2024年底刚发布**，市面上使用者极少 |
| Skills 系统架构 | ⭐⭐⭐⭐⭐ | 符合官方 `.claude/skills/` 规范，全局+项目双层加载 |
| 纯 TypeScript TUI | ⭐⭐⭐⭐ | 无框架依赖，原生 ANSI + setRawMode 实现 |
| Playwright 动态爬虫 | ⭐⭐⭐⭐ | Headless Chrome + Cheerio/Turndown 双引擎 |
| 流式响应处理 | ⭐⭐⭐⭐ | async iterator 处理 SDK 流式输出 |

### 缺失的"杀手级"亮点

| 技术点 | 重要性 | 当前状态 |
|--------|--------|----------|
| **Multi-Agent 多智能体系统** | 🔥🔥🔥🔥🔥 | README 提到但**未实现** |
| **MCP (Model Context Protocol)** | 🔥🔥🔥🔥🔥 | 未接入 |
| **RAG 增强检索** | 🔥🔥🔥🔥 | 仅有基础文件注入 |
| **LangChain/LangGraph 对比** | 🔥🔥🔥 | 未体现 |
| **Prompt Engineering 最佳实践** | 🔥🔥🔥🔥 | Skills 中有但未系统化 |

---

## 二、必做增强（高ROI，让项目脱颖而出）

### 1. 实现 Multi-Agent 多智能体系统 🔥🔥🔥🔥🔥

**为什么重要**：
- 多智能体协作是 2024-2025 年 AI Agent 领域的**最热门方向**
- OpenAI Swarm、AutoGen、CrewAI 都在做这个
- 体现你对**复杂系统设计**的能力

**实现方案**：在 `src/` 中添加 `agents/` 目录

```typescript
// src/agents/research-team.ts
import { query } from "@anthropic-ai/claude-agent-sdk";

const agents = {
  researcher: {
    description: "搜索网络收集信息，结果写入 files/research_notes/",
    tools: ["WebSearch", "WebFetch", "Write"],
    prompt: `你是研究专员。使用 WebSearch 搜索信息，将发现写入 files/research_notes/{topic}.md`,
    model: "haiku" as const,
  },
  analyst: {
    description: "分析研究笔记，提取关键洞察",
    tools: ["Read", "Glob", "Write"],
    prompt: `你是数据分析师。读取 files/research_notes/ 中的笔记，提取关键洞察写入 files/analysis/`,
    model: "haiku" as const,
  },
  writer: {
    description: "将分析结果整理成最终报告",
    tools: ["Read", "Glob", "Write"],
    prompt: `你是报告撰写人。读取 files/analysis/ 内容，撰写专业报告到 files/reports/`,
    model: "sonnet" as const,
  },
};

export async function runResearchTeam(topic: string): Promise<void> {
  const result = query({
    prompt: `研究主题：${topic}。请并行派遣 3 个 researcher 搜索不同角度，然后让 analyst 分析，最后让 writer 撰写报告。`,
    options: {
      systemPrompt: leadAgentPrompt,
      allowedTools: ["Task"],  // Lead Agent 只能调度
      agents,
      model: "sonnet",
    },
  });

  for await (const msg of result) {
    // 实时显示各 subagent 的工作状态
    if (msg.type === "assistant") {
      displayAgentActivity(msg);
    }
  }
}
```

**简历写法**：
> 设计并实现了基于 Claude Agent SDK 的**多智能体协作系统**，采用 Lead Agent + Specialist 架构，支持并行研究任务调度，将研究效率提升 3-5 倍

---

### 2. 接入 MCP (Model Context Protocol) 🔥🔥🔥🔥🔥

**为什么重要**：
- MCP 是 Anthropic 2024年11月刚发布的**官方协议**
- 定义了 AI 与外部工具的标准化通信方式
- 极少有人在项目中实际使用

**实现方案**：创建自定义 MCP Server

```typescript
// src/mcp/database-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "database-context",
  version: "1.0.0",
}, {
  capabilities: {
    resources: {},
    tools: {},
  },
});

// 暴露数据库 schema 作为上下文
server.setRequestHandler("resources/list", async () => ({
  resources: [{
    uri: "db://schema",
    name: "Database Schema",
    mimeType: "application/json",
  }],
}));

// 提供 SQL 查询工具
server.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "query_database",
    description: "Execute SQL query on the database",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL query to execute" },
      },
      required: ["sql"],
    },
  }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

**配置 SDK 使用 MCP**：
```typescript
// 在 query 中启用 MCP
const result = query({
  prompt: userInput,
  options: {
    mcpServers: {
      database: {
        command: "node",
        args: ["./src/mcp/database-server.js"],
      },
    },
  },
});
```

**简历写法**：
> 基于 Anthropic MCP (Model Context Protocol) 协议开发了自定义 MCP Server，实现数据库 schema 自动注入和 SQL 查询工具，展示了对 AI 工具标准化协议的深入理解

---

### 3. 实现 Agentic RAG 🔥🔥🔥🔥

**为什么重要**：
- RAG 是企业级 AI 应用的核心技术
- 普通 RAG 只是检索，**Agentic RAG** 让 Agent 自主决定何时检索

**实现方案**：

```typescript
// src/rag/vector-store.ts
import { ChromaClient, OpenAIEmbeddingFunction } from "chromadb";

class AgenticRAG {
  private client: ChromaClient;
  private collection: Collection;

  async indexCodebase(directory: string): Promise<void> {
    const files = await glob(`${directory}/**/*.{ts,js,md}`);

    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      const chunks = this.splitIntoChunks(content, 500);

      await this.collection.add({
        documents: chunks,
        metadatas: chunks.map(() => ({ file, type: this.getFileType(file) })),
        ids: chunks.map((_, i) => `${file}-${i}`),
      });
    }
  }

  async query(question: string, topK = 5): Promise<RetrievedContext[]> {
    const results = await this.collection.query({
      queryTexts: [question],
      nResults: topK,
    });

    return results.documents[0].map((doc, i) => ({
      content: doc,
      file: results.metadatas[0][i].file,
      relevance: results.distances[0][i],
    }));
  }
}
```

**Skills 集成**：
```markdown
# .claude/skills/codebase-qa/SKILL.md
---
name: codebase-qa
description: Use when user asks about codebase architecture, implementation details
allowed-tools: [Bash, Read, Write]
---

## Workflow
1. User asks a question about the codebase
2. Use Bash to run: `node src/rag/query.js "user question"`
3. Get top 5 relevant code chunks
4. Read the full files for context
5. Synthesize an answer with code references
```

**简历写法**：
> 实现了 Agentic RAG 系统，集成 ChromaDB 向量数据库，支持代码库语义检索。Agent 可自主决定何时触发检索，实现了"检索增强"到"Agent 驱动检索"的升级

---

### 4. 添加 Prompt Engineering 示范 🔥🔥🔥🔥

**为什么重要**：
- Prompt Engineering 是 AI 应用开发的核心技能
- 展示你理解**分阶段思考、结构化输出、Chain-of-Thought**

**实现方案**：创建 Prompt 模板库

```typescript
// src/prompts/templates.ts
export const CHAIN_OF_THOUGHT = `
Before answering, think through this step by step:
1. First, identify what the user is really asking
2. Then, break down the problem into sub-problems
3. For each sub-problem, consider multiple approaches
4. Finally, synthesize the best solution

<thinking>
[Your step-by-step reasoning here]
</thinking>

<answer>
[Your final answer here]
</answer>
`;

export const STRUCTURED_OUTPUT = `
You must respond in the following JSON format:
{
  "analysis": "string - your analysis of the problem",
  "confidence": "number 0-1 - how confident you are",
  "solution": {
    "steps": ["step1", "step2", ...],
    "code": "optional code if applicable",
    "caveats": ["potential issues to watch for"]
  },
  "alternatives": ["other approaches considered"]
}
`;

export const FEW_SHOT_CODE_REVIEW = `
Here are examples of good code review feedback:

Example 1:
Input: for (let i = 0; i < arr.length; i++) { sum += arr[i]; }
Output: Consider using arr.reduce((sum, x) => sum + x, 0) for cleaner code.

Example 2:
Input: if (user !== null && user !== undefined)
Output: Simplify to: if (user != null) - this covers both null and undefined.

Now review the following code:
`;
```

**简历写法**：
> 设计了结构化 Prompt Engineering 系统，包含 Chain-of-Thought、Few-Shot Learning、Structured Output 等模式，确保 Agent 输出的一致性和可靠性

---

### 5. 实现 Skill 执行可视化 🔥🔥🔥

**为什么重要**：
- 体现对**用户体验**的关注
- 展示前端可视化能力

**实现方案**：

```typescript
// src/ui/skill-progress.ts
class SkillProgressDisplay {
  private phases: Map<string, PhaseStatus> = new Map();

  displayPhase(skillName: string, phase: string, status: "pending" | "running" | "done"): void {
    const icons = { pending: "○", running: "◐", done: "●" };
    const colors = { pending: theme.dim, running: theme.accent, done: theme.success };

    console.log(
      fmt(`  ${icons[status]} `, colors[status]) +
      fmt(`Phase ${phase}`, status === "running" ? theme.bold : theme.dim)
    );
  }

  displayToolCall(agentId: string, toolName: string, args: string): void {
    console.log(
      fmt(`    └─ `, theme.dim) +
      fmt(`[${agentId}]`, theme.tiffany) +
      fmt(` ${toolName}`, theme.accent) +
      fmt(` ${args.slice(0, 50)}...`, theme.dim)
    );
  }
}
```

**效果展示**：
```
╭─ deep-research ─────────────────────────────╮
│ ● Phase 1: Query Decomposition              │
│ ◐ Phase 2: Parallel Research                │
│   └─ [RESEARCHER-1] WebSearch "quantum..."  │
│   └─ [RESEARCHER-2] WebSearch "quantum..."  │
│   └─ [RESEARCHER-3] WebSearch "quantum..."  │
│ ○ Phase 3: Analysis                         │
│ ○ Phase 4: Report Generation                │
╰─────────────────────────────────────────────╯
```

---

## 三、锦上添花增强（加分项）

### 6. 添加 Benchmark 性能对比

```typescript
// benchmarks/compare-frameworks.ts
// 对比 Claude SDK vs LangChain.js vs Mastra 的：
// - 响应延迟
// - Token 使用效率
// - 任务完成准确率
```

**简历写法**：
> 设计了 AI Agent 框架性能基准测试，对比 Claude SDK、LangChain、Mastra 在响应延迟、Token 效率等维度的表现

### 7. 添加安全审计模块

```typescript
// src/security/prompt-guard.ts
export function detectPromptInjection(input: string): boolean {
  const patterns = [
    /ignore previous instructions/i,
    /system prompt/i,
    /you are now/i,
  ];
  return patterns.some(p => p.test(input));
}
```

**简历写法**：
> 实现了 Prompt Injection 检测模块，防止恶意输入绕过系统指令，体现对 AI 安全的深入理解

### 8. 添加 Token 优化策略

```typescript
// src/optimization/context-compression.ts
// 1. 长对话自动摘要
// 2. 代码块智能截断
// 3. 重复内容去重
```

---

## 四、简历描述模板

### 精简版（3行）

> **Terminal Coding Agent** | TypeScript, Claude Agent SDK, MCP, Playwright
>
> 基于 Anthropic Claude Agent SDK 的终端编程助手，实现 Multi-Agent 协作、MCP 工具协议、Agentic RAG、8 个专业 Skills。纯 TypeScript 实现 TUI（命令选择器 + 模糊搜索文件浏览器），采用官方 Skills 规范的可扩展架构。

### 详细版（项目详情）

> **Terminal Coding Agent** — AI 驱动的终端编程助手
>
> 技术栈：TypeScript、Claude Agent SDK、MCP、Playwright、ChromaDB
>
> - **Multi-Agent 系统**：设计 Lead Agent + Specialist 架构，实现研究任务的并行调度和协作
> - **MCP 协议集成**：开发自定义 MCP Server，实现数据库 schema 自动注入和工具标准化
> - **Agentic RAG**：集成向量数据库，实现代码库语义检索，Agent 自主决策检索时机
> - **Skills 系统**：8 个专业 Skill（深度研究/代码审查/Web 爬取等），符合 Anthropic 官方规范
> - **终端 UI**：无框架依赖的 TUI，原生 ANSI + setRawMode 实现命令面板和模糊搜索

### 面试话术

**Q: 为什么选择 Claude Agent SDK 而不是 LangChain？**

> Claude Agent SDK 是 Anthropic 官方推出的 Agent 开发框架，相比 LangChain 有几个优势：
> 1. 深度集成 Claude 模型的工具调用能力，响应更快更稳定
> 2. 原生支持 Multi-Agent，无需额外抽象层
> 3. 遵循 MCP 协议，工具标准化程度更高
>
> LangChain 的优势是模型无关和生态丰富，但对于专注 Claude 的项目，官方 SDK 是更好的选择。

**Q: Multi-Agent 系统是怎么实现的？**

> 采用经典的 Lead Agent + Specialist 模式：
> 1. Lead Agent 只有 `Task` 工具，负责任务分解和调度
> 2. Specialist Agents（Researcher/Analyst/Writer）各有专门工具集
> 3. 通过文件系统作为"中继站"传递中间结果
> 4. 支持并行派遣多个 Researcher 加速信息收集

---

## 五、优先级排序

| 优先级 | 任务 | 预计时间 | 简历加分 |
|--------|------|----------|----------|
| P0 | 实现 Multi-Agent 系统 | 2-3 天 | ⭐⭐⭐⭐⭐ |
| P0 | 接入 MCP Server | 1-2 天 | ⭐⭐⭐⭐⭐ |
| P1 | 实现 Agentic RAG | 2-3 天 | ⭐⭐⭐⭐ |
| P1 | Skill 执行可视化 | 1 天 | ⭐⭐⭐ |
| P2 | Prompt Engineering 模板 | 0.5 天 | ⭐⭐⭐ |
| P2 | 性能 Benchmark | 1 天 | ⭐⭐⭐ |
| P3 | 安全审计模块 | 0.5 天 | ⭐⭐ |

---

## 六、技术关键词清单（SEO 优化简历）

**前沿 AI 技术**：
- Claude Agent SDK
- Multi-Agent System (MAS)
- Model Context Protocol (MCP)
- Retrieval-Augmented Generation (RAG)
- Agentic AI
- Tool Use / Function Calling
- Chain-of-Thought Prompting
- Streaming API

**工程能力**：
- TypeScript 严格类型
- Terminal UI (TUI)
- 异步编程 (async/await, AsyncIterator)
- 模块化架构
- Headless Browser Automation (Playwright)
- HTML Parsing (Cheerio)

**系统设计**：
- 插件/Skill 架构
- 会话持久化
- 双层配置加载
- 模糊搜索算法

---

**最终建议**：优先实现 **Multi-Agent** 和 **MCP**，这两个是 2024-2025 年 AI Agent 领域的绝对热点，会让你的项目在众多简历中脱颖而出。
