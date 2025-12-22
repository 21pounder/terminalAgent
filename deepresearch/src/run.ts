/**
 * 单次查询测试 - 使用 raw HTTPS 调用 API
 */
import * as https from "node:https";
import * as fs from "node:fs";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import "dotenv/config";

const execAsync = promisify(exec);

const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const BASE_URL = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
const MODEL = "claude-3-5-sonnet-20241022";
const WORKING_DIR = process.cwd();

const SYSTEM_PROMPT = 'Coding assistant. XML: <read_file><path>f</path></read_file> read, <list_files><pattern>p</pattern></list_files> list, <run_command><command>c</command></run_command> run. Dir: ' + WORKING_DIR;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface APIResponse {
  content: Array<{ type: string; text?: string }>;
}

async function callAPI(messages: Message[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: MODEL,
      max_tokens: 500,
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

async function parseAndExecuteCommands(text: string): Promise<string[]> {
  const results: string[] = [];

  // Read file
  const readMatches = text.matchAll(/<read_file>\s*<path>(.*?)<\/path>\s*<\/read_file>/gs);
  for (const match of readMatches) {
    const filePath = match[1].trim();
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(WORKING_DIR, filePath);
    try {
      if (!fs.existsSync(fullPath)) {
        results.push(`[read_file] Error: File not found: ${filePath}`);
      } else {
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split('\n').slice(0, 50).map((l, i) => `${i + 1}│${l}`).join('\n');
        results.push(`[read_file: ${filePath}]\n${lines}${content.split('\n').length > 50 ? '\n... (truncated)' : ''}`);
      }
    } catch (e) {
      results.push(`[read_file] Error: ${e instanceof Error ? e.message : e}`);
    }
  }

  // List files
  const listMatches = text.matchAll(/<list_files>\s*<pattern>(.*?)<\/pattern>\s*<\/list_files>/gs);
  for (const match of listMatches) {
    const pattern = match[1].trim();
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
          cmd = `find . -path "./${pattern}" -type f 2>/dev/null | head -20`;
        } else {
          cmd = `find . -name "${pattern}" -type f 2>/dev/null | head -20`;
        }
      }

      const { stdout } = await execAsync(cmd, { cwd });
      const files = stdout.trim().split('\n').filter(Boolean);
      results.push(`[list_files: ${pattern}]\n${files.length > 0 ? files.join('\n') : 'No files found'}`);
    } catch {
      results.push(`[list_files] No files found matching: ${pattern}`);
    }
  }

  // Run command
  const cmdMatches = text.matchAll(/<run_command>\s*<command>(.*?)<\/command>\s*<\/run_command>/gs);
  for (const match of cmdMatches) {
    const command = match[1].trim();
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: WORKING_DIR, timeout: 30000 });
      let result = `[run_command: ${command}]\n`;
      if (stdout.trim()) result += stdout.trim();
      if (stderr.trim()) result += `\nSTDERR: ${stderr.trim()}`;
      results.push(result || `[run_command] Completed (no output)`);
    } catch (e) {
      const err = e as { message: string };
      results.push(`[run_command] Error: ${err.message}`);
    }
  }

  return results;
}

function hasCommands(text: string): boolean {
  return /<(read_file|list_files|run_command)>/.test(text);
}

async function runQuery(query: string) {
  console.log(`\nQuery: ${query}\n`);
  console.log("─".repeat(50));

  const messages: Message[] = [{ role: "user", content: query }];

  let iterations = 0;
  const maxIterations = 5;

  while (iterations < maxIterations) {
    iterations++;

    const text = await callAPI(messages);
    console.log("\nAssistant:", text.slice(0, 1000));

    if (!hasCommands(text)) {
      break;
    }

    console.log("\n[Executing commands...]");
    const results = await parseAndExecuteCommands(text);

    if (results.length === 0) {
      break;
    }

    for (const result of results) {
      console.log(result.slice(0, 300) + (result.length > 300 ? '...' : ''));
    }

    messages.push({ role: "assistant", content: text });
    messages.push({ role: "user", content: `Command results:\n\n${results.join("\n\n")}` });
  }

  console.log("\n" + "─".repeat(50));
  console.log("Done.");
}

const query = process.argv.slice(2).join(" ") || "List the TypeScript files in the src directory";
runQuery(query).catch(console.error);
