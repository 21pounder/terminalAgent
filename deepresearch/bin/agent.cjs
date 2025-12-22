#!/usr/bin/env node
/**
 * Terminal Coding Agent - Global CLI with Approval System
 * Run from any directory: agent "your question"
 * Or interactive mode: agent
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const readline = require('readline');

const execAsync = promisify(exec);

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const WORKING_DIR = process.cwd();

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const SYSTEM_PROMPT = 'Coding assistant. XML: <read_file><path>f</path></read_file> read, <write_file><path>f</path><content>c</content></write_file> write, <run_command><command>c</command></run_command> run, <list_files><pattern>p</pattern></list_files> list. Dir: ' + WORKING_DIR;

// Global readline interface for approvals
let rl = null;

function getReadline() {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
}

function closeReadline() {
  if (rl) {
    rl.close();
    rl = null;
  }
}

async function askApproval(question) {
  return new Promise((resolve) => {
    const r = getReadline();
    r.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

function callAPI(messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: messages,
    });

    const req = https.request({
      hostname: 'api.vectorengine.ai',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API Error ${res.statusCode}: ${body.substring(0, 300)}`));
          return;
        }
        try {
          const response = JSON.parse(body);
          const text = response.content
            .filter(b => b.type === 'text')
            .map(b => b.text || '')
            .join('');
          resolve(text);
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function executeRead(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(WORKING_DIR, filePath);
  try {
    if (!fs.existsSync(fullPath)) return `[read_file] Error: Not found: ${filePath}`;
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n').slice(0, 100).map((l, i) => `${i + 1}|${l}`).join('\n');
    return `[read_file: ${filePath}]\n${lines}${content.split('\n').length > 100 ? '\n... (truncated)' : ''}`;
  } catch (e) {
    return `[read_file] Error: ${e.message}`;
  }
}

async function executeWrite(filePath, content) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(WORKING_DIR, filePath);
  try {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.replace(/^\n/, ''), 'utf-8');
    return `[write_file] Success: ${filePath} (${content.length} chars)`;
  } catch (e) {
    return `[write_file] Error: ${e.message}`;
  }
}

async function executeCommand(command) {
  const dangerous = [/rm\s+-rf\s+[\/~]/, /rm\s+-rf\s+\*/, /del\s+\/s\s+\/q\s+c:\\/i];
  if (dangerous.some(p => p.test(command))) return '[run_command] Blocked: dangerous command';
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: WORKING_DIR, timeout: 30000 });
    return `[run_command: ${command}]\n${stdout.trim()}${stderr ? '\nSTDERR: ' + stderr.trim() : ''}`;
  } catch (e) {
    return `[run_command] Error: ${e.message}`;
  }
}

