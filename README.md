# Terminal Coding Agent

一个使用 Claude API 的终端编程助手。

## 功能

- 🔍 **探索代码** - 使用 Glob、Grep、Read 查找和理解代码
- ✏️ **编写代码** - 使用 Write、Edit 创建和修改文件
- 💻 **执行命令** - 使用 Bash 运行 shell 命令

## 快速开始

### 1. 安装依赖

```bash
npm run install:all
```

### 2. 配置 API

创建 `deepresearch/.env` 文件：

```
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

支持自定义 API 端点（如 API 代理服务）。

### 3. 运行

```bash
npm run dev
```

## 使用示例

```
╔════════════════════════════════════════════╗
║       Terminal Coding Agent v2.0           ║
╚════════════════════════════════════════════╝

Working directory: /your/project
Type 'exit' to quit, 'clear' to reset conversation.

You: 查找所有 TypeScript 文件

Agent:
[Tool: Glob]
  Executing Glob...
  Result: Found 5 files...

找到以下 TypeScript 文件：
- src/agent.ts
- src/tools.ts
...

You: 读取 agent.ts 的内容

Agent:
[Tool: Read]
  Executing Read...
  Result: 1│/**...

这是 agent.ts 的内容...
```

## 项目结构

```
deepresearch/
├── src/
│   ├── agent.ts    # 主 Agent 逻辑
│   └── tools.ts    # 工具定义和执行
├── .env            # API 配置
└── package.json
```

## 可用工具

| 工具 | 用途 |
|------|------|
| Glob | 按模式查找文件 |
| Grep | 在文件中搜索文本 |
| Read | 读取文件内容 |
| Write | 创建/覆盖文件 |
| Edit | 编辑现有文件 |
| Bash | 执行 shell 命令 |

## 技术栈

- TypeScript
- @anthropic-ai/sdk - Claude API SDK
- dotenv - 环境变量管理

## 许可证

MIT
