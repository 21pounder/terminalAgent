/**
 * Simple Terminal Agent - JavaScript version
 */
require('dotenv/config');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const readline = require('readline');

const execAsync = promisify(exec);

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const MODEL = 'claude-3-5-sonnet-20241022';
const WORKING_DIR = process.cwd();

const SYSTEM_PROMPT = 'Coding assistant. XML commands: <read_file><path>f</path></read_file>, <list_files><pattern>p</pattern></list_files>, <run_command><command>c</command></run_command>. Dir: ' + WORKING_DIR;

function callAPI(messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
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
          reject(new Error(`API Error ${res.statusCode}: ${body.substring(0, 500)}`));
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
    return `[read_file: ${filePath}]\n${lines}`;
  } catch (e) {
    return `[read_file] Error: ${e.message}`;
  }
}

async function executeWrite(filePath, content) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(WORKING_DIR, filePath);
  try {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.replace(/^\n/, ''), 'utf-8');
    return `[write_file] Success: ${filePath}`;
  } catch (e) {
    return `[write_file] Error: ${e.message}`;
  }
}

async function executeCommand(command) {
  const dangerous = [/rm\s+-rf\s+[\/~]/, /rm\s+-rf\s+\*/];
  if (dangerous.some(p => p.test(command))) return '[run_command] Blocked';
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
      // Windows: handle patterns like "src/**/*.ts" or "src/*.ts" or "*.ts"
      let filePattern = pattern;

      // Extract directory prefix if present
      const pathMatch = pattern.match(/^([^*]+)[\\/]/);
      if (pathMatch) {
        const dir = pathMatch[1].replace(/\//g, '\\');
        const fullDir = path.join(WORKING_DIR, dir);
        if (fs.existsSync(fullDir)) {
          cwd = fullDir;
        }
        filePattern = pattern.substring(pathMatch[0].length);
      }

      // Remove ** and keep just the file pattern
      filePattern = filePattern.replace(/^\*\*[\\/]?/, '');
      if (!filePattern) filePattern = '*.*';

      cmd = `dir /s /b "${filePattern}" 2>nul`;
    } else {
      // Unix: handle path-based patterns properly
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

async function parseAndExecute(text) {
  const results = [];

  for (const m of text.matchAll(/<read_file>\s*<path>(.*?)<\/path>\s*<\/read_file>/gs)) {
    results.push(await executeRead(m[1].trim()));
  }
  for (const m of text.matchAll(/<write_file>\s*<path>(.*?)<\/path>\s*<content>(.*?)<\/content>\s*<\/write_file>/gs)) {
    results.push(await executeWrite(m[1].trim(), m[2]));
  }
  for (const m of text.matchAll(/<run_command>\s*<command>(.*?)<\/command>\s*<\/run_command>/gs)) {
    results.push(await executeCommand(m[1].trim()));
  }
  for (const m of text.matchAll(/<list_files>\s*<pattern>(.*?)<\/pattern>\s*<\/list_files>/gs)) {
    results.push(await executeList(m[1].trim()));
  }

  return results;
}

function hasCommands(text) {
  return /<(read_file|write_file|run_command|list_files)>/.test(text);
}

class Agent {
  constructor() { this.messages = []; }

  async chat(userMessage) {
    this.messages.push({ role: 'user', content: userMessage });

    for (let i = 0; i < 10; i++) {
      const text = await callAPI(this.messages);
      process.stdout.write(text);
      this.messages.push({ role: 'assistant', content: text });

      if (!hasCommands(text)) break;

      console.log('\n');
      const results = await parseAndExecute(text);
      if (!results.length) break;

      for (const r of results) console.log(r.slice(0, 500) + (r.length > 500 ? '...' : '') + '\n');
      this.messages.push({ role: 'user', content: 'Results:\n\n' + results.join('\n\n') });
    }
  }

  clear() { this.messages = []; }
}

async function main() {
  if (!API_KEY) { console.log('Error: ANTHROPIC_API_KEY not set'); return; }

  const agent = new Agent();
  console.log('\n=== Terminal Agent ===');
  console.log('Commands: read_file, write_file, run_command, list_files');
  console.log(`Dir: ${WORKING_DIR}`);
  console.log('Type exit to quit\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => new Promise(r => rl.question('\nYou: ', a => r(a.trim())));

  try {
    while (true) {
      const input = await ask();
      if (!input) continue;
      if (['exit', 'quit', 'q'].includes(input.toLowerCase())) break;
      if (input.toLowerCase() === 'clear') { agent.clear(); console.log('Cleared.'); continue; }

      console.log('\nAgent: ');
      try { await agent.chat(input); console.log(); }
      catch (e) { console.error('Error:', e.message); }
    }
  } finally { rl.close(); console.log('\nGoodbye!'); }
}

main();
