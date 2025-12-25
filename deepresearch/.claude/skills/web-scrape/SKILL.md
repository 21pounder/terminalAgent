---
name: web-scrape
description: Scrape websites and extract content. Use Playwright browser for JavaScript-rendered pages.
version: 2.1.0
---

# Web Scraping Skill

## IMPORTANT: Use Playwright MCP for ALL websites

You MUST use these MCP tools in this exact order:

### Step 1: Open the page
```
mcp__playwright__browser_navigate
  url: "<the target URL>"
```

### Step 2: Wait for content (optional, for slow pages)
```
mcp__playwright__browser_wait_for
  time: 3
```

### Step 3: Get ALL page content
```
mcp__playwright__browser_snapshot
```
This returns the FULL rendered page with all text content!

### Step 4: Close browser
```
mcp__playwright__browser_close
```

### Step 5: Present the extracted content to user

## That's it! Only 4 tool calls needed.

DO NOT use Bash, WebFetch, or scripts. Just use the MCP tools above.

## Example

User: `/web-scrape https://example.com/article`

Your actions:
1. `mcp__playwright__browser_navigate({ url: "https://example.com/article" })`
2. `mcp__playwright__browser_wait_for({ time: 2 })`
3. `mcp__playwright__browser_snapshot()` → This gives you all the content!
4. `mcp__playwright__browser_close()`
5. Format and present the content to user

Total time: ~10-20 seconds
