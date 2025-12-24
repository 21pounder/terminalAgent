---
name: deep-research
description: Use this skill when user asks to "research a topic", "investigate thoroughly", "deep dive into", "analyze in depth", or needs comprehensive multi-source research with citations.
version: 1.0.0
allowed-tools: [Read, Glob, Grep, WebFetch, WebSearch]
---

# Deep Research

Conduct comprehensive research on any topic using multiple sources, providing structured analysis with citations.

## Parameters

```json
{
  "type": "object",
  "properties": {
    "topic": {
      "type": "string",
      "description": "The topic or question to research"
    },
    "depth": {
      "type": "string",
      "enum": ["quick", "standard", "comprehensive"],
      "description": "Research depth level",
      "default": "standard"
    },
    "sources": {
      "type": "integer",
      "description": "Minimum number of sources to consult",
      "default": 5
    }
  },
  "required": ["topic"]
}
```

## When to Use

- User asks to "research" or "investigate" a topic
- User wants a "deep dive" or "comprehensive analysis"
- User needs information from multiple sources
- User asks for comparisons with evidence
- User wants citations and references

## Methodology

### Phase 1: Query Analysis
- Parse the research question
- Identify key concepts and search terms
- Determine scope and boundaries
- Plan search strategy

### Phase 2: Information Gathering
1. **Web Search**: Execute multiple targeted searches
2. **Source Evaluation**: Assess credibility and relevance
3. **Content Extraction**: Extract key facts and data
4. **Local Files**: Check if relevant local documents exist

### Phase 3: Synthesis
- Cross-reference information across sources
- Identify patterns, trends, and contradictions
- Distinguish facts from opinions
- Fill information gaps with additional searches

### Phase 4: Output
Provide structured report with:
- Executive summary (2-3 sentences)
- Key findings with inline citations
- Analysis and insights
- Sources list with URLs

## Guidelines

- Always cite sources with URLs
- Distinguish facts from interpretations
- Present balanced perspectives on controversial topics
- Acknowledge limitations and gaps in available information
- Use the user's language for the report

## Examples

### Example 1: Technology Research

**User Input**: "Research the current state of WebAssembly adoption in 2024"

**Expected Behavior**:
1. Search for WebAssembly adoption statistics and trends
2. Consult browser support data and developer surveys
3. Find real-world use cases and performance benchmarks
4. Synthesize findings into structured report
5. Provide at least 5 cited sources

### Example 2: Comparison Research

**User Input**: "深度研究 React vs Vue 的优劣势"

**Expected Behavior**:
1. 研究每个框架的架构、性能、生态系统
2. 基于学习曲线、性能、社区支持等维度对比
3. 提供有证据支持的平衡分析
4. 包含官方文档、基准测试、开发者调查等引用
5. 用中文输出完整报告
