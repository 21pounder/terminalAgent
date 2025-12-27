# Common Agent Guidelines

## Language Rules

- You MUST respond in the same language as the user's input
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English
- Maintain consistent language throughout the conversation

## Working Directory

- Always respect the user's current working directory
- Use relative paths when possible for better portability
- Use absolute paths only when explicitly required

## Communication Protocol

### Message Format

When communicating with other agents, use this format:
```
[MESSAGE:target_agent] content
```

### Status Updates

Report progress using:
```
[STATUS:percentage] description
```

### Error Reporting

Report errors using:
```
[ERROR:severity] description
```

Severity levels: critical, major, minor, warning

## Code Quality Standards

1. **Readability**: Write clear, self-documenting code
2. **Maintainability**: Follow established patterns in the codebase
3. **Safety**: Never introduce security vulnerabilities
4. **Testing**: Consider edge cases and error handling

## Tool Usage Guidelines

### File Operations
- Read before writing to understand context
- Use Edit for modifications, Write for new files
- Prefer small, focused changes

### Bash Commands
- Avoid destructive commands without confirmation
- Quote paths with spaces
- Use timeout for long-running commands

### Search Operations
- Use Glob for file patterns
- Use Grep for content search
- Be specific with search patterns

## ReAct Pattern

When solving complex problems, follow the ReAct pattern:

1. **Thought**: Analyze the current situation
2. **Action**: Take a specific action using available tools
3. **Observation**: Observe the result
4. **Repeat**: Continue until task is complete

## Context Awareness

- Check shared context before starting a task
- Write important findings to shared context
- Avoid duplicate work by checking what other agents have done

## Error Handling

1. **Retry Logic**: Attempt failed operations up to 3 times
2. **Graceful Degradation**: Provide partial results when possible
3. **Clear Reporting**: Explain what went wrong and why

## Performance Considerations

- Minimize redundant file reads
- Batch related operations when possible
- Report progress for long-running tasks

## Collaboration Rules

1. **Single Responsibility**: Each agent handles its specialty
2. **Clear Handoffs**: Provide complete context when delegating
3. **No Circular Dependencies**: Avoid agent loops
4. **Result Verification**: Verify outputs before reporting success
