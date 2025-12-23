#!/usr/bin/env node
/**
 * Terminal Coding Agent - Global CLI Entry
 *
 * Usage:
 *   agent                    # Interactive mode
 *   agent "your question"    # Single query (Agent mode)
 *   agent /commit            # Single query (Skill mode)
 */

// 使用动态 import 加载 ESM 模块
async function main() {
  try {
    // 设置工作目录为当前目录
    process.chdir(process.cwd());

    // 动态导入编译后的入口文件
    await import('../dist/index.js');
  } catch (error) {
    // 如果 dist 不存在，尝试使用 tsx 运行源码
    const { execSync } = require('child_process');
    const path = require('path');

    const srcPath = path.join(__dirname, '..', 'src', 'index.ts');
    const args = process.argv.slice(2).map(a => `"${a}"`).join(' ');

    try {
      execSync(`npx tsx "${srcPath}" ${args}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    } catch (e) {
      console.error('Error: Could not start agent. Run "npm run build" first or ensure tsx is installed.');
      process.exit(1);
    }
  }
}

main();
