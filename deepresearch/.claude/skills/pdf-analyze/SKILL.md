---
name: pdf-analyze
description: This skill should be used when the user asks to "analyze a PDF", "extract text from document", "summarize this PDF", "read document", or needs to extract, summarize, or answer questions about PDF file contents.
version: 1.0.0
allowed-tools: [Read, Write, Glob]
---

# PDF Analysis Skill

Analyze PDF documents - extract text, summarize content, answer questions, and identify key information.

## Parameters

```json
{
  "type": "object",
  "properties": {
    "file_path": {
      "type": "string",
      "description": "Path to the PDF file"
    },
    "task": {
      "type": "string",
      "enum": ["extract", "summarize", "answer", "data"],
      "description": "Analysis task type",
      "default": "summarize"
    },
    "question": {
      "type": "string",
      "description": "Specific question to answer (for 'answer' task)"
    },
    "output_format": {
      "type": "string",
      "enum": ["text", "markdown", "json", "csv"],
      "description": "Output format for extracted data",
      "default": "markdown"
    }
  },
  "required": ["file_path"]
}
```

## When to Use

- User provides a PDF file for analysis
- Need to extract text or data from documents
- Summarization of long documents required
- Question-answering about document content

## Capabilities

### Text Extraction
- Extract all text content from the PDF
- Preserve document structure (headings, paragraphs, lists)
- Handle multi-column layouts

### Content Summarization
- Generate executive summary
- Extract key points and findings
- Identify main themes and arguments

### Question Answering
- Answer specific questions about the document
- Locate relevant sections
- Provide citations with page numbers

### Data Extraction
- Extract tables and structured data
- Identify names, dates, numbers, and entities
- Create structured output (JSON, CSV)

## Process

1. **Receive PDF**: User provides PDF file path or content
2. **Initial Scan**: Quickly assess document type and structure
3. **Deep Analysis**: Based on user request, perform appropriate analysis
4. **Output**: Provide results in requested format

## Guidelines

- Always specify page numbers when citing
- Handle OCR'd documents carefully (may have errors)
- For large documents, offer to focus on specific sections
- Maintain confidentiality of document contents

## Examples

### Example 1: Document Summarization

**User Input**: "Summarize this research paper: paper.pdf"

**Expected Behavior**:
1. Read the PDF file
2. Identify document structure (abstract, sections, conclusions)
3. Extract key points from each section
4. Produce executive summary with main findings

### Example 2: Data Extraction

**User Input**: "从这个 PDF 中提取所有的表格数据，输出为 JSON"

**Expected Behavior**:
1. Scan document for tables
2. Parse table structure and data
3. Convert to JSON format
4. Validate data completeness

### Example 3: Question Answering

**User Input**: "What are the main conclusions in chapter 3 of this PDF?"

**Expected Behavior**:
1. Navigate to chapter 3
2. Identify conclusion sections
3. Extract and summarize key conclusions
4. Cite page numbers for reference