async function executeList(pattern) {
  try {
    let cmd;
    let cwd = WORKING_DIR;

    if (process.platform === 'win32') {
      let filePattern = pattern;
      const pathMatch = pattern.match(/^([^*]+)[\\/]/);
      if (pathMatch) {
        const dir = pathMatch[1].replace(/\//g, '\\');
        const fullDir = path.join(WORKING_DIR, dir);
        if (fs.existsSync(fullDir)) {
          cwd = fullDir;
        }
        filePattern = pattern.substring(pathMatch[0].length);
      }
      filePattern = filePattern.replace(/^\*\*[\\/]?/, '');
      if (!filePattern) filePattern = '*.*';
      cmd = `dir /s /b "${filePattern}" 2>nul`;
    } else {
      if (pattern.includes('/')) {
        cmd = `find . -path "./${pattern}" -type f 2>/dev/null | head -30`;
      } else {
        cmd = `find . -name "${pattern}" -type f 2>/dev/null | head -30`;
      }
    }

    const { stdout } = await execAsync(cmd, { cwd });
    const files = stdout.trim().split('\n').filter(Boolean);
    return `[list_files: ${pattern}]\n${files.join('\n') || 'No files found'}`;
  } catch {
    return `[list_files] No files found: ${pattern}`;
  }
}

// Parse commands from text
function parseCommands(text) {
  const commands = [];

  for (const m of text.matchAll(/<read_file>\s*<path>(.*?)<\/path>\s*<\/read_file>/gs)) {
    commands.push({ type: 'read_file', path: m[1].trim() });
  }
  for (const m of text.matchAll(/<write_file>\s*<path>(.*?)<\/path>\s*<content>(.*?)<\/content>\s*<\/write_file>/gs)) {
    commands.push({ type: 'write_file', path: m[1].trim(), content: m[2] });
  }
  for (const m of text.matchAll(/<run_command>\s*<command>(.*?)<\/command>\s*<\/run_command>/gs)) {
    commands.push({ type: 'run_command', command: m[1].trim() });
  }
  for (const m of text.matchAll(/<list_files>\s*<pattern>(.*?)<\/pattern>\s*<\/list_files>/gs)) {
    commands.push({ type: 'list_files', pattern: m[1].trim() });
  }

  return commands;
}

// Display command for approval
function displayCommand(cmd, index) {
  console.log();
  console.log(`${colors.cyan}┌─ Command ${index + 1} ─────────────────────────────────────────┐${colors.reset}`);

  switch (cmd.type) {
    case 'read_file':
      console.log(`${colors.cyan}│${colors.reset} ${colors.blue}READ FILE${colors.reset}`);
      console.log(`${colors.cyan}│${colors.reset} Path: ${colors.yellow}${cmd.path}${colors.reset}`);
      break;
    case 'write_file':
      console.log(`${colors.cyan}│${colors.reset} ${colors.magenta}WRITE FILE${colors.reset}`);
      console.log(`${colors.cyan}│${colors.reset} Path: ${colors.yellow}${cmd.path}${colors.reset}`);
      console.log(`${colors.cyan}│${colors.reset} Content: ${colors.dim}${cmd.content.substring(0, 100)}${cmd.content.length > 100 ? '...' : ''}${colors.reset}`);
      break;
    case 'run_command':
      console.log(`${colors.cyan}│${colors.reset} ${colors.red}RUN COMMAND${colors.reset}`);
      console.log(`${colors.cyan}│${colors.reset} Command: ${colors.yellow}${cmd.command}${colors.reset}`);
      break;
    case 'list_files':
      console.log(`${colors.cyan}│${colors.reset} ${colors.green}LIST FILES${colors.reset}`);
      console.log(`${colors.cyan}│${colors.reset} Pattern: ${colors.yellow}${cmd.pattern}${colors.reset}`);
      break;
  }

  console.log(`${colors.cyan}└──────────────────────────────────────────────────────┘${colors.reset}`);
}

// Execute a single command
async function executeCmd(cmd) {
  switch (cmd.type) {
    case 'read_file':
      return await executeRead(cmd.path);
    case 'write_file':
      return await executeWrite(cmd.path, cmd.content);
    case 'run_command':
      return await executeCommand(cmd.command);
    case 'list_files':
      return await executeList(cmd.pattern);
    default:
      return '[Error] Unknown command type';
  }
}

// Execute commands with approval
async function parseAndExecuteWithApproval(text, autoApprove = false) {
  const commands = parseCommands(text);
  const results = [];

  if (commands.length === 0) return results;

  console.log(`\n${colors.bright}${colors.cyan}Agent wants to execute ${commands.length} command(s):${colors.reset}`);

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    displayCommand(cmd, i);

    let approved = autoApprove;

    if (!autoApprove) {
      const answer = await askApproval(`${colors.green}Execute? [y/n/a(ll)]: ${colors.reset}`);

      if (answer === 'a' || answer === 'all') {
        autoApprove = true;
        approved = true;
      } else if (answer === 'y' || answer === 'yes') {
        approved = true;
      } else {
        approved = false;
      }
    }

    if (approved) {
      console.log(`${colors.green}✓ Executing...${colors.reset}`);
      const result = await executeCmd(cmd);
      console.log(`${colors.dim}${result.slice(0, 500)}${result.length > 500 ? '...' : ''}${colors.reset}`);
      results.push(result);
    } else {
      console.log(`${colors.red}✗ Skipped${colors.reset}`);
      results.push(`[${cmd.type}] Skipped by user`);
    }
  }

  return results;
}

