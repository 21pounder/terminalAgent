/**
 * Shell 执行工具
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../utils/config.js";
import { isDangerousCommand, sanitizeOutput } from "../utils/safety.js";

const execAsync = promisify(exec);

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * 执行 Shell 命令
 */
export async function shell(
  command: string,
  options?: {
    cwd?: string;
    timeout?: number;
    maxBuffer?: number;
  }
): Promise<ShellResult> {
  // 安全检查
  if (isDangerousCommand(command)) {
    throw new Error("Command rejected for safety reasons.");
  }

  const cwd = options?.cwd || config.workingDir;
  const timeout = options?.timeout || 60000; // 默认 60 秒
  const maxBuffer = options?.maxBuffer || 1024 * 1024; // 默认 1MB

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer,
    });

    return {
      stdout: sanitizeOutput(stdout.trim()),
      stderr: sanitizeOutput(stderr.trim()),
      exitCode: 0,
    };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
      message: string;
    };

    return {
      stdout: sanitizeOutput(execError.stdout?.trim() || ""),
      stderr: sanitizeOutput(execError.stderr?.trim() || execError.message),
      exitCode: execError.code || 1,
    };
  }
}

/**
 * 执行命令并返回格式化输出
 */
export async function run(command: string, cwd?: string): Promise<string> {
  const result = await shell(command, { cwd });

  let output = "";
  if (result.stdout) {
    output += result.stdout;
  }
  if (result.stderr) {
    output += (output ? "\n\nSTDERR:\n" : "STDERR:\n") + result.stderr;
  }
  if (!output) {
    output = result.exitCode === 0
      ? "Command executed successfully (no output)."
      : `Command failed with exit code ${result.exitCode}`;
  }

  return output;
}
