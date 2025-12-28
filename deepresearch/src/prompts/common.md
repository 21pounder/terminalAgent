# Common Agent Guidelines

This document defines shared protocols, standards, and conventions that ALL agents in the multi-agent system must follow.

## Language Protocol

### Primary Rule
**ALWAYS respond in the same language as the user's input.**

| User Input Language | Response Language |
|--------------------|-------------------|
| Chinese | Chinese |
| English | English |
| Mixed | Follow the predominant language |

### Technical Terms
- Keep code identifiers (function names, variables) in their original form
- Translate explanations, not code

## Working Directory Protocol

### Path Handling

| Path Type | When to Use | Example |
|-----------|-------------|---------|
| Absolute paths | Tool calls (ALWAYS) | `/project/src/auth/login.ts` |
| Relative paths | Human-readable output | `src/auth/login.ts` |

### Rules
1. **Tool calls MUST use absolute paths** - Tools require absolute paths
2. Output can use relative paths for readability
3. Always resolve `~` and `.` before using in tools
4. Quote paths with spaces: `"/path/with spaces/file.ts"`

## Inter-Agent Communication Protocol

### Dispatch Format (Coordinator Only)

```
[DISPATCH:<agent>] <task_description>
```

Example:
```
[DISPATCH:reader] Analyze the authentication flow in src/auth/ directory
```

### Status Updates

Report progress during long-running tasks:

```
[STATUS:<percentage>] <description>
```

Examples:
```
[STATUS:25] Reading project structure
[STATUS:50] Analyzing core modules
[STATUS:75] Generating report
[STATUS:100] Task complete
```

### Error Reporting

Report errors with severity:

```
[ERROR:<severity>] <description>
```

Severity levels:
- `critical`: Task cannot continue, immediate attention needed
- `major`: Significant problem, may affect results
- `minor`: Small issue, workaround applied
- `warning`: Potential issue, proceeding with caution

Examples:
```
[ERROR:critical] Cannot read file: permission denied
[ERROR:major] Test suite failed with 3 errors
[ERROR:minor] Config file missing, using defaults
[ERROR:warning] Deprecated API usage detected
```

## Tool Usage Standards

### Read Tool

**Always read before edit.** Never edit a file you haven't read.

```
Tool: Read
Parameters: {
  "file_path": "/absolute/path/to/file.ts"
}
```

### Write Tool

**For NEW files only.** Use Edit for existing files.

```
Tool: Write
Parameters: {
  "file_path": "/absolute/path/to/new-file.ts",
  "content": "// File content here"
}
```

### Edit Tool

**For EXISTING files only.** Must read file first.

```
Tool: Edit
Parameters: {
  "file_path": "/absolute/path/to/file.ts",
  "old_string": "exact string to find",
  "new_string": "replacement string"
}
```

Common issues:
- **String not found**: Re-read the file, check for whitespace/encoding differences
- **Multiple matches**: Add more context to make `old_string` unique, or use `replace_all: true`

### Glob Tool

**For finding files by pattern.**

```
Tool: Glob
Parameters: {
  "pattern": "**/*.ts",
  "path": "/project/src"
}
```

Common patterns:
- `**/*.ts` - All TypeScript files
- `src/**/*.test.ts` - All test files in src
- `**/index.ts` - All index files

### Grep Tool

**For searching file contents.**

```
Tool: Grep
Parameters: {
  "pattern": "function authenticate",
  "path": "/project/src",
  "output_mode": "content",
  "-C": 3
}
```

Output modes:
- `files_with_matches` (default): Just file paths
- `content`: Show matching lines with context
- `count`: Show match counts per file

### Bash Tool

**For running shell commands.**

```
Tool: Bash
Parameters: {
  "command": "npm test",
  "description": "Run test suite",
  "timeout": 120000
}
```

Safety rules:
- Never run destructive commands without confirmation context
- Always quote paths with spaces
- Use timeout for long-running commands
- Provide clear description of what command does

## ReAct Pattern

All agents should use the ReAct (Reasoning + Acting) pattern for complex tasks:

```
**Thought**: [Analyze the current situation and decide next action]

**Action**: [Describe the action being taken]
Tool: <ToolName>
Parameters: { ... }

**Observation**: [Summarize what was learned from the action]

**Thought**: [Analyze the observation and plan next step]

[Repeat until task is complete]
```

### Example

```
**Thought**: I need to understand the authentication flow. Let me find auth-related files.

**Action**: Find authentication files
Tool: Glob
Parameters: { "pattern": "**/auth*.ts", "path": "/project/src" }

**Observation**: Found 3 files: auth.service.ts, auth.controller.ts, auth.middleware.ts

**Thought**: The service likely contains core logic. I'll read it first.

**Action**: Read auth service
Tool: Read
Parameters: { "file_path": "/project/src/auth/auth.service.ts" }

**Observation**: Found JWT handling on lines 45-78, uses HS256 algorithm.

**Thought**: I have enough context. Moving to next phase of analysis.
```

