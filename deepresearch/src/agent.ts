/**
 * Terminal Coding Agent - 使用 raw HTTPS 调用 API
 *
 * 由于 SDK 被代理阻止，使用原生 HTTPS 模块
 */

import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import "dotenv/config";

const execAsync = promisify(exec);

const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const BASE_URL = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
const MODEL = "claude-3-5-sonnet-20241022";
const MAX_TOKENS = 1000;
const WORKING_DIR = process.cwd();

const SYSTEM_PROMPT = 'Coding assistant. XML: <read_file><path>f</path></read_file> read, <write_file><path>f</path><content>c</content></write_file> write, <run_command><command>c</command></run_command> run, <list_files><pattern>p</pattern></list_files> list. Dir: ' + WORKING_DIR;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface APIResponse {
  content: Array<{ type: string; text?: string }>;
  stop_reason: string;
}

// 调用 API
async function callAPI(messages: Message[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: messages,
    });

    const req = https.request({
      hostname: "api.vectorengine.ai",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API Error ${res.statusCode}: ${body}`));
          return;
        }
        try {
          const response: APIResponse = JSON.parse(body);
          const text = response.content
            .filter((b) => b.type === "text")
            .map((b) => b.text || "")
            .join("");
          resolve(text);
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(data);
    req.end();
  });
}

// 解析和执行命令
async function parseAndExecuteCommands(text: string): Promise<string[]> {
  const results: string[] = [];

  // Read file
  const readMatches = text.matchAll(/<read_file>\s*<path>(.*?)<\/path>\s*<\/read_file>/gs);
  for (const match of readMatches) {
    const filePath = match[1].trim();
    results.push(await executeRead(filePath));
  }

  // Write file
  const writeMatches = text.matchAll(/<write_file>\s*<path>(.*?)<\/path>\s*<content>(.*?)<\/content>\s*<\/write_file>/gs);
  for (const match of writeMatches) {
    const filePath = match[1].trim();
    const content = match[2];
    results.push(await executeWrite(filePath, content));
  }

  // Run command
  const cmdMatches = text.matchAll(/<run_command>\s*<command>(.*?)<\/command>\s*<\/run_command>/gs);
  for (const match of cmdMatches) {
    const command = match[1].trim();
    results.push(await executeCommand(command));
  }

  // List files
  const listMatches = text.matchAll(/<list_files>\s*<pattern>(.*?)<\/pattern>\s*<\/list_files>/gs);
  for (const match of listMatches) {
    const pattern = match[1].trim();
    results.push(await executeList(pattern));
  }

  // Search
  const searchMatches = text.matchAll(/<search>\s*<pattern>(.*?)<\/pattern>\s*<path>(.*?)<\/path>\s*<\/search>/gs);
  for (const match of searchMatches) {
    const pattern = match[1].trim();
    const searchPath = match[2].trim();
    results.push(await executeSearch(pattern, searchPath));
  }

  return results;
}

async function executeRead(filePath: string): Promise<string> {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(WORKING_DIR, filePath);
  try {
    if (!fs.existsSync(fullPath)) {
      return `[read_file] Error: File not found: ${filePath}`;
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split('\n').map((l, i) => `${i + 1}│${l}`).join('\n');
    return `[read_file: ${filePath}]\n${lines}`;
  } catch (e) {
    return `[read_file] Error: ${e instanceof Error ? e.message : e}`;
  }
}

async function executeWrite(filePath: string, content: string): Promise<string> {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(WORKING_DIR, filePath);
  try {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const cleanContent = content.replace(/^\n/, '');
    fs.writeFileSync(fullPath, cleanContent, "utf-8");
    return `[write_file] Successfully wrote to ${filePath} (${cleanContent.length} chars)`;
  } catch (e) {
    return `[write_file] Error: ${e instanceof Error ? e.message : e}`;
  }
}

async function executeCommand(command: string): Promise<string> {
  // 安全检查
  const dangerous = [/rm\s+-rf\s+[\/~]/, /rm\s+-rf\s+\*/, /mkfs\./, /dd\s+if=/];
  for (const pattern of dangerous) {
    if (pattern.test(command)) {
      return `[run_command] Blocked: Dangerous command`;
    }
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: WORKING_DIR,
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    let result = `[run_command: ${command}]\n`;
    if (stdout.trim()) result += stdout.trim();
    if (stderr.trim()) result += `\nSTDERR: ${stderr.trim()}`;
    return result || `[run_command] Completed (no output)`;
  } catch (e) {
    const err = e as { message: string; stdout?: string; stderr?: string };
    return `[run_command] Error: ${err.message}`;
  }
}

async function executeList(pattern: string): Promise<string> {
  try {
    let cmd: string;
    let cwd = WORKING_DIR;

    if (process.platform === "win32") {
      // Windows: handle patterns like "src/**/*.ts" or "src/*.ts" or "*.ts"
      let filePattern = pattern;

      // Extract directory prefix if present
      const pathMatch = pattern.match(/^([^*]+)[\\/]/);
      if (pathMatch) {
        const dir = pathMatch[1].replace(/\//g, '\\');
        const fullDir = path.join(WORKING_DIR, dir);
        if (fs.existsSync(fullDir)) {
          cwd = fullDir;
        }
        filePattern = pattern.substring(pathMatch[0].length);
      }

      // Remove ** and keep just the file pattern
      filePattern = filePattern.replace(/^\*\*[\\/]?/, '');
      if (!filePattern) filePattern = '*.*';

      cmd = `dir /s /b "${filePattern}" 2>nul`;
    } else {
      // Unix: handle path-based patterns properly
      if (pattern.includes('/')) {
        cmd = `find . -path "./${pattern}" -type f 2>/dev/null | head -50`;
      } else {
        cmd = `find . -name "${pattern}" -type f 2>/dev/null | head -50`;
      }
    }

    const { stdout } = await execAsync(cmd, { cwd });
    const files = stdout.trim().split('\n').filter(Boolean);
    return `[list_files: ${pattern}]\n${files.length > 0 ? files.join('\n') : 'No files found'}`;
  } catch {
    return `[list_files] No files found matching: ${pattern}`;
  }
}

async function executeSearch(pattern: string, searchPath: string): Promise<string> {
  try {
    const cmd = process.platform === "win32"
      ? `findstr /s /n "${pattern}" "${searchPath}\\*.*" 2>nul`
      : `grep -rn "${pattern}" ${searchPath} 2>/dev/null | head -30`;
    const { stdout } = await execAsync(cmd, { cwd: WORKING_DIR });
    return `[search: "${pattern}" in ${searchPath}]\n${stdout.trim() || 'No matches'}`;
  } catch {
    return `[search] No matches found for: ${pattern}`;
  }
}

function hasCommands(text: string): boolean {
  return /<(read_file|write_file|run_command|list_files|search)>/.test(text);
}

class CodingAgent {
  private messages: Message[] = [];

  async chat(userMessage: string): Promise<void> {
    this.messages.push({ role: "user", content: userMessage });

    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      iterations++;

      const text = await callAPI(this.messages);

      // 显示响应
      process.stdout.write(text);

      this.messages.push({ role: "assistant", content: text });

      // 检查是否有命令需要执行
      if (!hasCommands(text)) {
        break;
      }

      // 执行命令
      console.log("\n");
      const results = await parseAndExecuteCommands(text);

      if (results.length === 0) {
        break;
      }

      // 显示结果
      for (const result of results) {
        console.log(result.slice(0, 500) + (result.length > 500 ? '...' : ''));
        console.log();
      }

      // 将结果添加到对话
      const resultText = results.join("\n\n");
      this.messages.push({ role: "user", content: `Command results:\n\n${resultText}` });
    }
  }

  clearHistory(): void {
    this.messages = [];
  }
}

async function main(): Promise<void> {
  if (!API_KEY) {
    console.log("\nError: ANTHROPIC_API_KEY not found in .env\n");
    return;
  }

  const agent = new CodingAgent();

  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║       Terminal Coding Agent v2.2           ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log("\nCommands: read_file, write_file, run_command, list_files, search");
  console.log(`Working directory: ${WORKING_DIR}`);
  console.log("Type 'exit' to quit, 'clear' to reset.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question("\nYou: ", (answer) => resolve(answer.trim()));
    });
  };

  try {
    while (true) {
      const input = await askQuestion();

      if (!input) continue;
      if (["exit", "quit", "q"].includes(input.toLowerCase())) break;
      if (input.toLowerCase() === "clear") {
        agent.clearHistory();
        console.log("Cleared.");
        continue;
      }

      console.log("\nAgent: ");
      try {
        await agent.chat(input);
        console.log();
      } catch (error) {
        console.error("\nError:", error instanceof Error ? error.message : error);
      }
    }
  } finally {
    rl.close();
    console.log("\nGoodbye!");
  }
}

main().catch(console.error);
