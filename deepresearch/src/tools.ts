/**
 * Tool 定义和执行逻辑
 * 为 Anthropic SDK 实现文件操作和命令执行工具
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool, MessageParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";

const execAsync = promisify(exec);

// 工具定义
export const toolDefinitions: Tool[] = [
  {
    name: "Glob",
    description: "Find files matching a glob pattern. Returns a list of file paths.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern to match files (e.g., '**/*.ts', 'src/**/*.tsx')"
        },
        cwd: {
          type: "string",
          description: "Directory to search in (default: current working directory)"
        }
      },
      required: ["pattern"]
    }
  },
  {
    name: "Grep",
    description: "Search for a pattern in files. Returns matching lines with file paths and line numbers.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description: "Regular expression pattern to search for"
        },
        path: {
          type: "string",
          description: "File or directory to search in (default: current directory)"
        },
        include: {
          type: "string",
          description: "Glob pattern to filter files (e.g., '*.ts')"
        }
      },
      required: ["pattern"]
    }
  },
  {
    name: "Read",
    description: "Read the contents of a file.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file to read"
        }
      },
      required: ["file_path"]
    }
  },
  {
    name: "Write",
    description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file to write"
        },
        content: {
          type: "string",
          description: "Content to write to the file"
        }
      },
      required: ["file_path", "content"]
    }
  },
  {
    name: "Edit",
    description: "Edit a file by replacing text. The old_string must match exactly.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file to edit"
        },
        old_string: {
          type: "string",
          description: "The exact text to replace"
        },
        new_string: {
          type: "string",
          description: "The replacement text"
        }
      },
      required: ["file_path", "old_string", "new_string"]
    }
  },
  {
    name: "Bash",
    description: "Execute a shell command and return the output.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute"
        },
        cwd: {
          type: "string",
          description: "Working directory for the command (default: current directory)"
        }
      },
      required: ["command"]
    }
  }
];

