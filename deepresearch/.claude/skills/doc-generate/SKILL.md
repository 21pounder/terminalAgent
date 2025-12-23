---
name: doc-generate
description: This skill should be used when the user asks to "generate documentation", "write README", "create API docs", "document this code", or needs to generate comprehensive documentation of any type.
version: 1.0.0
allowed-tools: [Read, Write, Glob, Grep]
---

# Documentation Generation Skill

Generate comprehensive documentation - API docs, user guides, architecture docs, and README files.

## Parameters

```json
{
  "type": "object",
  "properties": {
    "doc_type": {
      "type": "string",
      "enum": ["readme", "api", "architecture", "user-guide", "contributing"],
      "description": "Type of documentation to generate",
      "default": "readme"
    },
    "scope": {
      "type": "string",
      "description": "Scope of documentation (file, module, project)"
    },
    "path": {
      "type": "string",
      "description": "Path to code to document"
    },
    "output_path": {
      "type": "string",
      "description": "Where to write the documentation"
    },
    "format": {
      "type": "string",
      "enum": ["markdown", "html", "rst"],
      "description": "Output format",
      "default": "markdown"
    }
  },
  "required": ["doc_type"]
}
```

## When to Use

- Project needs documentation
- API documentation required
- Onboarding documentation for new developers
- Architecture documentation for complex systems

## Documentation Types

### API Documentation
- Document all public endpoints/functions
- Include parameters, return types, examples
- Note error conditions and edge cases
- Provide authentication details

### User Guide
- Start with quick start / getting started
- Organize by user tasks and goals
- Include screenshots and examples
- Cover common troubleshooting

### Architecture Documentation
- System overview and components
- Data flow diagrams
- Technology stack decisions
- Deployment architecture

### README
- Project description and purpose
- Installation instructions
- Basic usage examples
- Contributing guidelines

## Process

1. **Analyze Codebase**: Understand structure and patterns
2. **Identify Audience**: Who will read this documentation?
3. **Gather Information**: Code comments, existing docs, tests
4. **Structure Content**: Organize logically for the audience
5. **Write**: Clear, concise, example-rich content
6. **Review**: Check accuracy and completeness

## Guidelines

- Write for your audience's knowledge level
- Use consistent terminology
- Include working code examples
- Keep documentation close to code (easy to update)
- Version documentation with the code
- Prefer examples over lengthy explanations

## Examples

### Example 1: README Generation

**User Input**: "Generate a README for this project"

**Expected Behavior**:
1. Scan project structure and entry points
2. Read package.json or equivalent for project metadata
3. Identify main features and usage patterns
4. Generate comprehensive README with:
   - Project description
   - Installation instructions
   - Usage examples
   - API reference (if applicable)
   - Contributing guidelines

### Example 2: API Documentation

**User Input**: "为这些 REST API 端点生成文档"

**Expected Behavior**:
1. Identify all API endpoints
2. Document each with:
   - HTTP method and path
   - Request parameters and body
   - Response format and status codes
   - Example requests/responses
3. Group by resource or functionality

### Example 3: Architecture Documentation

**User Input**: "Document the architecture of this microservices system"

**Expected Behavior**:
1. Map all services and their responsibilities
2. Document communication patterns
3. Create component diagrams
4. Document data flow and storage
5. Include deployment topology
