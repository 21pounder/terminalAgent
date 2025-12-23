---
name: code-migrate
description: This skill should be used when the user asks to "migrate code", "upgrade framework", "convert from X to Y", "port codebase", or needs to migrate code between frameworks, languages, or versions.
version: 1.0.0
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# Code Migration Skill

Migrate code between frameworks, languages, or versions - analyze dependencies, plan migration, execute changes.

## Parameters

```json
{
  "type": "object",
  "properties": {
    "source": {
      "type": "string",
      "description": "Source framework/language/version"
    },
    "target": {
      "type": "string",
      "description": "Target framework/language/version"
    },
    "scope": {
      "type": "string",
      "enum": ["file", "directory", "project"],
      "description": "Migration scope",
      "default": "project"
    },
    "path": {
      "type": "string",
      "description": "Path to file or directory to migrate"
    },
    "dry_run": {
      "type": "boolean",
      "description": "Preview changes without applying",
      "default": false
    }
  },
  "required": ["source", "target"]
}
```

## When to Use

- Upgrading to new framework version
- Converting between programming languages
- Migrating from legacy patterns to modern ones
- Porting code between platforms

## Migration Types

### Framework Migration (e.g., React Class → Hooks)
- Identify components to migrate
- Convert patterns systematically
- Update state management
- Verify functionality

### Language Migration (e.g., JavaScript → TypeScript)
- Set up new tooling
- Add type definitions incrementally
- Handle third-party library types
- Configure strict mode progressively

### Version Upgrade (e.g., Node 16 → Node 20)
- Check deprecated APIs
- Update dependencies
- Test compatibility
- Update CI/CD configuration

## Process

### Phase 1: Analysis
- Inventory current codebase
- Identify dependencies and their versions
- Map framework/language-specific patterns
- Assess migration complexity

### Phase 2: Planning
- Create migration roadmap
- Identify breaking changes
- Plan for backward compatibility (if needed)
- Estimate effort and risks

### Phase 3: Execution
- Migrate in small, testable increments
- Maintain working state between changes
- Document decisions and workarounds

### Phase 4: Verification
- Run existing tests
- Manual testing of critical paths
- Performance comparison
- Document changes

## Guidelines

- Migrate incrementally, not all at once
- Maintain working state between changes
- Create comprehensive tests before migrating
- Document decisions and workarounds

## Examples

### Example 1: React Class to Hooks

**User Input**: "Migrate this React class component to functional component with hooks"

**Expected Behavior**:
1. Analyze class component structure
2. Identify state, lifecycle methods, and refs
3. Convert to useState, useEffect, useRef
4. Verify equivalent behavior

### Example 2: JavaScript to TypeScript

**User Input**: "将这个 JavaScript 项目迁移到 TypeScript"

**Expected Behavior**:
1. Set up tsconfig.json
2. Rename .js to .ts/.tsx files
3. Add type annotations incrementally
4. Handle third-party type definitions
5. Fix type errors progressively

### Example 3: Version Upgrade

**User Input**: "Upgrade this project from Node.js 16 to Node.js 20"

**Expected Behavior**:
1. Check deprecated APIs in Node 16→20
2. Scan codebase for affected code
3. Update package.json engines
4. Update CI/CD configuration
5. Test and fix compatibility issues
