---
name: deep-research
description: This skill should be used when the user asks to "research a topic", "investigate thoroughly", "deep dive into", "find comprehensive information about", or needs multi-source analysis with citations and synthesis.
version: 1.0.0
allowed-tools: [Read, Glob, Grep, WebFetch, WebSearch]
---

# Deep Research Skill

Conduct comprehensive research on a topic using web search, document analysis, and synthesis.

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

- User asks for in-depth research on a subject
- Task requires consulting multiple sources
- Need to synthesize information from various origins
- Require citations and source verification

## Methodology

### Phase 1: Understanding the Query
- Parse the user's research question
- Identify key concepts, entities, and relationships
- Determine the scope and depth required

### Phase 2: Information Gathering
1. **Web Search**: Use multiple search queries to find relevant sources
2. **Source Evaluation**: Assess credibility and relevance of each source
3. **Content Extraction**: Extract key facts, data, and insights

### Phase 3: Analysis
- Cross-reference information from multiple sources
- Identify patterns, contradictions, and gaps
- Synthesize findings into coherent understanding

### Phase 4: Output
Provide a structured research report with:
- Executive summary
- Key findings (with citations)
- Analysis and insights
- Limitations and areas for further research

## Guidelines

- Always cite sources with URLs
- Distinguish between facts and interpretations
- Acknowledge uncertainty when present
- Prioritize recent and authoritative sources

## Examples

### Example 1: Technology Research

**User Input**: "Research the current state of WebAssembly adoption in 2024"

**Expected Behavior**:
1. Search for WebAssembly adoption statistics, use cases, and industry reports
2. Consult developer surveys, browser support data, and major framework integrations
3. Synthesize findings into a report covering: current adoption rates, key use cases, major players, challenges, and future outlook
4. Provide at least 5 cited sources

### Example 2: Competitive Analysis

**User Input**: "深度研究 React vs Vue vs Svelte 的优劣势"

**Expected Behavior**:
1. Research each framework's architecture, performance, ecosystem
2. Compare based on: learning curve, performance benchmarks, community size, job market
3. Provide balanced analysis with specific evidence
4. Include citations from official docs, benchmarks, and surveys

### Example 3: Problem Investigation

**User Input**: "Investigate why Node.js memory leaks happen and how to debug them"

**Expected Behavior**:
1. Research common causes of memory leaks in Node.js
2. Gather debugging techniques and tools
3. Compile real-world case studies and solutions
4. Output structured guide with examples
