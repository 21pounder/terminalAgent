/**
 * Slash Commands - 智能指令系统
 *
 * 输入 "/" 触发指令选择面板
 * 支持上下键导航、实时过滤、Enter 确认
 */
import { theme, icons, borders, fmt, clearLine, moveCursor, hideCursor, showCursor, padEndVisible } from "./theme.js";

export interface Command {
  name: string;
  description: string;
  shortcut?: string;
  action?: () => void | Promise<void>;
}

// 内置指令
export const builtinCommands: Command[] = [
  { name: "help", description: "Show help", shortcut: "h" },
  { name: "exit", description: "Exit program", shortcut: "q" },
  { name: "clear", description: "Clear screen", shortcut: "c" },
  { name: "reset", description: "Reset session", shortcut: "r" },
  { name: "skills", description: "List all skills" },
];

export interface CommandPickerOptions {
  commands: Command[];
  filter?: string;
  maxVisible?: number;
}

export interface CommandPickerResult {
  command: Command | null;
  cancelled: boolean;
}

/**
 * 命令选择器 - 实现浮动面板
 */
export class CommandPicker {
  private commands: Command[];
  private filteredCommands: Command[];
  private selectedIndex: number = 0;
  private filter: string = "";
  private maxVisible: number;
  private renderedLines: number = 0;

  // 固定宽度
  private readonly WIDTH = 44;
  private readonly NAME_WIDTH = 12;

  constructor(options: CommandPickerOptions) {
    this.commands = options.commands;
    this.filteredCommands = [...this.commands];
    this.filter = options.filter || "";
    this.maxVisible = options.maxVisible || 8;
    this.applyFilter();
  }

  private applyFilter(): void {
    if (!this.filter) {
      this.filteredCommands = [...this.commands];
    } else {
      const lowerFilter = this.filter.toLowerCase();
      this.filteredCommands = this.commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(lowerFilter) ||
          cmd.description.toLowerCase().includes(lowerFilter)
      );
    }
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredCommands.length - 1));
  }

  private render(): void {
    this.clearRender();

    const lines: string[] = [];
    const W = this.WIDTH;

    // 顶部边框 + 标题
    const title = " Commands ";
    const topLine = borders.topLeft + borders.horizontal.repeat(2) + title + borders.horizontal.repeat(W - 4 - title.length) + borders.topRight;
    lines.push(fmt(topLine, theme.tiffany));

    // 过滤输入行
    const filterDisplay = "/" + this.filter + "_";
    const filterLine = borders.vertical + " " + fmt(filterDisplay, theme.accent) + " ".repeat(W - 4 - filterDisplay.length) + borders.vertical;
    lines.push(fmt(borders.vertical, theme.tiffany) + " " + fmt("/" + this.filter, theme.accent) + fmt("_", theme.dim) + " ".repeat(Math.max(0, W - 5 - this.filter.length)) + fmt(borders.vertical, theme.tiffany));

    // 分隔线
    lines.push(fmt(borders.vertical + borders.horizontal.repeat(W - 2) + borders.vertical, theme.darkGray));

    // 命令列表
    const visibleCommands = this.filteredCommands.slice(0, this.maxVisible);

    if (visibleCommands.length === 0) {
      const msg = "No matching commands";
      const pad = Math.floor((W - 2 - msg.length) / 2);
      lines.push(fmt(borders.vertical, theme.tiffany) + " ".repeat(pad) + fmt(msg, theme.dim) + " ".repeat(W - 2 - pad - msg.length) + fmt(borders.vertical, theme.tiffany));
    } else {
      for (let i = 0; i < visibleCommands.length; i++) {
        const cmd = visibleCommands[i];
        const isSelected = i === this.selectedIndex;

        const prefix = isSelected ? ">" : " ";
        const name = ("/" + cmd.name).padEnd(this.NAME_WIDTH);
        const desc = cmd.description;
        const descWidth = W - 6 - this.NAME_WIDTH;
        const descTrunc = desc.length > descWidth ? desc.slice(0, descWidth - 2) + ".." : desc.padEnd(descWidth);

        let content: string;
        if (isSelected) {
          content = fmt(prefix, theme.accent) + " " + fmt(name, theme.accent, theme.bold) + fmt(descTrunc, theme.white);
        } else {
          content = prefix + " " + fmt(name, theme.tiffanyDim) + fmt(descTrunc, theme.dim);
        }

        lines.push(fmt(borders.vertical, theme.tiffany) + " " + content + " " + fmt(borders.vertical, theme.tiffany));
      }
    }

    // 底部分隔线
    lines.push(fmt(borders.vertical + borders.horizontal.repeat(W - 2) + borders.vertical, theme.darkGray));

    // 提示行
    const hint = "Up/Down:Nav  Enter:Select  Esc:Cancel";
    const hintPad = Math.floor((W - 2 - hint.length) / 2);
    lines.push(fmt(borders.vertical, theme.tiffany) + " ".repeat(hintPad) + fmt(hint, theme.dim) + " ".repeat(W - 2 - hintPad - hint.length) + fmt(borders.vertical, theme.tiffany));

    // 底部边框
    lines.push(fmt(borders.bottomLeft + borders.horizontal.repeat(W - 2) + borders.bottomRight, theme.tiffany));

    // 输出
    hideCursor();
    console.log(lines.join("\n"));
    this.renderedLines = lines.length;
  }

  private clearRender(): void {
    if (this.renderedLines > 0) {
      moveCursor(-this.renderedLines);
      for (let i = 0; i < this.renderedLines; i++) {
        clearLine();
        if (i < this.renderedLines - 1) {
          moveCursor(1);
        }
      }
      moveCursor(-(this.renderedLines - 1));
      this.renderedLines = 0;
    }
  }

  /**
   * 显示选择器并等待用户选择
   */
  async pick(): Promise<CommandPickerResult> {
    return new Promise((resolve) => {
      this.render();

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      const handleKeypress = (chunk: Buffer) => {
        const key = chunk.toString();

        // Escape - 取消
        if (key === "\x1b" || key === "\x03") {
          cleanup();
          resolve({ command: null, cancelled: true });
          return;
        }

        // Enter - 确认选择
        if (key === "\r" || key === "\n") {
          const selected = this.filteredCommands[this.selectedIndex];
          cleanup();
          resolve({ command: selected || null, cancelled: false });
          return;
        }

        // 上箭头
        if (key === "\x1b[A") {
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          this.render();
          return;
        }

        // 下箭头
        if (key === "\x1b[B") {
          this.selectedIndex = Math.min(this.filteredCommands.length - 1, this.selectedIndex + 1);
          this.render();
          return;
        }

        // Backspace
        if (key === "\x7f" || key === "\b") {
          if (this.filter.length > 0) {
            this.filter = this.filter.slice(0, -1);
            this.applyFilter();
            this.render();
          }
          return;
        }

        // 可打印字符 - 过滤
        if (key.length === 1 && key >= " " && key <= "~") {
          this.filter += key;
          this.applyFilter();
          this.render();
        }
      };

      const cleanup = () => {
        process.stdin.removeListener("data", handleKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        this.clearRender();
        showCursor();
      };

      process.stdin.on("data", handleKeypress);
    });
  }
}

/**
 * 快速选择命令
 */
export async function pickCommand(commands: Command[], initialFilter: string = ""): Promise<CommandPickerResult> {
  const picker = new CommandPicker({
    commands,
    filter: initialFilter,
  });
  return picker.pick();
}