function hasCommands(text) {
  return /<(read_file|write_file|run_command|list_files)>/.test(text);
}

class Agent {
  constructor(autoApprove = false) {
    this.messages = [];
    this.autoApprove = autoApprove;
  }

  async chat(userMessage) {
    this.messages.push({ role: 'user', content: userMessage });

    for (let i = 0; i < 10; i++) {
      const text = await callAPI(this.messages);
      process.stdout.write(text);
      this.messages.push({ role: 'assistant', content: text });

      if (!hasCommands(text)) break;

      const results = await parseAndExecuteWithApproval(text, this.autoApprove);
      if (!results.length) break;

      console.log();
      this.messages.push({ role: 'user', content: 'Results:\n\n' + results.join('\n\n') });
    }
  }

  clear() { this.messages = []; }
}

async function main() {
  if (!API_KEY) {
    console.log('Error: ANTHROPIC_API_KEY not set');
    console.log('Set it in environment or create .env file in:', path.join(__dirname, '..'));
    return;
  }

  const args = process.argv.slice(2);

  // Check for flags
  const autoApprove = args.includes('-y') || args.includes('--yes');
  const filteredArgs = args.filter(a => a !== '-y' && a !== '--yes');

  // Single query mode
  if (filteredArgs.length > 0) {
    const query = filteredArgs.join(' ');
    console.log(`\n${colors.bright}> ${query}${colors.reset}\n`);
    const agent = new Agent(autoApprove);
    try {
      await agent.chat(query);
      console.log('\n');
    } catch (e) {
      console.error('Error:', e.message);
    }
    closeReadline();
    return;
  }

  // Interactive mode
  const agent = new Agent(autoApprove);
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset}       ${colors.bright}Terminal Coding Agent${colors.reset}              ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\n${colors.dim}Commands: read_file, write_file, run_command, list_files${colors.reset}`);
  console.log(`${colors.dim}Working directory: ${WORKING_DIR}${colors.reset}`);
  console.log(`${colors.dim}Auto-approve: ${autoApprove ? 'ON' : 'OFF'} (use -y flag to enable)${colors.reset}`);
  console.log(`${colors.dim}Type "exit" to quit, "clear" to reset.${colors.reset}\n`);

  const ask = () => new Promise(r => {
    const reader = getReadline();
    reader.question(`\n${colors.green}You: ${colors.reset}`, a => r(a.trim()));
  });

  try {
    while (true) {
      const input = await ask();
      if (!input) continue;
      if (['exit', 'quit', 'q'].includes(input.toLowerCase())) break;
      if (input.toLowerCase() === 'clear') { agent.clear(); console.log('Cleared.'); continue; }
      if (input.toLowerCase() === 'auto' || input.toLowerCase() === 'auto on') {
        agent.autoApprove = true;
        console.log(`${colors.yellow}Auto-approve: ON${colors.reset}`);
        continue;
      }
      if (input.toLowerCase() === 'auto off') {
        agent.autoApprove = false;
        console.log(`${colors.yellow}Auto-approve: OFF${colors.reset}`);
        continue;
      }

      console.log(`\n${colors.cyan}Agent: ${colors.reset}`);
      try { await agent.chat(input); console.log(); }
      catch (e) { console.error('Error:', e.message); }
    }
  } finally {
    closeReadline();
    console.log(`\n${colors.dim}Goodbye!${colors.reset}`);
  }
}

main();