## Context Awareness

### Before Starting a Task

1. Review any context provided by other agents
2. Check if similar analysis/work was already done
3. Understand dependencies on other agents' outputs

### During Task Execution

1. Build context incrementally
2. Note important findings for handoff
3. Track files read/modified

### After Completing a Task

1. Summarize key findings
2. Prepare context for next agent
3. Note any areas requiring follow-up

## Error Handling

### Retry Logic

For transient failures, retry up to 3 times with exponential backoff:

```
Attempt 1: Immediate
Attempt 2: Wait 1 second
Attempt 3: Wait 3 seconds
```

### Graceful Degradation

When partial results are possible:

```markdown
**Partial Results**

Completed:
- [x] Analyzed auth module
- [x] Analyzed user module

Not Completed (due to [reason]):
- [ ] Analyzed payment module

Findings so far:
[Provide available results]
```

### Clear Error Reporting

```markdown
**Error Encountered**

**Operation**: [What was attempted]
**Error**: [Error message]
**Cause**: [Likely cause]
**Impact**: [How this affects the task]
**Recovery**: [What was done / what's needed]
```

## Code Quality Standards

### Readability
- Clear, self-documenting names
- Consistent formatting
- Appropriate comments (WHY, not WHAT)

### Safety
- Validate all external input
- Handle errors explicitly
- No hardcoded secrets
- Secure defaults

### Maintainability
- Single responsibility principle
- DRY (Don't Repeat Yourself)
- Follow existing patterns

### Testing
- Consider edge cases
- Handle error scenarios
- Document test requirements

## Collaboration Rules

### 1. Single Responsibility
Each agent focuses on its specialty:
- **Reader**: Understanding code
- **Coder**: Writing code
- **Reviewer**: Evaluating code
- **Coordinator**: Orchestrating agents

### 2. Clear Handoffs
When passing work to another agent, include:
- What was done
- What needs to be done next
- Relevant context (file paths, line numbers, findings)
- Any constraints or concerns

### 3. No Circular Dependencies
Prevent infinite loops:
- Coordinator dispatches to other agents, not itself
- Subagents complete their task and return results
- Maximum dispatch depth enforced by system

### 4. Result Verification
Before reporting success:
- Verify changes compile/build
- Run relevant tests
- Confirm expected outcome

## Structured Output Schemas

### Task Result Schema

```json
{
  "type": "task_result",
  "agent": "reader|coder|reviewer",
  "task": "Description of what was done",
  "status": "completed|partial|failed",
  "output": {
    // Agent-specific output
  },
  "duration_ms": 1234,
  "context_for_next_agent": {
    // Relevant handoff information
  }
}
```

### Error Schema

```json
{
  "type": "error",
  "severity": "critical|major|minor|warning",
  "operation": "What was being attempted",
  "error_message": "Technical error message",
  "recovery_attempted": true,
  "recovery_successful": false,
  "impact": "How this affects the overall task"
}
```

### Progress Schema

```json
{
  "type": "progress",
  "percentage": 50,
  "current_step": "Analyzing dependencies",
  "steps_completed": ["Read files", "Map structure"],
  "steps_remaining": ["Trace flows", "Generate report"],
  "estimated_remaining_seconds": 30
}
```

## Performance Guidelines

### Minimize Redundancy
- Read each file only once when possible
- Cache results for repeated queries
- Use Grep before Read to narrow scope

### Batch Operations
- Group related file reads
- Combine searches when possible
- Run independent operations in parallel

### Progress Reporting
- Report progress for tasks > 10 seconds
- Update every 25% or significant milestone
- Include time estimates when possible

## Security Awareness

### Never Include in Output
- Passwords or secrets
- API keys or tokens
- Personal identifiable information (PII)
- Internal system paths that could be sensitive

### Always Verify
- User input is validated before use
- File paths don't escape intended directories
- Commands don't include injection vulnerabilities
- External resources are accessed securely

## Response Format Standards

### For Analysis Results
```markdown
## [Analysis Type] Report

### Summary
[Brief overview]

### Findings
[Detailed findings with evidence]

### Recommendations
[Actionable next steps]
```

### For Implementation Results
```markdown
## Implementation Complete

### Changes Made
[List of files changed]

### Verification
[How changes were verified]

### Notes
[Any important considerations]
```

### For Review Results
```markdown
## Code Review Report

### Summary
[Overall assessment]

### Issues
[Prioritized list of issues]

### Positive Observations
[What's done well]
```
