/**
 * File Browser - 智能文件引用系统
 *
 * 输入 "@" 触发文件选择面板
 * 支持实时模糊搜索、文件夹导航、快捷键操作
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { theme, icons, borders, fmt, hideCursor, showCursor, clearLine, moveCursor } from "./theme.js";

export interface FileItem {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
}

export interface FileBrowserOptions {
  basePath?: string;
  filter?: string;
  maxVisible?: number;
  showHidden?: boolean;
  excludePatterns?: string[];
}

export interface FileBrowserResult {
  file: FileItem | null;
  cancelled: boolean;
}

// 默认排除的目录
const DEFAULT_EXCLUDE = ["node_modules", ".git", "dist", ".cache", "__pycache__", ".next", ".nuxt", "build", "coverage"];

/**
 * 异步读取目录内容
 */
async function readDirAsync(dirPath: string, options: FileBrowserOptions): Promise<FileItem[]> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const items: FileItem[] = [];

    for (const entry of entries) {
      if (!options.showHidden && entry.name.startsWith(".")) {
        continue;
      }

      const excludePatterns = options.excludePatterns || DEFAULT_EXCLUDE;
      if (entry.isDirectory() && excludePatterns.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(options.basePath || process.cwd(), fullPath);

      items.push({
        name: entry.name,
        path: fullPath,
        relativePath,
        isDirectory: entry.isDirectory(),
        extension: entry.isFile() ? path.extname(entry.name).slice(1) : undefined,
      });
    }

    items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return items;
  } catch {
    return [];
  }
}

/**
 * 模糊搜索文件
 */
async function fuzzySearchFiles(basePath: string, query: string, options: FileBrowserOptions): Promise<FileItem[]> {
  const results: FileItem[] = [];
  const lowerQuery = query.toLowerCase();
  const maxResults = 50;

  async function searchDir(dirPath: string, depth: number = 0): Promise<void> {
    if (depth > 5 || results.length >= maxResults) return;

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) break;

        if (!options.showHidden && entry.name.startsWith(".")) continue;

        const excludePatterns = options.excludePatterns || DEFAULT_EXCLUDE;
        if (entry.isDirectory() && excludePatterns.includes(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.name.toLowerCase().includes(lowerQuery) || relativePath.toLowerCase().includes(lowerQuery)) {
          results.push({
            name: entry.name,
            path: fullPath,
            relativePath,
            isDirectory: entry.isDirectory(),
            extension: entry.isFile() ? path.extname(entry.name).slice(1) : undefined,
          });
        }

        if (entry.isDirectory()) {
          await searchDir(fullPath, depth + 1);
        }
      }
    } catch {
      // 忽略权限错误
    }
  }

  await searchDir(basePath);
  return results;
}

/**
 * 文件浏览器类
 */
export class FileBrowser {
  private basePath: string;
  private currentPath: string;
  private items: FileItem[] = [];
  private filteredItems: FileItem[] = [];
  private selectedIndex: number = 0;
  private filter: string = "";
  private maxVisible: number;
  private options: FileBrowserOptions;
  private renderedLines: number = 0;
  private pathHistory: string[] = [];
  private isSearchMode: boolean = false;

  // 固定宽度
  private readonly WIDTH = 52;

  constructor(options: FileBrowserOptions = {}) {
    this.basePath = options.basePath || process.cwd();
    this.currentPath = this.basePath;
    this.maxVisible = options.maxVisible || 10;
    this.options = options;
    this.filter = options.filter || "";
  }

