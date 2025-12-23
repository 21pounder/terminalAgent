/**
 * Code Skills - explain, review, refactor
 */
import type { Skill } from "./types.js";
import { success, failure } from "./types.js";
import { readFile, writeFile, fileExists, glob } from "../tools/index.js";

/**
 * /explain - Explain code
 */
export const explainSkill: Skill = {
  name: "explain",
  description: "Explain the functionality of a file or code snippet",
  usage: "/explain <file> [--lines start:end]",
  args: [
    { name: "file", description: "File path to explain", required: true },
    { name: "lines", description: "Line range, e.g. 10:20", required: false },
  ],

  async execute(ctx) {
    const { file, lines } = ctx.args;

    if (!file) {
      return failure("Please specify a file path to explain");
    }

    if (!(await fileExists(file))) {
      return failure(`File not found: ${file}`);
    }

    let content = await readFile(file);

    if (lines) {
      const [start, end] = lines.split(":").map(Number);
      const allLines = content.split("\n");
      const selectedLines = allLines.slice(start - 1, end);
      content = selectedLines.join("\n");
    }

    const prompt = `Please explain the functionality and implementation logic of the following code:

File: ${file}${lines ? ` (lines ${lines})` : ""}

\`\`\`
${content}
\`\`\`

Please explain concisely:
1. Main functionality of this code
2. Key implementation logic
3. Important functions/classes/variables and their purposes`;

    const explanation = await ctx.llm.complete(prompt);

    return success(explanation);
  },
};

/**
 * /review - Code review
 */
export const reviewSkill: Skill = {
  name: "review",
  description: "Review code, find potential issues and improvement suggestions",
  usage: "/review <file|pattern>",
  args: [
    { name: "file", description: "File or glob pattern to review", required: true },
  ],

  async execute(ctx) {
    const { file } = ctx.args;

    if (!file) {
      return failure("Please specify a file to review");
    }

    let filesToReview: string[] = [];

    if (file.includes("*")) {
      filesToReview = await glob(file);
      if (filesToReview.length === 0) {
        return failure(`No matching files found: ${file}`);
      }
      if (filesToReview.length > 5) {
        filesToReview = filesToReview.slice(0, 5);
      }
    } else {
      if (!(await fileExists(file))) {
        return failure(`File not found: ${file}`);
      }
      filesToReview = [file];
    }

    const fileContents: string[] = [];
    for (const f of filesToReview) {
      const content = await readFile(f);
      fileContents.push(`=== ${f} ===\n${content}`);
    }

    const prompt = `Please review the following code, find potential issues and improvement suggestions:

${fileContents.join("\n\n")}

Please provide:
1. Code quality rating (1-10)
2. Issues found (sorted by severity)
3. Improvement suggestions
4. Security considerations (if any)

Format: Use Markdown, list issues as bullet points`;

    const review = await ctx.llm.complete(prompt);

    return success(review);
  },
};

/**
 * /refactor - Refactor code
 */
export const refactorSkill: Skill = {
  name: "refactor",
  description: "Refactor code in a specified file",
  usage: "/refactor <file> [--goal <goal>]",
  args: [
    { name: "file", description: "File path to refactor", required: true },
    { name: "goal", description: "Refactoring goal, e.g. 'extract function' 'simplify logic'", required: false },
  ],

  async execute(ctx) {
    const { file, goal } = ctx.args;

    if (!file) {
      return failure("Please specify a file path to refactor");
    }

    if (!(await fileExists(file))) {
      return failure(`File not found: ${file}`);
    }

    const content = await readFile(file);
    const rawContent = content
      .split("\n")
      .map((line) => line.replace(/^\s*\d+│/, ""))
      .join("\n");

    const goalText = goal || "improve code quality, readability, and maintainability";
    const prompt = `Please refactor the following code, goal: ${goalText}

File: ${file}

Original code:
\`\`\`
${rawContent}
\`\`\`

Requirements:
1. Keep functionality unchanged
2. Output only the refactored complete code
3. Do not add explanations, only output code
4. Maintain original code style (indentation, quotes, etc.)`;

    const refactored = await ctx.llm.complete(prompt);

    const codeMatch = refactored.match(/```[\w]*\n([\s\S]*?)```/);
    const newCode = codeMatch ? codeMatch[1].trim() : refactored.trim();

    await writeFile(file, newCode);

    return success(`Refactored ${file}\n\nRefactoring goal: ${goalText}`, [file]);
  },
};
