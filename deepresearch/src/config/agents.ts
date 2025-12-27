/**
 * Agent 配置
 */
import type { SubagentType, AgentConfig } from "../agents/types.js";

// Agent 配置表
export const AGENT_CONFIGS: Record<SubagentType, AgentConfig> = {
  coordinator: {
    name: "Coordinator",
    type: "coordinator",
    description: "理解意图，分配任务",
    promptFile: "coordinator.md",
    canDispatch: true,
    allowedTools: ["Read", "Glob", "Grep", "Task", "WebSearch", "WebFetch"],
  },
  reader: {
    name: "Reader",
    type: "reader",
    description: "代码阅读和理解",
    promptFile: "reader.md",
    canDispatch: false,
    allowedTools: ["Read", "Glob", "Grep", "LSP"],
  },
  coder: {
    name: "Coder",
    type: "coder",
    description: "代码编写和修改",
    promptFile: "coder.md",
    canDispatch: false,
    allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "LSP", "NotebookEdit"],
  },
  reviewer: {
    name: "Reviewer",
    type: "reviewer",
    description: "代码审查和质量检查",
    promptFile: "reviewer.md",
    canDispatch: false,
    allowedTools: ["Read", "Glob", "Grep", "Bash", "LSP"],
  },
};

// Agent 图标
export const AGENT_ICONS: Record<SubagentType, string> = {
  coordinator: "🎯",
  reader: "📖",
  coder: "💻",
  reviewer: "🔍",
};

// 工具图标
export const TOOL_ICONS: Record<string, string> = {
  Read: "📖",
  Write: "✏️",
  Edit: "✏️",
  Bash: "⚡",
  Glob: "🔍",
  Grep: "🔍",
  Task: "🤖",
  WebFetch: "🌐",
  WebSearch: "🌐",
  Skill: "✨",
  TodoWrite: "📋",
  LSP: "🔗",
  NotebookEdit: "📓",
  // MCP 工具
  send_message: "💬",
  broadcast: "📢",
  dispatch_to_agent: "➡️",
  read_shared: "📥",
  write_shared: "📤",
};

// 关键词到 Agent 的映射
export const AGENT_KEYWORDS: Record<SubagentType, string[]> = {
  coder: [
    "修改", "添加", "实现", "写", "创建", "修复", "fix", "重构",
    "add", "implement", "write", "create", "modify", "update", "refactor",
    "生成", "generate", "make", "build", "delete", "删除", "remove",
  ],
  reviewer: [
    "审查", "检查", "review", "check", "审核", "bug", "安全",
    "security", "vulnerability", "issue", "问题", "quality", "质量",
  ],
  reader: [
    "分析", "阅读", "理解", "解释", "查看", "看看", "了解",
    "analyze", "read", "understand", "explain", "look", "what is", "how does",
    "structure", "结构", "architecture", "架构",
  ],
  coordinator: [], // 默认，无特定关键词
};

// Skill 到 Agent 的映射
export const SKILL_AGENT_MAP: Record<string, SubagentType> = {
  "code-review": "reviewer",
  "git-commit": "coder",
  "pdf-analyze": "reader",
  "debug-complex": "coordinator",
};
