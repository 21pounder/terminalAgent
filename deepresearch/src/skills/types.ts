/**
 * Skill 类型定义
 */
import type { LLMClient } from "../llm/index.js";

/**
 * Skill 参数定义
 */
export interface SkillArg {
  name: string;
  description: string;
  required?: boolean;
  default?: string;
}

/**
 * Skill 执行上下文
 */
export interface SkillContext {
  cwd: string;
  llm: LLMClient;
  args: Record<string, string>;
}

/**
 * Skill 执行结果
 */
export interface SkillResult {
  success: boolean;
  output: string;
  artifacts?: string[]; // 产出的文件路径
}

/**
 * Skill 定义
 */
export interface Skill {
  name: string;
  description: string;
  usage: string;
  args?: SkillArg[];
  execute: (ctx: SkillContext) => Promise<SkillResult>;
}

/**
 * 创建成功结果
 */
export function success(output: string, artifacts?: string[]): SkillResult {
  return { success: true, output, artifacts };
}

/**
 * 创建失败结果
 */
export function failure(output: string): SkillResult {
  return { success: false, output };
}
