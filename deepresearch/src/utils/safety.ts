/**
 * 安全检查模块
 */
import * as path from "node:path";

// 危险命令模式
const dangerousPatterns = [
  /rm\s+-rf\s+[\/~]/,
  /rm\s+-rf\s+\*/,
  /del\s+\/s\s+\/q\s+[a-z]:\\/i,
  /format\s+[a-z]:/i,
  /mkfs\./,
  /dd\s+if=/,
  />\s*\/dev\/sd/,
  /:()\s*{\s*:\s*\|\s*:\s*&\s*}\s*;?\s*:/,  // fork bomb
];

// 敏感文件模式
const sensitiveFiles = [
  /\.env$/,
  /\.env\..+$/,
  /credentials/i,
  /secrets?/i,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /id_ed25519/,
];

export function isDangerousCommand(command: string): boolean {
  return dangerousPatterns.some(pattern => pattern.test(command));
}

export function isSensitiveFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  return sensitiveFiles.some(pattern => pattern.test(basename));
}

export function isPathSafe(filePath: string, workingDir: string): boolean {
  const resolved = path.resolve(workingDir, filePath);
  return resolved.startsWith(workingDir);
}

export function sanitizeOutput(output: string, maxLength = 10000): string {
  if (output.length > maxLength) {
    return output.slice(0, maxLength) + "\n... (truncated)";
  }
  return output;
}
