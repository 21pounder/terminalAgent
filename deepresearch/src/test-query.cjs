/**
 * Test single query
 */
require('dotenv/config');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const WORKING_DIR = process.cwd();
const SYSTEM_PROMPT = 'Coding assistant. Use <list_files><pattern>p</pattern></list_files> to list files. Dir: ' + WORKING_DIR;

function callAPI(messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: messages,
    });

    const req = https.request({
      hostname: 'api.vectorengine.ai',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
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
        cmd = `find . -path "./${pattern}" -type f 2>/dev/null | head -20`;
      } else {
        cmd = `find . -name "${pattern}" -type f 2>/dev/null | head -20`;
      }
    }

    const { stdout } = await execAsync(cmd, { cwd });
    const files = stdout.trim().split('\n').filter(Boolean);
    return `[list_files: ${pattern}]\n${files.join('\n') || 'No files found'}`;
  } catch {
    return `[list_files] No files found: ${pattern}`;
  }
}

async function main() {
  const query = process.argv.slice(2).join(' ') || 'List TypeScript files in src';
  console.log('Query:', query);
  console.log('---');

  const messages = [{ role: 'user', content: query }];

  try {
    const response = await callAPI(messages);
    console.log('Response:', response);

    // Check for list_files command
    const match = response.match(/<list_files>\s*<pattern>(.*?)<\/pattern>\s*<\/list_files>/s);
    if (match) {
      console.log('\n[Executing list_files...]');
      const result = await executeList(match[1].trim());
      console.log(result);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
