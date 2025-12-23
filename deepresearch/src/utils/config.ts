/**
 * 配置加载模块
 */
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

// 手动加载 .env 文件（优先于环境变量）
function loadEnvFile(): Record<string, string> {
  // 尝试多个可能的路径
  const possiblePaths = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "..", ".env"),
  ];

  // 如果在 ESM 模块中，添加基于文件位置的路径
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    possiblePaths.unshift(path.join(__dirname, "..", "..", ".env"));
  } catch {
    // 忽略
  }

  const env: Record<string, string> = {};

  for (const envPath of possiblePaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const eqIndex = trimmed.indexOf("=");
            if (eqIndex > 0) {
              const key = trimmed.slice(0, eqIndex).trim();
              const value = trimmed.slice(eqIndex + 1).trim();
              env[key] = value;
            }
          }
        }
        break; // 找到就停止
      }
    } catch {
      // 继续尝试下一个路径
    }
  }

  return env;
}

const envFile = loadEnvFile();

export const config = {
  // .env 文件优先于环境变量
  apiKey: envFile.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "",
  baseUrl: envFile.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
  model: envFile.MODEL || process.env.MODEL || "claude-sonnet-4-20250514",
  maxTokens: parseInt(envFile.MAX_TOKENS || process.env.MAX_TOKENS || "4096", 10),
  workingDir: process.cwd(),
};

export function validateConfig(): void {
  if (!config.apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Please set it in .env or environment.");
  }
}
