/**
 * Git Skills - commit, diff, pr
 */
import type { Skill } from "./types.js";
import { success, failure } from "./types.js";
import * as git from "../tools/git.js";
import { run } from "../tools/shell.js";

/**
 * /commit - Commit changes
 */
export const commitSkill: Skill = {
  name: "commit",
  description: "Commit current changes to Git",
  usage: "/commit [-m <message>]",
  args: [
    { name: "m", description: "Commit message (optional, auto-generated if not provided)", required: false },
  ],

  async execute(ctx) {
    if (!(await git.isGitRepo())) {
      return failure("Current directory is not a Git repository");
    }

    const status = await git.status();
    if (status.includes("nothing to commit")) {
      return failure("No changes to commit");
    }

    const diff = await git.diff();
    let message = ctx.args.m;

    if (!message) {
      const prompt = `Generate a concise commit message (English, max 50 characters) based on the following Git diff:

${diff || "No diff available (files may be untracked)"}

Git Status:
${status}

Output only the commit message, nothing else. Format: <type>: <description>
type can be: feat, fix, docs, style, refactor, test, chore`;

      message = await ctx.llm.complete(prompt);
      message = message.trim().replace(/^["']|["']$/g, "");
    }

    await git.add(".");
    const result = await git.commit(message);

    if (result.includes("error") || result.includes("fatal")) {
      return failure(`Commit failed: ${result}`);
    }

    return success(`Committed: ${message}\n\n${result}`);
  },
};

/**
 * /diff - View Git diff
 */
export const diffSkill: Skill = {
  name: "diff",
  description: "View Git diff",
  usage: "/diff [--staged]",
  args: [
    { name: "staged", description: "Show only staged changes", required: false },
  ],

  async execute(ctx) {
    if (!(await git.isGitRepo())) {
      return failure("Current directory is not a Git repository");
    }

    const staged = ctx.args.staged === "true" || ctx.args.staged === "";
    const diff = await git.diff(staged);

    if (!diff || diff.trim() === "") {
      return success(staged ? "No staged changes" : "No unstaged changes");
    }

    return success(diff);
  },
};

/**
 * /pr - Create Pull Request
 */
export const prSkill: Skill = {
  name: "pr",
  description: "Create Pull Request",
  usage: "/pr [--title <title>] [--base <base branch>]",
  args: [
    { name: "title", description: "PR title (optional, auto-generated)", required: false },
    { name: "base", description: "Base branch (default: main)", required: false },
  ],

  async execute(ctx) {
    if (!(await git.isGitRepo())) {
      return failure("Current directory is not a Git repository");
    }

    const ghCheck = await run("gh --version");
    if (ghCheck.includes("not found") || ghCheck.includes("not recognized")) {
      return failure("GitHub CLI (gh) is required. Please visit https://cli.github.com/");
    }

    const currentBranch = await git.currentBranch();
    const baseBranch = ctx.args.base || "main";

    if (currentBranch === baseBranch) {
      return failure(`Currently on ${baseBranch} branch, please create and switch to a new branch first`);
    }

    const pushResult = await git.push("origin", currentBranch);
    if (pushResult.includes("error") || pushResult.includes("fatal")) {
      await run(`git push -u origin ${currentBranch}`);
    }

    const log = await git.log(10);
    const diff = await run(`git diff ${baseBranch}...HEAD --stat`);

    let title = ctx.args.title;
    if (!title) {
      const prompt = `Generate a PR title (English, max 60 characters) based on the following Git commit log:

${log}

Output only the title, nothing else.`;
      title = await ctx.llm.complete(prompt);
      title = title.trim().replace(/^["']|["']$/g, "");
    }

    const bodyPrompt = `Generate a PR description based on the following information:

Commit log:
${log}

File changes:
${diff}

Format:
## Summary
<brief description>

## Changes
<list of changes>`;

    const body = await ctx.llm.complete(bodyPrompt);

    const escapedTitle = title.replace(/"/g, '\\"');
    const escapedBody = body.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    const prResult = await run(
      `gh pr create --title "${escapedTitle}" --body "${escapedBody}" --base ${baseBranch}`
    );

    if (prResult.includes("error") || prResult.includes("fatal")) {
      return failure(`Failed to create PR: ${prResult}`);
    }

    return success(`PR created:\n${prResult}`);
  },
};
