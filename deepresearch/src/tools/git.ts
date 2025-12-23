/**
 * Git 操作工具
 */
import { shell, run } from "./shell.js";
import { config } from "../utils/config.js";

/**
 * 获取 Git 状态
 */
export async function status(): Promise<string> {
  return run("git status", config.workingDir);
}

/**
 * 获取 Git diff
 */
export async function diff(staged = false): Promise<string> {
  const cmd = staged ? "git diff --staged" : "git diff";
  return run(cmd, config.workingDir);
}

/**
 * 添加文件到暂存区
 */
export async function add(files: string | string[] = "."): Promise<string> {
  const fileList = Array.isArray(files) ? files.join(" ") : files;
  return run(`git add ${fileList}`, config.workingDir);
}

/**
 * 提交更改
 */
export async function commit(message: string): Promise<string> {
  // 转义消息中的特殊字符
  const escapedMessage = message.replace(/"/g, '\\"');
  return run(`git commit -m "${escapedMessage}"`, config.workingDir);
}

/**
 * 获取最近的提交日志
 */
export async function log(count = 5): Promise<string> {
  return run(`git log --oneline -${count}`, config.workingDir);
}

/**
 * 获取当前分支名
 */
export async function currentBranch(): Promise<string> {
  const result = await shell("git branch --show-current", { cwd: config.workingDir });
  return result.stdout.trim();
}

/**
 * 推送到远程
 */
export async function push(remote = "origin", branch?: string): Promise<string> {
  const branchName = branch || (await currentBranch());
  return run(`git push ${remote} ${branchName}`, config.workingDir);
}

/**
 * 拉取远程更新
 */
export async function pull(remote = "origin", branch?: string): Promise<string> {
  const branchName = branch || (await currentBranch());
  return run(`git pull ${remote} ${branchName}`, config.workingDir);
}

/**
 * 创建新分支
 */
export async function createBranch(name: string, checkout = true): Promise<string> {
  const cmd = checkout ? `git checkout -b ${name}` : `git branch ${name}`;
  return run(cmd, config.workingDir);
}

/**
 * 切换分支
 */
export async function checkout(branch: string): Promise<string> {
  return run(`git checkout ${branch}`, config.workingDir);
}

/**
 * 检查是否是 Git 仓库
 */
export async function isGitRepo(): Promise<boolean> {
  const result = await shell("git rev-parse --is-inside-work-tree", {
    cwd: config.workingDir,
  });
  return result.exitCode === 0 && result.stdout.trim() === "true";
}
