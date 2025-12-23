/**
 * Agent system prompts
 */
import type { Tool } from "../llm/types.js";

export const agentSystemPrompt = `You are a professional programming assistant that helps users with various coding tasks.

You have the following tools available:

1. **Glob** - Find files by pattern
   - pattern: File pattern, e.g. "*.ts", "src/**/*.tsx"
   - cwd: Search directory (optional)

2. **Grep** - Search content in files
   - pattern: Search pattern (regex)
   - path: Search path (optional, defaults to current directory)
   - include: File filter, e.g. "*.ts" (optional)

3. **Read** - Read file content
   - file_path: File path

4. **Write** - Write file
   - file_path: File path
   - content: File content

5. **Edit** - Edit file (replace text)
   - file_path: File path
   - old_string: Text to replace (must be unique)
   - new_string: Replacement text

6. **Bash** - Execute shell command
   - command: Command to execute
   - cwd: Working directory (optional)

Working principles:
- Understand user requirements first, explore the codebase if needed
- Read file content before modifying code
- Use Edit tool for precise modifications, avoid overwriting entire files
- Be cautious before executing dangerous commands

IMPORTANT Language Rules:
- You MUST always think and reason in English internally
- You MUST respond to the user in the same language they use
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English
- If the user writes in any other language, respond in that language`;

export const agentTools: Tool[] = [
  {
    name: "Glob",
    description: "Find files by pattern",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description: "File pattern, e.g. '*.ts', 'src/**/*.tsx'",
        },
        cwd: {
          type: "string",
          description: "Search directory (optional)",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "Grep",
    description: "Search content in files",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description: "Search pattern (regex)",
        },
        path: {
          type: "string",
          description: "Search path (optional)",
        },
        include: {
          type: "string",
          description: "File filter, e.g. '*.ts'",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "Read",
    description: "Read file content",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "File path",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "Write",
    description: "Write file (create or overwrite)",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "File path",
        },
        content: {
          type: "string",
          description: "File content",
        },
      },
      required: ["file_path", "content"],
    },
  },
  {
    name: "Edit",
    description: "Edit file (replace text)",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "File path",
        },
        old_string: {
          type: "string",
          description: "Text to replace (must be unique)",
        },
        new_string: {
          type: "string",
          description: "Replacement text",
        },
      },
      required: ["file_path", "old_string", "new_string"],
    },
  },
  {
    name: "Bash",
    description: "Execute shell command",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "Command to execute",
        },
        cwd: {
          type: "string",
          description: "Working directory (optional)",
        },
      },
      required: ["command"],
    },
  },
];
