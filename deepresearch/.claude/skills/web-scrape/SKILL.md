---
name: web-scrape
description: This skill should be used when the user asks to "scrape a website", "extract data from URL", "crawl web pages", "parse HTML", or needs to extract and structure data from web pages.
version: 1.0.0
allowed-tools: [WebFetch, Read, Write, Bash]
---

# Web Scraping Skill

Extract and structure data from web pages - scrape content, parse HTML, and export to various formats.

## Parameters

```json
{
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "description": "Target URL to scrape"
    },
    "selector": {
      "type": "string",
      "description": "CSS selector or XPath for target elements"
    },
    "output_format": {
      "type": "string",
      "enum": ["json", "csv", "markdown", "text"],
      "description": "Output format for extracted data",
      "default": "json"
    },
    "follow_links": {
      "type": "boolean",
      "description": "Whether to follow and scrape linked pages",
      "default": false
    },
    "max_pages": {
      "type": "integer",
      "description": "Maximum number of pages to scrape",
      "default": 1
    }
  },
  "required": ["url"]
}
```

## When to Use

- User provides a URL for data extraction
- Need to collect structured data from websites
- Parsing product listings, articles, or tables
- Building datasets from web sources

## Capabilities

### Content Extraction
- Extract article text and metadata
- Parse product listings and prices
- Capture structured data (tables, lists)

### Data Structuring
- Convert to JSON, CSV, or Markdown
- Normalize and clean extracted data
- Handle pagination and multiple pages

### Site Analysis
- Identify page structure and patterns
- Locate data sources and APIs
- Map site navigation

## Process

1. **URL Analysis**: Examine the target page structure
2. **Strategy Selection**: Choose appropriate extraction method
3. **Data Extraction**: Pull relevant content
4. **Cleaning**: Remove noise, normalize formats
5. **Output**: Return structured data

## Guidelines

- Respect robots.txt and rate limits
- Handle dynamic content (JavaScript-rendered)
- Validate extracted data for completeness
- Provide extraction statistics (items found, errors)

## Ethical Considerations

- Only scrape publicly accessible content
- Do not bypass authentication or access controls
- Respect copyright and terms of service
- Use appropriate delays between requests

## Examples

### Example 1: Article Extraction

**User Input**: "Scrape the main article content from https://example.com/blog/post"

**Expected Behavior**:
1. Fetch the URL content
2. Identify main article container
3. Extract title, author, date, and body text
4. Output as structured markdown

### Example 2: Product Listing

**User Input**: "从这个电商页面抓取所有商品名称和价格"

**Expected Behavior**:
1. Analyze page structure for product cards
2. Extract name, price, image URL for each product
3. Handle pagination if present
4. Output as JSON array

### Example 3: Table Data

**User Input**: "Extract all tables from this Wikipedia page and convert to CSV"

**Expected Behavior**:
1. Fetch Wikipedia page
2. Identify all table elements
3. Parse each table's structure
4. Convert to CSV format with headers
