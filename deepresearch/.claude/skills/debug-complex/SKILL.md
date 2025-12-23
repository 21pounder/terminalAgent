---
name: debug-complex
description: This skill should be used when the user asks to "debug this issue", "troubleshoot error", "find root cause", "investigate bug", or needs to analyze complex software issues with systematic methodology.
version: 1.0.0
allowed-tools: [Read, Glob, Grep, Bash, Edit]
---

# Complex Debugging Skill

Debug complex software issues - analyze error logs, trace execution flow, identify root causes, and propose fixes.

## Parameters

```json
{
  "type": "object",
  "properties": {
    "error_message": {
      "type": "string",
      "description": "Error message or stack trace"
    },
    "context": {
      "type": "string",
      "description": "What was happening when the error occurred"
    },
    "file_path": {
      "type": "string",
      "description": "Path to file where issue occurs"
    },
    "logs": {
      "type": "string",
      "description": "Relevant log output"
    },
    "reproducible": {
      "type": "boolean",
      "description": "Whether the issue is consistently reproducible",
      "default": true
    }
  }
}
```

## When to Use

- User encounters a complex bug
- Error with unclear root cause
- Intermittent or hard-to-reproduce issues
- Performance problems requiring analysis

## Methodology

### Phase 1: Problem Definition
- Gather error messages and stack traces
- Understand expected vs actual behavior
- Identify when the issue started
- Determine reproducibility

### Phase 2: Information Gathering
- Collect relevant logs
- Review recent code changes
- Check environment configuration
- Examine related system state

### Phase 3: Hypothesis Formation
Based on evidence, form hypotheses:
- Code logic errors
- Race conditions / timing issues
- Configuration problems
- External dependency failures
- Resource exhaustion
- Data corruption

### Phase 4: Investigation
For each hypothesis:
1. Design a test to confirm/refute
2. Add strategic logging if needed
3. Use debugger for execution flow analysis
4. Check boundary conditions

### Phase 5: Root Cause Analysis
- Trace the causal chain
- Identify the fundamental issue
- Distinguish symptoms from causes
- Document findings

### Phase 6: Resolution
- Propose fix with explanation
- Consider side effects
- Add tests to prevent regression
- Update documentation if needed

## Guidelines

- Don't assume - verify everything
- Change one thing at a time
- Keep notes of what you've tried
- Consider "what changed recently"
- Look for patterns in failure conditions

## Examples

### Example 1: Runtime Error

**User Input**: "Help me debug this TypeError: Cannot read property 'map' of undefined"

**Expected Behavior**:
1. Analyze stack trace to find error location
2. Trace data flow to find where undefined originates
3. Check for async timing issues or missing null checks
4. Propose fix with defensive coding

### Example 2: Intermittent Failure

**User Input**: "这个测试有时候通过，有时候失败，帮我排查"

**Expected Behavior**:
1. Identify non-deterministic factors (timing, order, external state)
2. Look for race conditions or shared state
3. Check for improper cleanup between tests
4. Propose fix ensuring test isolation

### Example 3: Performance Issue

**User Input**: "The API endpoint is slow, taking 5+ seconds to respond"

**Expected Behavior**:
1. Profile the endpoint to identify bottlenecks
2. Check database queries (N+1, missing indexes)
3. Look for blocking operations
4. Propose optimization with performance comparison
