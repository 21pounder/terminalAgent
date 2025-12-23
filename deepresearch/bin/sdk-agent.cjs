#!/usr/bin/env node
/**
 * Terminal Coding Agent - SDK Mode Entry
 *
 * Usage:
 *   sdk-agent                  # Interactive mode
 *   sdk-agent "your question"  # Single query
 */

async function main() {
  try {
    process.chdir(process.cwd());
    await import('../dist/sdk-agent.js');
  } catch (error) {
    const { execSync } = require('child_process');
    const path = require('path');

    const srcPath = path.join(__dirname, '..', 'src', 'sdk-agent.ts');
    const args = process.argv.slice(2).map(a => `"${a}"`).join(' ');

    try {
      execSync(`npx tsx "${srcPath}" ${args}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    } catch (e) {
      console.error('Error: Could not start sdk-agent. Run "npm run build" first.');
      process.exit(1);
    }
  }
}

main();
