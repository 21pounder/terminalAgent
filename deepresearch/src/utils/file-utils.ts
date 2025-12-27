/**
 * 文件操作工具
 */
import * as fs from "node:fs";
import * as path from "node:path";

// 二进制文件扩展名
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".exe", ".dll", ".so", ".dylib",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".mp3", ".mp4", ".avi", ".mov", ".wav",
  ".ttf", ".otf", ".woff", ".woff2",
]);

/**
 * 判断是否为二进制文件
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * 安全读取文件内容
 */
export function readFileContent(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return null;
    }

    if (isBinaryFile(filePath)) {
      return `[Binary file: ${filePath}]`;
    }

    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    return `[Error reading file: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * 获取相对路径
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * 确保目录存在
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 列出目录内容
 */
export function listDirectory(dirPath: string): string[] {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

/**
 * 检查路径是否存在
 */
export function pathExists(p: string): boolean {
  return fs.existsSync(p);
}

/**
 * 获取文件扩展名
 */
export function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * 规范化路径
 */
export function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, "/");
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 计算字符串的简单哈希
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
