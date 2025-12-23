/**
 * 文件操作工具
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "../utils/config.js";
import { isPathSafe, isSensitiveFile } from "../utils/safety.js";

/**
 * 读取文件内容
 */
export async function readFile(filePath: string): Promise<string> {
  const fullPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(config.workingDir, filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");

  // 添加行号
  const numbered = lines.map((line, i) => `${String(i + 1).padStart(4)}│${line}`);
  return numbered.join("\n");
}

/**
 * 写入文件
 */
export async function writeFile(filePath: string, content: string): Promise<string> {
  const fullPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(config.workingDir, filePath);

  if (!isPathSafe(fullPath, config.workingDir)) {
    throw new Error(`Path is outside working directory: ${filePath}`);
  }

  if (isSensitiveFile(filePath)) {
    throw new Error(`Cannot write to sensitive file: ${filePath}`);
  }

  // 确保目录存在
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(fullPath, content, "utf-8");
  return `Successfully wrote ${content.length} characters to ${filePath}`;
}

/**
 * 编辑文件（替换文本）
 */
export async function editFile(
  filePath: string,
  oldString: string,
  newString: string
): Promise<string> {
  const fullPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(config.workingDir, filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(fullPath, "utf-8");

  if (!content.includes(oldString)) {
    throw new Error(`Could not find the text to replace. Make sure old_string matches exactly.`);
  }

  const occurrences = content.split(oldString).length - 1;
  if (occurrences > 1) {
    throw new Error(
      `Found ${occurrences} occurrences of the text. old_string must be unique. Add more context.`
    );
  }

  const newContent = content.replace(oldString, newString);
  fs.writeFileSync(fullPath, newContent, "utf-8");
  return `Successfully edited ${filePath}`;
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  const fullPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(config.workingDir, filePath);
  return fs.existsSync(fullPath);
}

/**
 * 获取文件信息
 */
export async function fileInfo(filePath: string): Promise<{
  exists: boolean;
  size?: number;
  isDirectory?: boolean;
  modified?: Date;
}> {
  const fullPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(config.workingDir, filePath);

  if (!fs.existsSync(fullPath)) {
    return { exists: false };
  }

  const stats = fs.statSync(fullPath);
  return {
    exists: true,
    size: stats.size,
    isDirectory: stats.isDirectory(),
    modified: stats.mtime,
  };
}
