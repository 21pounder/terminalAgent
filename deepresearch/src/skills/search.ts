/**
 * Search Skills - find, grep, symbol
 */
import type { Skill } from "./types.js";
import { success, failure } from "./types.js";
import { glob, grep, findSymbol } from "../tools/index.js";

/**
 * /find - Find files
 */
export const findSkill: Skill = {
  name: "find",
  description: "Find files by pattern",
  usage: "/find <pattern>",
  args: [
    { name: "pattern", description: "File pattern, e.g. *.ts, src/**/*.tsx", required: true },
  ],

  async execute(ctx) {
    const { pattern } = ctx.args;

    if (!pattern) {
      return failure("Please specify a search pattern");
    }

    const files = await glob(pattern);

    if (files.length === 0) {
      return success(`No files matching "${pattern}" found`);
    }

    const output = `Found ${files.length} files:\n\n${files.join("\n")}`;
    return success(output);
  },
};

/**
 * /grep - Search content
 */
export const grepSkill: Skill = {
  name: "grep",
  description: "Search content in files",
  usage: "/grep <pattern> [--path <path>] [--include <file pattern>]",
  args: [
    { name: "pattern", description: "Search pattern (regex)", required: true },
    { name: "path", description: "Search path (default: current directory)", required: false },
    { name: "include", description: "File filter, e.g. *.ts", required: false },
  ],

  async execute(ctx) {
    const { pattern, path, include } = ctx.args;

    if (!pattern) {
      return failure("Please specify a search pattern");
    }

    const result = await grep(pattern, path || ".", { include });

    return success(result);
  },
};

/**
 * /symbol - Find symbol definitions
 */
export const symbolSkill: Skill = {
  name: "symbol",
  description: "Find symbol (function, class, variable) definitions",
  usage: "/symbol <name> [--type <ts|js|py>]",
  args: [
    { name: "name", description: "Symbol name", required: true },
    { name: "type", description: "File type (default: ts)", required: false },
  ],

  async execute(ctx) {
    const { name, type } = ctx.args;

    if (!name) {
      return failure("Please specify a symbol name");
    }

    const filePattern = type ? `*.${type}` : "*.ts";
    const result = await findSymbol(name, filePattern);

    return success(result);
  },
};
