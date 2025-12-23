/**
 * 搜索工具
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "../utils/config.js";

const execAsync = promisify(exec);

/**
 * Glob 文件搜索
 */
export async function glob(pattern: string, cwd?: string): Promise<string[]> {
  const searchDir = cwd || config.workingDir;

  try {
    let cmd: string;

    if (process.platform === "win32") {
      // Windows: 使用 dir 命令
      let filePattern = pattern;
      let searchCwd = searchDir;

      // 提取目录前缀
      const pathMatch = pattern.match(/^([^*]+)[\\/]/);
      if (pathMatch) {
        const dir = pathMatch[1].replace(/\//g, "\\");
        const fullDir = path.join(searchDir, dir);
        if (fs.existsSync(fullDir)) {
          searchCwd = fullDir;
        }
        filePattern = pattern.substring(pathMatch[0].length);
      }

      // 移除 ** 保留文件模式
      filePattern = filePattern.replace(/^\*\*[\\/]?/, "");
      if (!filePattern) filePattern = "*.*";

      cmd = `dir /s /b "${filePattern}" 2>nul`;
      const { stdout } = await execAsync(cmd, { cwd: searchCwd });
      return stdout.trim().split("\n").filter(Boolean);
    } else {
      // Unix: 使用 find 命令
      if (pattern.includes("/")) {
        cmd = `find . -path "./${pattern}" -type f 2>/dev/null | head -100`;
      } else {
        cmd = `find . -name "${pattern}" -type f 2>/dev/null | head -100`;
      }
      const { stdout } = await execAsync(cmd, { cwd: searchDir });
      return stdout.trim().split("\n").filter(Boolean);
    }
  } catch {
    return [];
  }
}

/**
 * Grep 内容搜索
 */
export async function grep(
  pattern: string,
  searchPath?: string,
  options?: { include?: string; maxResults?: number }
): Promise<string> {
  const targetPath = searchPath || ".";
  const maxResults = options?.maxResults || 50;

  try {
    let cmd: string;

    if (process.platform === "win32") {
      const include = options?.include || "*.*";
      cmd = `findstr /s /n /r "${pattern}" ${targetPath}\\${include} 2>nul`;
    } else {
      const includeArg = options?.include ? `--include="${options.include}"` : "";
      cmd = `grep -rn ${includeArg} "${pattern}" ${targetPath} 2>/dev/null | head -${maxResults}`;
    }

    const { stdout } = await execAsync(cmd, { cwd: config.workingDir });
    return stdout.trim() || "No matches found.";
  } catch {
    return "No matches found.";
  }
}

/**
 * 查找符号定义（简单实现）
 */
export async function findSymbol(
  symbolName: string,
  filePattern?: string
): Promise<string> {
  // 搜索常见的定义模式
  const patterns = [
    `function\\s+${symbolName}`,
    `class\\s+${symbolName}`,
    `const\\s+${symbolName}`,
    `let\\s+${symbolName}`,
    `var\\s+${symbolName}`,
    `interface\\s+${symbolName}`,
    `type\\s+${symbolName}`,
    `export\\s+(default\\s+)?${symbolName}`,
  ];

  const results: string[] = [];

  for (const pattern of patterns) {
    const result = await grep(pattern, ".", { include: filePattern || "*.ts" });
    if (result !== "No matches found.") {
      results.push(result);
    }
  }

  return results.length > 0 ? results.join("\n") : `Symbol '${symbolName}' not found.`;
}