// 工具执行函数
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  workingDir: string
): Promise<string> {
  try {
    switch (toolName) {
      case "Glob":
        return await executeGlob(toolInput, workingDir);
      case "Grep":
        return await executeGrep(toolInput, workingDir);
      case "Read":
        return await executeRead(toolInput, workingDir);
      case "Write":
        return await executeWrite(toolInput, workingDir);
      case "Edit":
        return await executeEdit(toolInput, workingDir);
      case "Bash":
        return await executeBash(toolInput, workingDir);
      default:
        return `Error: Unknown tool '${toolName}'`;
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function executeGlob(input: Record<string, unknown>, workingDir: string): Promise<string> {
  const pattern = String(input.pattern);
  const cwd = input.cwd ? String(input.cwd) : workingDir;

  // 使用 Node.js 的 glob 功能（通过 find 命令模拟）
  try {
    const { stdout } = await execAsync(
      `find . -type f -name "${pattern.replace(/\*\*/g, '*')}" 2>/dev/null | head -100`,
      { cwd }
    );
    const files = stdout.trim().split('\n').filter(Boolean);
    if (files.length === 0) {
      return "No files found matching the pattern.";
    }
    return `Found ${files.length} files:\n${files.join('\n')}`;
  } catch {
    // Windows 备用方案
    try {
      const { stdout } = await execAsync(
        `dir /s /b "${pattern}" 2>nul`,
        { cwd, shell: "cmd.exe" }
      );
      const files = stdout.trim().split('\n').filter(Boolean);
      if (files.length === 0) {
        return "No files found matching the pattern.";
      }
      return `Found ${files.length} files:\n${files.join('\n')}`;
    } catch {
      return "Error: Could not execute glob search.";
    }
  }
}

async function executeGrep(input: Record<string, unknown>, workingDir: string): Promise<string> {
  const pattern = String(input.pattern);
  const searchPath = input.path ? String(input.path) : ".";
  const include = input.include ? String(input.include) : "";

  try {
    let cmd: string;
    if (process.platform === "win32") {
      cmd = `findstr /s /n /r "${pattern}" ${include || "*.*"}`;
    } else {
      const includeArg = include ? `--include="${include}"` : "";
      cmd = `grep -rn ${includeArg} "${pattern}" ${searchPath} 2>/dev/null | head -50`;
    }

    const { stdout } = await execAsync(cmd, { cwd: workingDir });
    if (!stdout.trim()) {
      return "No matches found.";
    }
    return stdout.trim();
  } catch {
    return "No matches found or error executing search.";
  }
}

async function executeRead(input: Record<string, unknown>, workingDir: string): Promise<string> {
  const filePath = String(input.file_path);
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workingDir, filePath);

  if (!fs.existsSync(fullPath)) {
    return `Error: File not found: ${fullPath}`;
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const lines = content.split('\n');

  // 添加行号
  const numberedLines = lines.map((line, i) => `${String(i + 1).padStart(4)}│${line}`);
  return numberedLines.join('\n');
}

async function executeWrite(input: Record<string, unknown>, workingDir: string): Promise<string> {
  const filePath = String(input.file_path);
  const content = String(input.content);
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workingDir, filePath);

  // 确保目录存在
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(fullPath, content, "utf-8");
  return `Successfully wrote ${content.length} characters to ${filePath}`;
}

async function executeEdit(input: Record<string, unknown>, workingDir: string): Promise<string> {
  const filePath = String(input.file_path);
  const oldString = String(input.old_string);
  const newString = String(input.new_string);
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workingDir, filePath);

  if (!fs.existsSync(fullPath)) {
    return `Error: File not found: ${fullPath}`;
  }

  const content = fs.readFileSync(fullPath, "utf-8");

  if (!content.includes(oldString)) {
    return `Error: Could not find the text to replace. Make sure old_string matches exactly.`;
  }

  const occurrences = content.split(oldString).length - 1;
  if (occurrences > 1) {
    return `Error: Found ${occurrences} occurrences of the text. old_string must be unique. Add more context.`;
  }

  const newContent = content.replace(oldString, newString);
  fs.writeFileSync(fullPath, newContent, "utf-8");
  return `Successfully edited ${filePath}`;
}

async function executeBash(input: Record<string, unknown>, workingDir: string): Promise<string> {
  const command = String(input.command);
  const cwd = input.cwd ? String(input.cwd) : workingDir;

  // 安全检查 - 拒绝危险命令
  const dangerousPatterns = [
    /rm\s+-rf\s+[\/~]/,
    /rm\s+-rf\s+\*/,
    />\s*\/dev\/sd/,
    /mkfs\./,
    /dd\s+if=/,
    /:(){ :|:& };:/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return `Error: Command rejected for safety reasons.`;
    }
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 60000, // 60 秒超时
      maxBuffer: 1024 * 1024 // 1MB 缓冲
    });

    let result = "";
    if (stdout.trim()) {
      result += stdout.trim();
    }
    if (stderr.trim()) {
      result += (result ? "\n\n" : "") + "STDERR:\n" + stderr.trim();
    }
    return result || "Command executed successfully (no output).";
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message: string };
    let result = `Error executing command: ${execError.message}`;
    if (execError.stdout) result += `\nSTDOUT:\n${execError.stdout}`;
    if (execError.stderr) result += `\nSTDERR:\n${execError.stderr}`;
    return result;
  }
}

// 获取特定 subagent 可用的工具
export function getToolsForAgent(agentType: string): Tool[] {
  const toolMap: Record<string, string[]> = {
    explorer: ["Glob", "Grep", "Read"],
    coder: ["Read", "Write", "Edit", "Glob", "Grep"],
    reviewer: ["Read", "Glob", "Grep"],
    executor: ["Bash", "Read"],
    lead: [] // Lead agent 不直接使用工具，只协调
  };

  const allowedTools = toolMap[agentType] || [];
  return toolDefinitions.filter(t => allowedTools.includes(t.name));
}