  private async loadItems(): Promise<void> {
    if (this.isSearchMode && this.filter.length > 0) {
      this.items = await fuzzySearchFiles(this.basePath, this.filter, this.options);
      this.filteredItems = this.items;
    } else {
      this.items = await readDirAsync(this.currentPath, this.options);
      this.applyFilter();
    }
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredItems.length - 1));
  }

  private applyFilter(): void {
    if (!this.filter) {
      this.filteredItems = [...this.items];
    } else {
      const lowerFilter = this.filter.toLowerCase();
      this.filteredItems = this.items.filter((item) => item.name.toLowerCase().includes(lowerFilter));
    }
  }

  private getFileIcon(item: FileItem): string {
    return item.isDirectory ? "+" : "-";
  }

  private render(): void {
    this.clearRender();

    const lines: string[] = [];
    const W = this.WIDTH;

    // 标题 - 当前路径
    const relativeCurrent = path.relative(this.basePath, this.currentPath) || ".";
    const pathDisplay = relativeCurrent.length > W - 12 ? ".." + relativeCurrent.slice(-(W - 14)) : relativeCurrent;
    const titleContent = " + " + pathDisplay + " ";
    const titlePad = W - 2 - titleContent.length;
    const topLine = borders.topLeft + titleContent + borders.horizontal.repeat(Math.max(0, titlePad)) + borders.topRight;
    lines.push(fmt(topLine, theme.tiffany));

    // 搜索框
    const searchPrefix = this.isSearchMode ? "? " : "@ ";
    const searchContent = searchPrefix + this.filter + "_";
    const searchPad = W - 4 - searchContent.length + 1;
    lines.push(
      fmt(borders.vertical, theme.tiffany) + " " +
      fmt(searchPrefix, theme.accent) + fmt(this.filter, theme.white) + fmt("_", theme.dim) +
      " ".repeat(Math.max(0, searchPad)) +
      fmt(borders.vertical, theme.tiffany)
    );

    // 分隔线
    lines.push(
      fmt(borders.vertical, theme.tiffany) +
      fmt(borders.horizontal.repeat(W - 2), theme.darkGray) +
      fmt(borders.vertical, theme.tiffany)
    );

    // 文件列表
    const visibleItems = this.filteredItems.slice(0, this.maxVisible);
    const nameWidth = W - 10;

    if (visibleItems.length === 0) {
      const msg = this.filter ? "No matching files" : "Empty directory";
      const pad = Math.floor((W - 2 - msg.length) / 2);
      lines.push(
        fmt(borders.vertical, theme.tiffany) +
        " ".repeat(pad) + fmt(msg, theme.dim) + " ".repeat(W - 2 - pad - msg.length) +
        fmt(borders.vertical, theme.tiffany)
      );
    } else {
      for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i];
        const isSelected = i === this.selectedIndex;
        const icon = this.getFileIcon(item);

        // 显示名称
        const displayName = this.isSearchMode ? item.relativePath : item.name;
        const truncName = displayName.length > nameWidth ? displayName.slice(0, nameWidth - 2) + ".." : displayName.padEnd(nameWidth);

        const prefix = isSelected ? ">" : " ";

        let content: string;
        if (isSelected) {
          if (item.isDirectory) {
            content = fmt(prefix, theme.accent) + " " + fmt(icon, theme.accent) + " " + fmt(truncName, theme.accent, theme.bold);
          } else {
            content = fmt(prefix, theme.tiffany) + " " + fmt(icon, theme.tiffany) + " " + fmt(truncName, theme.tiffany, theme.bold);
          }
        } else {
          if (item.isDirectory) {
            content = prefix + " " + fmt(icon, theme.accentDim) + " " + fmt(truncName, theme.dim);
          } else {
            content = prefix + " " + fmt(icon, theme.dim) + " " + fmt(truncName, theme.dim);
          }
        }

        lines.push(fmt(borders.vertical, theme.tiffany) + " " + content + " " + fmt(borders.vertical, theme.tiffany));
      }
    }

    // 如果有更多项
    if (this.filteredItems.length > this.maxVisible) {
      const moreCount = this.filteredItems.length - this.maxVisible;
      const moreText = "... " + moreCount + " more";
      const morePad = W - 4 - moreText.length;
      lines.push(
        fmt(borders.vertical, theme.tiffany) + " " +
        fmt(moreText, theme.dim) + " ".repeat(Math.max(0, morePad)) +
        fmt(borders.vertical, theme.tiffany)
      );
    }

    // 底部分隔线
    lines.push(
      fmt(borders.vertical, theme.tiffany) +
      fmt(borders.horizontal.repeat(W - 2), theme.darkGray) +
      fmt(borders.vertical, theme.tiffany)
    );

    // 提示行
    const hint = "Arrows: Nav | Enter: Select | Esc: Cancel";
    const hintPad = Math.floor((W - 2 - hint.length) / 2);
    lines.push(
      fmt(borders.vertical, theme.tiffany) +
      " ".repeat(hintPad) + fmt(hint, theme.dim) + " ".repeat(W - 2 - hintPad - hint.length) +
      fmt(borders.vertical, theme.tiffany)
    );

    // 底部边框
    lines.push(
      fmt(borders.bottomLeft, theme.tiffany) +
      fmt(borders.horizontal.repeat(W - 2), theme.tiffany) +
      fmt(borders.bottomRight, theme.tiffany)
    );

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

  private async navigateInto(): Promise<void> {
    const selected = this.filteredItems[this.selectedIndex];
    if (selected?.isDirectory) {
      this.pathHistory.push(this.currentPath);
      this.currentPath = selected.path;
      this.filter = "";
      this.selectedIndex = 0;
      this.isSearchMode = false;
      await this.loadItems();
    }
  }

  private async navigateBack(): Promise<void> {
    if (this.pathHistory.length > 0) {
      this.currentPath = this.pathHistory.pop()!;
      this.filter = "";
      this.selectedIndex = 0;
      this.isSearchMode = false;
      await this.loadItems();
    } else if (this.currentPath !== this.basePath) {
      this.currentPath = path.dirname(this.currentPath);
      this.filter = "";
      this.selectedIndex = 0;
      await this.loadItems();
    }
  }

  /**
   * 显示文件浏览器并等待选择
   */
  async browse(): Promise<FileBrowserResult> {
    await this.loadItems();

    return new Promise((resolve) => {
      this.render();

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      const handleKeypress = async (chunk: Buffer) => {
        const key = chunk.toString();

        // Escape - 取消
        if (key === "\x1b" || key === "\x03") {
          cleanup();
          resolve({ file: null, cancelled: true });
          return;
        }

        // Enter - 确认选择
        if (key === "\r" || key === "\n") {
          const selected = this.filteredItems[this.selectedIndex];
          if (selected) {
            if (selected.isDirectory) {
              await this.navigateInto();
              this.render();
            } else {
              cleanup();
              resolve({ file: selected, cancelled: false });
            }
          }
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
          this.selectedIndex = Math.min(this.filteredItems.length - 1, this.selectedIndex + 1);
          this.render();
          return;
        }

        // 右箭头 - 进入目录
        if (key === "\x1b[C") {
          await this.navigateInto();
          this.render();
          return;
        }

        // 左箭头 - 返回上级
        if (key === "\x1b[D") {
          await this.navigateBack();
          this.render();
          return;
        }

        // Tab - 切换搜索模式
        if (key === "\t") {
          this.isSearchMode = !this.isSearchMode;
          this.filter = "";
          this.selectedIndex = 0;
          await this.loadItems();
          this.render();
          return;
        }

        // Backspace
        if (key === "\x7f" || key === "\b") {
          if (this.filter.length > 0) {
            this.filter = this.filter.slice(0, -1);
            if (this.isSearchMode) {
              await this.loadItems();
            } else {
              this.applyFilter();
            }
            this.render();
          } else if (!this.isSearchMode) {
            await this.navigateBack();
            this.render();
          }
          return;
        }

        // 可打印字符 - 过滤/搜索
        if (key.length === 1 && key >= " " && key <= "~") {
          this.filter += key;
          if (this.filter.length === 1) {
            this.isSearchMode = true;
          }
          if (this.isSearchMode) {
            await this.loadItems();
          } else {
            this.applyFilter();
          }
          this.selectedIndex = 0;
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
 * 快速选择文件
 */
export async function pickFile(options: FileBrowserOptions = {}): Promise<FileBrowserResult> {
  const browser = new FileBrowser(options);
  return browser.browse();
}
