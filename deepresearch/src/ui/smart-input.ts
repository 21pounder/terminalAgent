/**
 * Smart Input - 智能输入组件
 *
 * 简化版本：使用标准 readline，选择器作为独立流程
 */
import * as readline from "node:readline";
import { theme, fmt } from "./theme.js";
import { CommandPicker, Command, builtinCommands } from "./commands.js";
import { FileBrowser, FileItem } from "./file-browser.js";

export interface SmartInputOptions {
  prompt?: string;
  commands?: Command[];
}

export interface SmartInputResult {
  value: string;
  files: FileItem[];
  cancelled: boolean;
}

/**
 * 简单的单行输入
 */
function simpleInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });

    rl.on("SIGINT", () => {
      rl.close();
      resolve("\x03"); // Ctrl+C 标记
    });
  });
}

/**
 * 智能输入主函数
 */
export async function smartInput(options: SmartInputOptions = {}): Promise<SmartInputResult> {
  const basePrompt = options.prompt || `${fmt(">", theme.accent)} `;
  const commands = options.commands || builtinCommands;
  const attachedFiles: FileItem[] = [];

  while (true) {
    // 构建提示符
    let prompt = basePrompt;
    if (attachedFiles.length > 0) {
      const tags = attachedFiles.map(f => fmt(`@${f.name}`, theme.tiffany)).join(" ");
      prompt = tags + " " + basePrompt;
    }

    const input = await simpleInput(prompt);

    // Ctrl+C
    if (input === "\x03") {
      return { value: "", files: [], cancelled: true };
    }

    const trimmed = input.trim();

    // "/" 单独 - 命令选择器
    if (trimmed === "/") {
      console.log();
      const picker = new CommandPicker({ commands });
      const result = await picker.pick();

      if (!result.cancelled && result.command) {
        return {
          value: "/" + result.command.name,
          files: attachedFiles,
          cancelled: false,
        };
      }
      // 取消了，继续循环
      continue;
    }

    // "@" 单独或末尾 - 文件浏览器
    if (trimmed === "@" || trimmed.endsWith(" @")) {
      console.log();
      const browser = new FileBrowser();
      const result = await browser.browse();

      if (!result.cancelled && result.file) {
        attachedFiles.push(result.file);
        console.log(fmt(`  + ${result.file.relativePath}`, theme.tiffany));

        // 如果有前置文字，保存并继续
        if (trimmed.endsWith(" @")) {
          const prefix = trimmed.slice(0, -2).trim();
          if (prefix) {
            // 提示用户继续输入
            console.log(fmt(`  (Continue your message or press Enter to send)`, theme.dim));
            const more = await simpleInput(basePrompt);
            if (more !== "\x03") {
              const fullMessage = prefix + " " + more.trim();
              return {
                value: fullMessage.trim(),
                files: attachedFiles,
                cancelled: false,
              };
            }
          }
        }
      }
      // 继续循环让用户输入
      continue;
    }

    // 空输入，继续
    if (!trimmed && attachedFiles.length === 0) {
      continue;
    }

    // 有附加文件但没输入文字，提示
    if (!trimmed && attachedFiles.length > 0) {
      console.log(fmt("  (Enter a message for the attached files)", theme.dim));
      continue;
    }

    // 正常输入
    return {
      value: trimmed,
      files: attachedFiles,
      cancelled: false,
    };
  }
}

// 保持向后兼容
export class SmartInput {
  private options: SmartInputOptions;

  constructor(options: SmartInputOptions = {}) {
    this.options = options;
  }

  async getInput(): Promise<SmartInputResult> {
    return smartInput(this.options);
  }
}
