/**
 * Prompt 加载器
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_DIR = path.resolve(__dirname, "..", "prompts");

// Prompt 元数据
export interface PromptMeta {
  name?: string;
  version?: string;
  description?: string;
  [key: string]: string | undefined;
}

// Prompt 解析结果
export interface ParsedPrompt {
  meta: PromptMeta;
  content: string;
}

/**
 * 加载 Prompt 文件
 */
export function loadPrompt(filename: string): string {
  const promptPath = path.join(PROMPTS_DIR, filename);

  try {
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, "utf-8");
    }
  } catch {
    // 忽略读取错误
  }

  return "";
}

/**
 * 解析 Prompt 的 frontmatter 元数据
 */
export function parsePromptMeta(content: string): ParsedPrompt {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { meta: {}, content };
  }

  const metaStr = match[1];
  const bodyContent = match[2];
  const meta: PromptMeta = {};

  // 简单解析 YAML 格式的 frontmatter
  for (const line of metaStr.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      meta[key] = value;
    }
  }

  return { meta, content: bodyContent.trim() };
}

/**
 * 合并多个 Prompt
 */
export function mergePrompts(...prompts: string[]): string {
  return prompts.filter(Boolean).join("\n\n");
}

/**
 * 加载并合并 common.md 和指定的 prompt
 */
export function loadAgentPrompt(filename: string): string {
  const common = loadPrompt("common.md");
  const specific = loadPrompt(filename);
  return mergePrompts(common, specific);
}

/**
 * 替换 Prompt 中的变量
 * 格式: {{variable}}
 */
export function interpolatePrompt(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] ?? `{{${key}}}`;
  });
}
