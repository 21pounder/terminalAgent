/**
 * Skills Registry
 */
import type { Skill, SkillContext, SkillResult } from "./types.js";
import { LLMClient } from "../llm/index.js";
import { config } from "../utils/config.js";

// Import all Skills from consolidated files
import { explainSkill, reviewSkill, refactorSkill } from "./code.js";
import { commitSkill, diffSkill, prSkill } from "./git.js";
import { findSkill, grepSkill, symbolSkill } from "./search.js";
import { testSkill, buildSkill, lintSkill } from "./run.js";

// Register all Skills
const skillRegistry: Map<string, Skill> = new Map();

// Code Skills
skillRegistry.set("explain", explainSkill);
skillRegistry.set("review", reviewSkill);
skillRegistry.set("refactor", refactorSkill);

// Git Skills
skillRegistry.set("commit", commitSkill);
skillRegistry.set("diff", diffSkill);
skillRegistry.set("pr", prSkill);

// Search Skills
skillRegistry.set("find", findSkill);
skillRegistry.set("grep", grepSkill);
skillRegistry.set("symbol", symbolSkill);

// Run Skills
skillRegistry.set("test", testSkill);
skillRegistry.set("build", buildSkill);
skillRegistry.set("lint", lintSkill);

/**
 * Get a Skill
 */
export function getSkill(name: string): Skill | undefined {
  return skillRegistry.get(name);
}

/**
 * Get all Skills
 */
export function getAllSkills(): Skill[] {
  return Array.from(skillRegistry.values());
}

/**
 * List all available Skills
 */
export function listSkills(): string {
  const skills = getAllSkills();
  const lines = skills.map((s) => `  /${s.name.padEnd(10)} - ${s.description}`);
  return `Available Skills:\n\n${lines.join("\n")}`;
}

/**
 * Parse command line arguments
 */
export function parseArgs(input: string): { name: string; args: Record<string, string> } {
  const parts = input.trim().split(/\s+/);
  let name = parts[0];

  // Remove leading /
  if (name.startsWith("/")) {
    name = name.slice(1);
  }

  const args: Record<string, string> = {};
  let i = 1;

  while (i < parts.length) {
    const part = parts[i];

    if (part.startsWith("--")) {
      const key = part.slice(2);
      const nextPart = parts[i + 1];

      if (nextPart && !nextPart.startsWith("--")) {
        args[key] = nextPart;
        i += 2;
      } else {
        args[key] = "true";
        i += 1;
      }
    } else if (part.startsWith("-")) {
      const key = part.slice(1);
      const nextPart = parts[i + 1];

      if (nextPart && !nextPart.startsWith("-")) {
        args[key] = nextPart;
        i += 2;
      } else {
        args[key] = "true";
        i += 1;
      }
    } else {
      // Positional argument, use skill's first required arg name
      const skill = getSkill(name);
      if (skill?.args) {
        const firstArg = skill.args.find((a) => a.required);
        if (firstArg && !args[firstArg.name]) {
          args[firstArg.name] = part;
        }
      }
      i += 1;
    }
  }

  return { name, args };
}

/**
 * Execute a Skill
 */
export async function runSkill(input: string): Promise<SkillResult> {
  const { name, args } = parseArgs(input);

  const skill = getSkill(name);
  if (!skill) {
    return {
      success: false,
      output: `Unknown Skill: ${name}\n\n${listSkills()}`,
    };
  }

  const ctx: SkillContext = {
    cwd: config.workingDir,
    llm: new LLMClient(),
    args,
  };

  try {
    return await skill.execute(ctx);
  } catch (error) {
    return {
      success: false,
      output: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Export types
export type { Skill, SkillContext, SkillResult } from "./types.js";
