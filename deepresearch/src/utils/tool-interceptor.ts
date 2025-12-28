/**
 * Tool Interceptor
 *
 * Intercepts and filters tool calls based on agent permissions.
 * Since Claude Agent SDK doesn't support per-agent tool restrictions,
 * we implement application-layer filtering.
 */

import type { SubagentType } from "../agents/types.js";
import { AGENT_CONFIGS } from "../config/agents.js";

/**
 * Tool call information
 */
export interface ToolCall {
  name: string;
  input: unknown;
}

/**
 * Interceptor result
 */
export interface InterceptResult {
  allowed: boolean;
  reason?: string;
  alternativeAgent?: SubagentType;
}

/**
 * Check if a tool is allowed for the given agent type
 */
export function isToolAllowed(agentType: SubagentType, toolName: string): boolean {
  const config = AGENT_CONFIGS[agentType];
  if (!config) return false;

  // Always allow these utility tools
  const alwaysAllowed = ["TodoWrite", "AskUserQuestion"];
  if (alwaysAllowed.includes(toolName)) return true;

  // Check against allowed tools list
  return config.allowedTools.includes(toolName);
}

/**
 * Intercept a tool call and determine if it should be allowed
 */
export function interceptToolCall(
  agentType: SubagentType,
  toolCall: ToolCall
): InterceptResult {
  const allowed = isToolAllowed(agentType, toolCall.name);

  if (allowed) {
    return { allowed: true };
  }

  // Determine which agent should handle this tool
  const alternativeAgent = findAgentForTool(toolCall.name);

  return {
    allowed: false,
    reason: `Tool "${toolCall.name}" is not allowed for ${agentType} agent`,
    alternativeAgent,
  };
}

/**
 * Find which agent type should handle a given tool
 */
export function findAgentForTool(toolName: string): SubagentType | undefined {
  // Map tools to their primary agent
  const toolAgentMap: Record<string, SubagentType> = {
    Write: "coder",
    Edit: "coder",
    NotebookEdit: "coder",
    Read: "reader",  // Reader is primary, but others can use too
    Glob: "reader",
    Grep: "reader",
    Bash: "coder",  // Coder is primary for execution
    LSP: "coder",
    WebSearch: "coordinator",
    WebFetch: "coordinator",
    Task: "coordinator",
    Skill: "coder",
  };

  return toolAgentMap[toolName];
}

/**
 * Generate tool restriction prompt for system prompt injection
 */
export function generateToolRestrictionPrompt(agentType: SubagentType): string {
  const config = AGENT_CONFIGS[agentType];
  if (!config) return "";

  const allowed = config.allowedTools;
  const forbidden = getForbiddenTools(agentType);

  return `
## TOOL RESTRICTIONS (CRITICAL - MUST FOLLOW)

You are the ${config.name} agent. You have STRICT tool restrictions:

### ALLOWED Tools (you CAN use these):
${allowed.map(t => `- ${t}`).join("\n")}
- TodoWrite (always allowed)
- AskUserQuestion (always allowed)

### FORBIDDEN Tools (you MUST NOT use these):
${forbidden.map(t => `- ${t}`).join("\n")}

### What to do when you need a forbidden tool:

If you need to use a forbidden tool, you MUST dispatch to the appropriate agent:

${forbidden.includes("Write") || forbidden.includes("Edit") ?
`- Need to write/edit files? → [DISPATCH:coder] <task description>` : ""}
${forbidden.includes("Bash") && agentType !== "coder" ?
`- Need to run commands? → [DISPATCH:coder] <task description>` : ""}
${forbidden.includes("WebSearch") ?
`- Need web search? → [DISPATCH:coordinator] <task description>` : ""}

NEVER attempt to use a forbidden tool. ALWAYS dispatch instead.
`;
}

/**
 * Get list of forbidden tools for an agent type
 */
function getForbiddenTools(agentType: SubagentType): string[] {
  const allTools = [
    "Read", "Write", "Edit", "Bash", "Glob", "Grep",
    "Task", "WebSearch", "WebFetch", "LSP", "NotebookEdit", "Skill"
  ];

  const allowed = AGENT_CONFIGS[agentType].allowedTools;
  return allTools.filter(t => !allowed.includes(t));
}

/**
 * Log a tool violation (for debugging/monitoring)
 */
export function logToolViolation(
  agentType: SubagentType,
  toolName: string,
  allowed: boolean
): void {
  if (!allowed) {
    console.warn(
      `[TOOL VIOLATION] ${agentType} agent attempted to use forbidden tool: ${toolName}`
    );
  }
}

/**
 * Create a tool filter callback for use in agent execution
 */
export function createToolFilter(agentType: SubagentType) {
  return (toolName: string, toolInput: unknown): InterceptResult => {
    const result = interceptToolCall(agentType, { name: toolName, input: toolInput });

    if (!result.allowed) {
      logToolViolation(agentType, toolName, false);
    }

    return result;
  };
}
