/**
 * Claude Agent SDK Entry Point
 *
 * This is the new entry point that uses the official Claude Agent SDK
 * instead of the custom LLM client implementation.
 */
import { query, type SDKMessage, type SDKAssistantMessage, type SDKResultMessage, type AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { input } from "@inquirer/prompts";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
};

function printBanner(): void {
  console.log(`
${colors.cyan}╔════════════════════════════════════════════╗${colors.reset}
${colors.cyan}║${colors.reset}   ${colors.bright}Terminal Agent v4.0${colors.reset}                     ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}   ${colors.dim}Powered by Claude Agent SDK${colors.reset}             ${colors.cyan}║${colors.reset}
${colors.cyan}╚════════════════════════════════════════════╝${colors.reset}

${colors.dim}Working directory: ${process.cwd()}${colors.reset}
${colors.dim}Type your request or 'exit' to quit${colors.reset}
${colors.dim}Skills are automatically loaded from .claude/skills/${colors.reset}
`);
}

/**
 * Define custom subagents that can be invoked via Task tool
 */
const customAgents: Record<string, AgentDefinition> = {
  "deep-researcher": {
    description: "Use this agent when user asks to 'research a topic', 'investigate thoroughly', 'deep dive into', or needs multi-source analysis with citations.",
    tools: ["Read", "Glob", "Grep", "WebFetch", "WebSearch"],
    prompt: `You are a deep research specialist. Conduct comprehensive research on topics using:
1. Web search for current information
2. Document analysis for local files
3. Cross-referencing multiple sources
4. Synthesizing findings into structured reports

Always cite sources with URLs and distinguish facts from interpretations.`,
    model: "sonnet",
  },
  "code-migrator": {
    description: "Use this agent when user asks to 'migrate code', 'upgrade framework', 'convert from X to Y', or port codebases between technologies.",
    tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
    prompt: `You are a code migration specialist. Help users migrate code between:
- Framework versions (e.g., React Class → Hooks)
- Languages (e.g., JavaScript → TypeScript)
- Platforms or runtimes

Always:
1. Analyze the current codebase first
2. Create a migration plan
3. Migrate incrementally
4. Verify each step works before continuing`,
    model: "sonnet",
  },
  "debug-specialist": {
    description: "Use this agent when user asks to 'debug this issue', 'troubleshoot error', 'find root cause', or analyze complex bugs.",
    tools: ["Read", "Glob", "Grep", "Bash", "Edit"],
    prompt: `You are a debugging specialist. Apply systematic debugging methodology:
1. Gather error messages and context
2. Form hypotheses about root causes
3. Test each hypothesis methodically
4. Trace execution flow to find the issue
5. Propose fixes with explanations

Don't assume - verify everything. Change one thing at a time.`,
    model: "sonnet",
  },
};

/**
 * Process assistant message content
 */
function processAssistantMessage(msg: SDKAssistantMessage): void {
  const content = msg.message.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "text") {
        console.log(`\n${colors.green}Claude:${colors.reset} ${block.text}`);
      } else if (block.type === "tool_use") {
        console.log(`${colors.blue}[Tool: ${block.name}]${colors.reset}`);
      }
    }
  }
}

/**
 * Run a query using Claude Agent SDK
 */
async function runQuery(prompt: string, sessionId?: string): Promise<string | undefined> {
  console.log(`\n${colors.dim}Processing...${colors.reset}`);

  try {
    const result = query({
      prompt,
      options: {
        // Load settings from project directory to get .claude/skills/
        settingSources: ["project", "local"],

        // Permission mode - accept edits automatically for smoother UX
        permissionMode: "acceptEdits",

        // Register custom agents
        agents: customAgents,

        // Use Claude Code's default tools
        tools: { type: "preset", preset: "claude_code" },

        // Resume previous session if provided
        resume: sessionId,

        // Include partial messages for streaming feel
        includePartialMessages: true,

        // System prompt with custom instructions
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: `
IMPORTANT Language Rules:
- You MUST respond to the user in the same language they use
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English

You have access to custom agents via the Task tool:
- deep-researcher: For comprehensive research tasks
- code-migrator: For code migration between frameworks/languages
- debug-specialist: For complex debugging

Skills in .claude/skills/ are automatically available via the Skill tool.
`,
        },
      },
    });

    let newSessionId: string | undefined;

    // Stream and process messages
    for await (const msg of result) {
      switch (msg.type) {
        case "system":
          if (msg.subtype === "init") {
            newSessionId = msg.session_id;
            console.log(`${colors.dim}Session: ${msg.session_id}${colors.reset}`);
            if (msg.skills.length > 0) {
              console.log(`${colors.dim}Skills loaded: ${msg.skills.join(", ")}${colors.reset}`);
            }
          }
          break;

        case "assistant":
          processAssistantMessage(msg);
          break;

        case "result":
          if (msg.subtype === "success") {
            console.log(`\n${colors.dim}Completed in ${msg.duration_ms}ms, cost: $${msg.total_cost_usd.toFixed(4)}${colors.reset}`);
          } else {
            console.log(`\n${colors.red}Error: ${msg.subtype}${colors.reset}`);
            if ("errors" in msg && msg.errors) {
              msg.errors.forEach((e: string) => console.log(`  ${colors.red}${e}${colors.reset}`));
            }
          }
          break;

        case "tool_progress":
          console.log(`${colors.dim}[${msg.tool_name}] ${msg.elapsed_time_seconds.toFixed(1)}s...${colors.reset}`);
          break;
      }
    }

    return newSessionId;
  } catch (error) {
    console.error(`${colors.red}Error: ${error instanceof Error ? error.message : String(error)}${colors.reset}`);
    return sessionId;
  }
}

/**
 * Interactive mode with session persistence
 */
async function interactive(): Promise<void> {
  printBanner();

  let sessionId: string | undefined;

  try {
    while (true) {
      const userInput = await input({
        message: `${colors.green}You:${colors.reset}`,
      });

      const trimmed = userInput.trim();

      if (!trimmed) continue;

      if (["exit", "quit", "q"].includes(trimmed.toLowerCase())) {
        break;
      }

      if (trimmed === "clear") {
        sessionId = undefined;
        console.clear();
        printBanner();
        console.log(`${colors.dim}Session cleared${colors.reset}`);
        continue;
      }

      sessionId = await runQuery(trimmed, sessionId);
    }
  } catch (error) {
    // Handle Ctrl+C gracefully
    if ((error as Error).name !== "ExitPromptError") {
      throw error;
    }
  }

  console.log(`\n${colors.dim}Goodbye!${colors.reset}`);
}

/**
 * Single query mode
 */
async function singleQuery(prompt: string): Promise<void> {
  await runQuery(prompt);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Single query mode
    await singleQuery(args.join(" "));
  } else {
    // Interactive mode
    await interactive();
  }
}

main().catch((error) => {
  console.error(`${colors.red}Fatal error: ${error instanceof Error ? error.message : String(error)}${colors.reset}`);
  process.exit(1);
});
